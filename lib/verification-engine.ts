import type {
  AcceptanceRules,
  AppSettings,
  AutomatedDecision,
  CategoryScores,
  Issue,
  ProcessingStage,
  StageKey,
  VerificationRecord,
} from "./types";
import { STAGE_DEFINITIONS as STAGES } from "./types";
import { clamp, coverage, jaccard, sequenceSimilarity, tokenize, weightedScore } from "./similarity";
import {
  detectSections,
  extractPdf,
  fieldPresence,
  layoutScore,
  letterheadAnalysis,
  signatureAnalysis,
  stampAnalysis,
} from "./pdf-extract";
import type { DocumentExtract } from "./pdf-extract";

function nowIso() {
  return new Date().toISOString();
}

function initStages(): ProcessingStage[] {
  return STAGES.map((s, i) => ({
    key: s.key,
    label: s.label,
    status: i === 0 ? "completed" : "pending",
    detail: i === 0 ? "File received and stored." : undefined,
    completedAt: i === 0 ? nowIso() : undefined,
  }));
}

function setStage(
  stages: ProcessingStage[],
  key: StageKey,
  status: ProcessingStage["status"],
  detail?: string
) {
  const stage = stages.find((s) => s.key === key);
  if (!stage) return;
  stage.status = status;
  if (detail) stage.detail = detail;
  if (status === "processing") stage.startedAt = nowIso();
  if (status === "completed" || status === "failed") stage.completedAt = nowIso();
}

function issue(
  severity: Issue["severity"],
  category: Issue["category"],
  message: string,
  page?: number
): Issue {
  return {
    id: `${severity}-${category}-${Math.random().toString(36).slice(2, 8)}`,
    severity,
    category,
    message,
    page,
  };
}

export type EngineInput = {
  uploadedBuffer: Buffer;
  referenceBuffer: Buffer;
  settings: AppSettings;
};

export type EngineResult = {
  stages: ProcessingStage[];
  categoryScores: CategoryScores;
  overallScore: number;
  automatedDecision: AutomatedDecision;
  issues: Issue[];
  engineMode: VerificationRecord["engineMode"];
  engineNote: string;
  extractedSummary: VerificationRecord["extractedSummary"];
  uploadedPageCount: number;
};

/**
 * Heuristic verification engine.
 *
 * This is a replaceable adapter. Production should swap this module for a
 * vision/OCR service (Tesseract, Google Document AI, Azure DI, custom model)
 * behind the same EngineResult contract.
 *
 * What it actually does today:
 * - Parses both PDFs with pdf.js (text + layout boxes + image operators)
 * - Compares text, sections, fields, layout metrics
 * - Uses labels + embedded image objects as proxies for signature/stamp/letterhead
 *
 * What it does NOT do:
 * - Full handwriting OCR
 * - Deep visual matching / seal classification
 */
