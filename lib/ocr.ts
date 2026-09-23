import path from "node:path";
import { extractImages, getDocumentProxy } from "unpdf";
import sharp from "sharp";
import { createWorker } from "tesseract.js";
import { DATA_DIR, ensureDataDirs } from "./paths";
import type { DocumentExtract } from "./pdf-extract";

/** OCR image-only PDF pages with Tesseract. Language data is cached under data/. */
export async function ocrImagePdf(buffer: Buffer): Promise<string[]> {
  ensureDataDirs();
  const doc = await getDocumentProxy(new Uint8Array(buffer));
  const worker = await createWorker("eng", 1, {
    cachePath: path.join(DATA_DIR, "ocr-cache"),
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

      const image = await sharp(source.data, {
        raw: { width: source.width, height: source.height, channels: source.channels },
      })
        .grayscale()
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
