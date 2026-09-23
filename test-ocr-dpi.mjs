import fs from "node:fs";
import path from "node:path";
import { extractImages, getDocumentProxy } from "unpdf";
import sharp from "sharp";
import { createWorker } from "tesseract.js";

async function test() {
  const filePath = "data/uploads/VER-10002-upload.pdf";
  const buffer = fs.readFileSync(filePath);
  const data = new Uint8Array(buffer);
  const doc = await getDocumentProxy(data);
  const images = await extractImages(doc, 1);
  const source = images[0];

  const image = await sharp(source.data, {
    raw: { width: source.width, height: source.height, channels: source.channels },
  })
    .withMetadata({ density: 300 })
    .grayscale()
    .normalize()
    .png()
    .toBuffer();

  const worker = await createWorker("eng", 1, {
    cachePath: path.join("data", "ocr-cache"),
  });
  await worker.setParameters({
    user_defined_dpi: "300",
  });

  const result = await worker.recognize(image);
  console.log("=== OCR RESULT (with 300 DPI) ===");
  console.log(result.data.text);
  await worker.terminate();
}

test().catch(console.error);
