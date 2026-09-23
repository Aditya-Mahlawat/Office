import fs from "node:fs";
import path from "node:path";
import { extractImages, getDocumentProxy } from "unpdf";
import sharp from "sharp";
import { createWorker } from "tesseract.js";

async function test() {
  const refPath = "data/uploads/REF-002.pdf";
  const refDoc = await getDocumentProxy(new Uint8Array(fs.readFileSync(refPath)));
  const { extractText } = await import("unpdf");
  const refText = await extractText(refDoc);
  console.log("=== REF-002 TEXT ===");
  console.log(refText);
  console.log("====================");
  
  for (let page = 1; page <= doc.numPages; page += 1) {
    console.log(`Extracting images from page ${page}...`);
    const images = await extractImages(doc, page);
    console.log(`Page ${page} images count:`, images.length);
    if (images.length > 0) {
      const source = images[0];
      const image = await sharp(source.data, {
        raw: { width: source.width, height: source.height, channels: source.channels },
      })
        .grayscale()
        .normalize()
        .png()
        .toBuffer();
      console.log("Image converted to PNG buffer, size:", image.length);
      console.log("Starting Tesseract worker...");
      const worker = await createWorker("eng", 1, {
        cachePath: path.join("data", "ocr-cache"),
      });
      console.log("Recognizing image...");
      const result = await worker.recognize(image);
      console.log("OCR Result text:");
      console.log(result.data.text);
      await worker.terminate();
    }
  }
}

test().catch(console.error);
