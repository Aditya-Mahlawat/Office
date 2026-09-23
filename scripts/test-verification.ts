import fs from "node:fs";
import { runVerificationEngine } from "../lib/verification-engine";
import { getStore } from "../lib/store";

async function main() {
  const store = getStore();
  const upBuf = fs.readFileSync("data/uploads/VER-10002-upload.pdf");
  const refBuf = fs.readFileSync("data/uploads/REF-002.pdf");

  console.log("Running verification engine on VER-10002-upload.pdf vs REF-002.pdf...");
  const start = Date.now();
  const result = await runVerificationEngine({
    uploadedBuffer: upBuf,
    referenceBuffer: refBuf,
    settings: store.settings,
  });
  console.log(`Finished in ${Date.now() - start}ms`);
  console.log("Automated Decision:", result.automatedDecision);
  console.log("Overall Score:", result.overallScore);
  console.log("Category Scores:", JSON.stringify(result.categoryScores, null, 2));
  console.log("Issues:", JSON.stringify(result.issues, null, 2));
  console.log("Engine Note:", result.engineNote);
  const ref = await (await import("../lib/pdf-extract")).extractPdf(refBuf);
  const ocrRes = await (await import("../lib/ocr")).ocrImagePdf(upBuf);
  const up = (await import("../lib/ocr")).applyOcrText(
    await (await import("../lib/pdf-extract")).extractPdf(upBuf),
    ocrRes.texts
  );
  const { deriveReferenceCriteria } = await import("../lib/reference-criteria");
  const crit = deriveReferenceCriteria(ref.fullText);
  const { detectSections } = await import("../lib/pdf-extract");
  const { sequenceSimilarity } = await import("../lib/similarity");
  const refSec = detectSections(ref.fullText, crit.expectedSections);
  const upSec = detectSections(up.fullText, crit.expectedSections);
  console.log("crit.expectedSections:", crit.expectedSections);
  console.log("refSec:", refSec);
  console.log("upSec:", upSec);
  console.log("sequenceSimilarity:", sequenceSimilarity(crit.expectedSections, upSec));
}

main().catch(console.error);
