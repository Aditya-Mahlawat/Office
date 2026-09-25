import fs from "node:fs";
import { NextRequest } from "next/server";
import { badRequest, json, readPdfUpload } from "@/lib/http";
import { extractPdf } from "@/lib/pdf-extract";
import { filePath } from "@/lib/paths";
import {
  getActiveReference,
  getStore,
  nextVerificationId,
  saveVerification,
  withStore,
} from "@/lib/store";
import { runVerificationEngine } from "@/lib/verification-engine";
import type { VerificationRecord } from "@/lib/types";
import { STAGE_DEFINITIONS } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Integration API for an existing website:
 * POST /api/verify-document
 * form-data: uploaded_document, user_id?, user_name?, reference_document_id?
 */
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const parsed = await readPdfUpload(
    (form.get("uploaded_document") as File | null) ?? (form.get("file") as File | null),
    "uploaded_document"
  );
  if ("error" in parsed) return badRequest(parsed.error);

  const store = getStore();
  const requestedRef = String(form.get("reference_document_id") ?? "");
  const references = requestedRef
    ? store.references.filter((r) => r.id === requestedRef)
    : store.references.filter((r) => r.active && !r.deletedAt);

  if (references.length === 0) {
    return badRequest("No active reference document. Upload and activate a reference PDF first.");
  }

  const userId = String(form.get("user_id") || "user-demo");
  const userName = String(form.get("user_name") || userId);

  const id = withStore((s) => nextVerificationId(s));
  const storedName = `${id}-upload.pdf`;
  fs.writeFileSync(filePath(storedName), parsed.buffer);

  let uploadedPageCount = 0;
  try {
    uploadedPageCount = (await extractPdf(parsed.buffer)).pageCount;
  } catch {
    return badRequest("Could not read the uploaded PDF.");
  }

  let bestResult = null;
  let bestScore = -1;
  let bestReference = references[0];

  for (const ref of references) {
    try {
      const refBuf = fs.readFileSync(filePath(ref.storedName));
      const result = await runVerificationEngine({
        uploadedBuffer: parsed.buffer,
        referenceBuffer: refBuf,
        settings: store.settings,
      });
      if (result.overallScore > bestScore) {
        bestScore = result.overallScore;
        bestResult = result;
        bestReference = ref;
      }
    } catch (err) {
      console.error(`Verification error against ${ref.id}:`, err);
    }
  }

  const pending: VerificationRecord = {
    id,
    userId,
    userName,
    uploadedFileName: parsed.file.name,
    uploadedStoredName: storedName,
    uploadedSizeBytes: parsed.buffer.length,
    uploadedPageCount,
    referenceId: bestReference.id,
    referenceVersion: bestReference.version,
    referenceFileName: bestReference.fileName,
    createdAt: new Date().toISOString(),
    status: "processing",
    engineMode: "heuristic",
    engineNote: "Queued",
    stages: STAGE_DEFINITIONS.map((s, i) => ({
      key: s.key,
      label: s.label,
      status: i === 0 ? "completed" : i === 1 ? "processing" : "pending",
    })),
    categoryScores: {
      text: 0,
      fields: 0,
      structure: 0,
      layout: 0,
      signature: 0,
      stamp: 0,
      letterhead: 0,
    },
    overallScore: 0,
    automatedDecision: "MANUAL_REVIEW",
    finalDecision: "PENDING",
    issues: [],
    extractedSummary: {
      uploadedTextPreview: "",
      referenceTextPreview: "",
      uploadedHasSelectableText: false,
      usedOcr: false,
    },
  };

  if (!bestResult) {
    pending.status = "failed";
    pending.stages = pending.stages.map((s) =>
      s.status === "processing" ? { ...s, status: "failed", detail: "Verification engine failed against all references" } : s
    );
    saveVerification(pending);
    return json({ error: "Verification engine failed against all references", verification: pending }, 500);
  }

  const status =
    bestResult.automatedDecision === "MANUAL_REVIEW" ? "manual_review" : "completed";

  const completed: VerificationRecord = {
    ...pending,
    ...bestResult,
    status,
    finalDecision:
      bestResult.automatedDecision === "MANUAL_REVIEW" ? "PENDING" : bestResult.automatedDecision,
    completedAt: new Date().toISOString(),
  };
  saveVerification(completed);

  return json({
    verification_id: completed.id,
    match_percentage: completed.overallScore,
    automated_decision: completed.automatedDecision,
    final_decision: completed.finalDecision,
    critical_issues: completed.issues.filter((i) => i.severity === "critical").map((i) => i.message),
    warnings: completed.issues.filter((i) => i.severity === "warning").map((i) => i.message),
    verification: completed,
  });
}
