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

  const worker = await createWorker("eng", 1, {
    cachePath: path.join("data", "ocr-cache"),
  });

  // Try different filters
  const variants = [
    {
      name: "clahe",
      fn: (s) => s.grayscale().clahe({ width: 50, height: 50 }).normalize()
    },
    {
      name: "threshold-150",
      fn: (s) => s.grayscale().threshold(150)
    },
    {
      name: "threshold-170",
      fn: (s) => s.grayscale().threshold(170)
    },
    {
      name: "gamma-contrast",
      fn: (s) => s.grayscale().gamma(1.2).linear(1.3, -30)
    }
  ];

  for (const v of variants) {
    const imgBuf = await v.fn(sharp(source.data, {
      raw: { width: source.width, height: source.height, channels: source.channels },
    })).png().toBuffer();
    fs.writeFileSync(`debug-${v.name}.png`, imgBuf);

    const res = await worker.recognize(imgBuf);
    console.log(`\n=== Variant ${v.name} ===`);
    const lines = res.data.text.split("\n").filter(l => l.trim().length > 0);
    console.log(lines.slice(0, 15).join("\n"));
    const full = res.data.text.toLowerCase();
    console.log("Hits:", {
      subject: full.includes("subject"),
      signature: full.includes("signature"),
      phone: full.includes("phone"),
      designation: full.includes("designation"),
      aditya: full.includes("aditya"),
    });
  }

  await worker.terminate();
}

test().catch(console.error);
