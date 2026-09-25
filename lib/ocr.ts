import path from "node:path";
import { extractImages, getDocumentProxy } from "unpdf";
import sharp from "sharp";
import { createWorker } from "tesseract.js";
import { DATA_DIR, ensureDataDirs } from "./paths";
import type { DocumentExtract } from "./pdf-extract";



async function runStandaloneTesseract(buffer: Buffer): Promise<string[]> {
  ensureDataDirs();
  const doc = await getDocumentProxy(new Uint8Array(buffer));
  const workerScript = path.resolve(process.cwd(), "node_modules/tesseract.js/src/worker-script/node/index.js");
  const worker = await createWorker("eng", 1, {
    cachePath: path.join(DATA_DIR, "ocr-cache"),
    workerPath: workerScript,
  });
  await worker.setParameters({
    user_defined_dpi: "300",
  });

  try {
    const texts: string[] = [];
    for (let page = 1; page <= doc.numPages; page += 1) {
      const images = await extractImages(doc, page);
      const source = images
        .slice()
        .sort((a, b) => b.width * b.height - a.width * a.height)[0];
      if (!source) {
        texts.push("");
        continue;
      }

      // Check if image is a full-page photo/scan with photographic borders
      // Removing ~3% outer border prevents dark background shadows from corrupting edge characters
      const hasMargin = source.width > 400 && source.height > 400;
      const cropLeft = hasMargin ? Math.round(source.width * 0.03) : 0;
      const cropTop = hasMargin ? Math.round(source.height * 0.03) : 0;
      const cropWidth = source.width - cropLeft * 2;
      const cropHeight = source.height - cropTop * 2;

      let pipeline = sharp(source.data, {
        raw: { width: source.width, height: source.height, channels: source.channels },
      });

      if (hasMargin) {
        pipeline = pipeline.extract({ left: cropLeft, top: cropTop, width: cropWidth, height: cropHeight });
      }

      const image = await pipeline
        .withMetadata({ density: 300 })
        .grayscale()
        .clahe({ width: 40, height: 40 })
        .normalize()
        .png()
        .toBuffer();

      const result = await worker.recognize(image);
      texts.push(result.data.text.replace(/\s+/g, " ").trim());
    }
    return texts;
  } finally {
    await worker.terminate();
  }
}

/** OCR image-only PDF pages using standalone Tesseract. */
export async function ocrImagePdf(buffer: Buffer): Promise<{ texts: string[]; provider: "tesseract" }> {
  const texts = await runStandaloneTesseract(buffer);
  return { texts, provider: "tesseract" };
}

export function applyOcrText(extract: DocumentExtract, pageTexts: string[]): DocumentExtract {
  const pages = extract.pages.map((page, index) => ({ ...page, text: pageTexts[index] || page.text }));
  const fullText = pages.map((page) => page.text).join("\n");
  const words = fullText.split(/\s+/).filter(Boolean);
  return {
    ...extract,
    pages,
    fullText,
    hasSelectableText: fullText.replace(/\s/g, "").length >= 40,
    // OCR output lacks coordinates; use stable page-relative approximations for branding/signature hints.
    topBandText: words.slice(0, Math.max(1, Math.ceil(words.length * 0.25))).join(" "),
    bottomBandText: words.slice(Math.floor(words.length * 0.75)).join(" "),
  };
}
