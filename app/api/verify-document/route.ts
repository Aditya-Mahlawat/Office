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
  const reference =
    store.references.find((r) => r.id === requestedRef) ?? getActiveReference(store);

  if (!reference) {
    return badRequest("No active reference document. Upload a reference PDF first.");
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

  const pending: VerificationRecord = {
    id,
    userId,
    userName,
    uploadedFileName: parsed.file.name,
    uploadedStoredName: storedName,
    uploadedSizeBytes: parsed.buffer.length,
    uploadedPageCount,
    referenceId: reference.id,
    referenceVersion: reference.version,
    referenceFileName: reference.fileName,
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
  saveVerification(pending);

  try {
    const refBuf = fs.readFileSync(filePath(reference.storedName));
    const result = await runVerificationEngine({
      uploadedBuffer: parsed.buffer,
      referenceBuffer: refBuf,
      settings: store.settings,
    });

    const status =
      result.automatedDecision === "MANUAL_REVIEW" ? "manual_review" : "completed";

    const completed: VerificationRecord = {
      ...pending,
      ...result,
      status,
      finalDecision:
        result.automatedDecision === "MANUAL_REVIEW" ? "PENDING" : result.automatedDecision,
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
  } catch (err) {
    pending.status = "failed";
    pending.stages = pending.stages.map((s) =>
      s.status === "processing" ? { ...s, status: "failed", detail: String(err) } : s
    );
    saveVerification(pending);
    return json({ error: "Verification engine failed", detail: String(err), verification: pending }, 500);
  }
}
