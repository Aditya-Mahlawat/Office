import fs from "node:fs";
import path from "node:path";
import { extractImages, getDocumentProxy } from "unpdf";
import sharp from "sharp";
import { createWorker } from "tesseract.js";
import { runVerificationEngine } from "./lib/verification-engine";
import { getStore } from "./lib/store";
import { DATA_DIR, ensureDataDirs } from "./lib/paths";
import type { DocumentExtract } from "./lib/pdf-extract";
import { applyOcrText } from "./lib/ocr";

// Let's test custom OCR pipeline
async function customOcrImagePdf(buffer: Buffer): Promise<string[]> {
  ensureDataDirs();
  const doc = await getDocumentProxy(new Uint8Array(buffer));
  const worker = await createWorker("eng", 1, {
    cachePath: path.join(DATA_DIR, "ocr-cache"),
  });
  await worker.setParameters({ user_defined_dpi: "300" });

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

      // Crop 3.5% margins to remove photograph desk borders, apply CLAHE + normalize
      const left = Math.round(source.width * 0.035);
      const top = Math.round(source.height * 0.035);
      const width = source.width - left * 2;
      const height = source.height - top * 2;

      const image = await sharp(source.data, {
        raw: { width: source.width, height: source.height, channels: source.channels },
      })
        .extract({ left, top, width, height })
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

async function test() {
  const store = getStore();
  const upBuf = fs.readFileSync("data/uploads/VER-10002-upload.pdf");
  const refBuf = fs.readFileSync("data/uploads/REF-002.pdf");

  console.log("Running custom OCR...");
  const ocrTexts = await customOcrImagePdf(upBuf);
  console.log("OCR text preview:", ocrTexts[0]?.slice(0, 300));

  // Let's test verification engine
  // Temporarily replace ocrImagePdf or inspect
}

test().catch(console.error);