export async function runVerificationEngine(input: EngineInput): Promise<EngineResult> {
  const stages = initStages();
  const issues: Issue[] = [];
  const { rules, weights } = input.settings;

  let uploaded: DocumentExtract;
  let reference: DocumentExtract;

  setStage(stages, "reading_pdf", "processing");
  try {
    uploaded = await extractPdf(input.uploadedBuffer);
    reference = await extractPdf(input.referenceBuffer);
    setStage(
      stages,
      "reading_pdf",
      "completed",
      `Uploaded ${uploaded.pageCount} page(s); reference ${reference.pageCount} page(s).`
    );
  } catch (err) {
    setStage(stages, "reading_pdf", "failed", err instanceof Error ? err.message : "PDF parse failed");
    throw err;
  }

  setStage(
    stages,
    "converting_pages",
    "completed",
    "Used PDF page metrics and operator lists. Raster conversion/OCR vision model is not connected."
  );

  const usedOcr = false;
  setStage(
    stages,
    "ocr_text",
    uploaded.hasSelectableText ? "completed" : "completed",
    uploaded.hasSelectableText
      ? "Extracted selectable PDF text (digital PDF path)."
      : "Little selectable text found. This looks scanned. Connect an OCR adapter (Tesseract / Document AI) in lib/verification-engine.ts for handwriting and scan OCR."
  );

  if (!uploaded.hasSelectableText) {
    issues.push(
      issue(
        "warning",
        "text",
        "Uploaded file has little selectable text. Scores use layout/image proxies; scan OCR is not connected."
      )
    );
  }

  setStage(stages, "structure", "processing");
  const refSections = detectSections(reference.fullText, rules.expectedSections);
  const upSections = detectSections(uploaded.fullText, rules.expectedSections);
  const structureScore = sequenceSimilarity(
    rules.expectedSections.length ? rules.expectedSections : refSections,
    upSections.length ? upSections : detectSections(uploaded.fullText, refSections)
  );
  const missingSections = rules.expectedSections.filter(
    (s) => !uploaded.fullText.toLowerCase().includes(s.toLowerCase())
  );
  for (const section of missingSections) {
    issues.push(
      issue(
        "critical",
        "structure",
        `Section “${section}” is missing from the uploaded document.`
      )
    );
  }
  if (uploaded.pageCount < reference.pageCount) {
    issues.push(
      issue(
        "critical",
        "structure",
        `Page ${uploaded.pageCount + 1} is missing (reference has ${reference.pageCount} pages).`
      )
    );
  }
  setStage(
    stages,
    "structure",
    "completed",
    `Detected ${upSections.length} heading/section candidates.`
  );

  setStage(stages, "fields", "processing");
  const fields = fieldPresence(uploaded.fullText, rules.mandatoryFields);
  const fieldsScore =
    rules.mandatoryFields.length === 0
      ? 100
      : Math.round((fields.present.length / rules.mandatoryFields.length) * 100);
  for (const missing of fields.missing) {
    issues.push(
      issue("critical", "fields", `Mandatory field “${missing}” was not detected.`)
    );
  }
  setStage(
    stages,
    "fields",
    "completed",
    `${fields.present.length}/${rules.mandatoryFields.length} mandatory fields detected.`
  );

  const textScore = uploaded.hasSelectableText
    ? jaccard(tokenize(reference.fullText), tokenize(uploaded.fullText))
    : clamp(coverage(tokenize(reference.fullText).slice(0, 80), uploaded.fullText) * 0.5 + 20);
  if (textScore < 55 && uploaded.hasSelectableText) {
    issues.push(
      issue("critical", "text", "Body text differs substantially from the reference document.")
    );
  } else if (textScore < 80) {
    issues.push(
      issue("warning", "text", "Text similarity is imperfect; wording or OCR noise may differ.")
    );
  }

  setStage(stages, "layout", "processing");
  const layout = layoutScore(reference, uploaded);
  for (const note of layout.notes) {
    const critical = note.toLowerCase().includes("page count") && uploaded.pageCount < reference.pageCount;
    issues.push(issue(critical ? "critical" : "warning", "layout", note));
  }
  if (layout.score < rules.layoutThreshold) {
    issues.push(
      issue(
        "critical",
        "layout",
        `Overall layout similarity (${layout.score}%) is below the configured threshold (${rules.layoutThreshold}%).`
      )
    );
  }
  setStage(stages, "layout", "completed", `Layout score ${layout.score}%.`);

  setStage(stages, "signature", "processing");
  const sig = signatureAnalysis(uploaded);
  if (!sig.detected) {
    issues.push(issue("critical", "signature", "Signature missing from required location."));
  } else if (sig.score < 90) {
    issues.push(issue("warning", "signature", sig.reason));
  }
  setStage(stages, "signature", "completed", sig.reason);

  setStage(stages, "stamp", "processing");
  const stamp = stampAnalysis(uploaded);
  if (!stamp.detected) {
    issues.push(issue("critical", "stamp", "Required stamp/seal was not detected."));
  } else if (stamp.score < 90) {
    issues.push(issue("warning", "stamp", stamp.reason));
  }
  setStage(stages, "stamp", "completed", stamp.reason);

  setStage(stages, "letterhead", "processing");
  const head = letterheadAnalysis(reference, uploaded);
  if (!head.detected) {
    issues.push(issue("warning", "letterhead", "Letterhead/branding structure does not closely match the reference."));
  }
  setStage(stages, "letterhead", "completed", head.reason);

  const categoryScores: CategoryScores = {
    text: clamp(textScore),
    fields: clamp(fieldsScore),
    structure: clamp(missingSections.length ? Math.min(structureScore, 70) : structureScore),
    layout: clamp(layout.score),
    signature: clamp(sig.score),
    stamp: clamp(stamp.score),
    letterhead: clamp(head.score),
  };

  setStage(stages, "score", "completed", "Weighted category scores applied from Settings.");
  const overallScore = weightedScore(categoryScores, weights);

  setStage(stages, "criteria", "processing");
  const { decision, decisionNotes } = applyRules(overallScore, categoryScores, issues, rules);
  setStage(stages, "criteria", "completed", decisionNotes);

  setStage(
    stages,
    "decision",
    "completed",
    `Automated decision: ${decision} (match ${overallScore}%).`
  );

  return {
    stages,
    categoryScores,
    overallScore,
    automatedDecision: decision,
    issues,
    engineMode: "heuristic",
    engineNote:
      "Heuristic PDF parser (pdf.js text, layout boxes, image operators). Replace runVerificationEngine() with a production OCR/vision provider. Results are real comparisons of extracted PDF data, not a simulated pass.",
    extractedSummary: {
      uploadedTextPreview: uploaded.fullText.slice(0, 1200),
      referenceTextPreview: reference.fullText.slice(0, 1200),
      uploadedHasSelectableText: uploaded.hasSelectableText,
      usedOcr: usedOcr,
    },
    uploadedPageCount: uploaded.pageCount,
  };
}

function applyRules(
  overall: number,
  scores: CategoryScores,
  issues: Issue[],
  rules: AcceptanceRules
): { decision: AutomatedDecision; decisionNotes: string } {
  const critical = issues.filter((i) => i.severity === "critical");
  const reasons: string[] = [];

  if (overall < rules.overallThreshold) {
    reasons.push(`Overall score ${overall}% is below ${rules.overallThreshold}%.`);
  }
  if (rules.requireAllMandatoryFields && scores.fields < 100) {
    reasons.push("One or more mandatory fields are missing.");
  }
  if (rules.requireSignature && scores.signature < 60) {
    reasons.push("Signature requirement not met.");
  }
  if (rules.requireStamp && scores.stamp < 60) {
    reasons.push("Required stamp/seal not met.");
  }
  if (rules.requireNoCriticalSectionsMissing && critical.some((c) => c.category === "structure")) {
    reasons.push("A critical section or page is missing.");
  }
  if (scores.layout < rules.layoutThreshold) {
    reasons.push("Layout similarity below threshold.");
  }

  if (reasons.length > 0) {
    if (
      rules.sendLowScoreToManualReview &&
      overall >= rules.overallThreshold - rules.manualReviewBand &&
      overall < rules.overallThreshold &&
      critical.length <= 1
    ) {
      issues.push(
        issue("warning", "general", "Score is in the manual-review band; a human should confirm.")
      );
      return {
        decision: "MANUAL_REVIEW",
        decisionNotes: `Borderline result sent to manual review. ${reasons.join(" ")}`,
      };
    }
    return {
      decision: "REJECTED",
      decisionNotes: reasons.join(" "),
    };
  }

  return {
    decision: "ACCEPTED",
    decisionNotes: `All configured acceptance rules passed (threshold ${rules.overallThreshold}%).`,
  };
}

export { STAGES as STAGE_DEFINITIONS };
