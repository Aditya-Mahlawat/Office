export type StageStatus = "pending" | "processing" | "completed" | "failed";

export type StageKey =
  | "uploaded"
  | "reading_pdf"
  | "converting_pages"
  | "ocr_text"
  | "structure"
  | "fields"
  | "layout"
  | "signature"
  | "stamp"
  | "letterhead"
  | "score"
  | "criteria"
  | "decision";

export type ProcessingStage = {
  key: StageKey;
  label: string;
  status: StageStatus;
  detail?: string;
  startedAt?: string;
  completedAt?: string;
};

export type CategoryKey =
  | "text"
  | "fields"
  | "structure"
  | "layout"
  | "signature"
  | "stamp"
  | "letterhead";

export type CategoryScores = Record<CategoryKey, number>;

export type ScoreWeights = Record<CategoryKey, number>;

export type IssueSeverity = "critical" | "warning";

export type Issue = {
  id: string;
  severity: IssueSeverity;
  category: CategoryKey | "general";
  message: string;
  page?: number;
};

export type AutomatedDecision = "ACCEPTED" | "REJECTED" | "MANUAL_REVIEW";
export type ReviewerDecision = "ACCEPTED" | "REJECTED" | "ACCEPTED_WITH_WARNING";
export type FinalDecision = AutomatedDecision | ReviewerDecision | "PENDING";
export type VerificationStatus =
  | "processing"
  | "completed"
  | "failed"
  | "manual_review";

export type ReferenceDocument = {
  id: string;
  version: number;
  fileName: string;
  storedName: string;
  uploadedAt: string;
  active: boolean;
  pageCount: number;
  sizeBytes: number;
  /** Labels/sections inferred from this particular template, not global demo defaults. */
  criteria?: ReferenceCriteria;
  /** Soft-deleted versions stay available to historical verification reports. */
  deletedAt?: string;
};

export type ReferenceCriteria = {
  mandatoryFields: string[];
  expectedSections: string[];
};

export type HumanReview = {
  reviewer: string;
  decision: ReviewerDecision;
  comment: string;
  overridden: boolean;
  timestamp: string;
};

export type VerificationRecord = {
  id: string;
  userId: string;
  userName: string;
  uploadedFileName: string;
  uploadedStoredName: string;
  uploadedSizeBytes: number;
  uploadedPageCount: number;
  referenceId: string;
  referenceVersion: number;
  referenceFileName: string;
  createdAt: string;
  completedAt?: string;
  status: VerificationStatus;
  engineMode: "heuristic" | "ocr_hybrid";
  engineNote: string;
  stages: ProcessingStage[];
  categoryScores: CategoryScores;
  overallScore: number;
  automatedDecision: AutomatedDecision;
  finalDecision: FinalDecision;
  issues: Issue[];
  extractedSummary: {
    uploadedTextPreview: string;
    referenceTextPreview: string;
    uploadedHasSelectableText: boolean;
    usedOcr: boolean;
  };
  review?: HumanReview;
};

export type AcceptanceRules = {
  overallThreshold: number;
  requireSignature: boolean;
  requireStamp: boolean;
  requireAllMandatoryFields: boolean;
  requireNoCriticalSectionsMissing: boolean;
  layoutThreshold: number;
  commentRequiredOnOverride: boolean;
  sendLowScoreToManualReview: boolean;
  manualReviewBand: number;
  mandatoryFields: string[];
  expectedSections: string[];
};

export type AppSettings = {
  weights: ScoreWeights;
  rules: AcceptanceRules;
};

export type StoreShape = {
  references: ReferenceDocument[];
  verifications: VerificationRecord[];
  settings: AppSettings;
  seq: { verification: number; reference: number };
};

export const STAGE_DEFINITIONS: { key: StageKey; label: string }[] = [
  { key: "uploaded", label: "Document uploaded" },
  { key: "reading_pdf", label: "Reading PDF" },
  { key: "converting_pages", label: "Converting pages to images" },
  { key: "ocr_text", label: "OCR / extracting text" },
  { key: "structure", label: "Detecting document structure" },
  { key: "fields", label: "Comparing required fields" },
  { key: "layout", label: "Comparing layout and formatting" },
  { key: "signature", label: "Checking signatures" },
  { key: "stamp", label: "Checking stamps/seals" },
  { key: "letterhead", label: "Checking letterhead" },
  { key: "score", label: "Calculating match score" },
  { key: "criteria", label: "Applying acceptance criteria" },
  { key: "decision", label: "Generating final decision" },
];

export const DEFAULT_WEIGHTS: ScoreWeights = {
  text: 25,
  fields: 25,
  structure: 15,
  layout: 15,
  signature: 10,
  stamp: 5,
  letterhead: 5,
};

export const DEFAULT_RULES: AcceptanceRules = {
  overallThreshold: 85,
  requireSignature: true,
  requireStamp: true,
  requireAllMandatoryFields: true,
  requireNoCriticalSectionsMissing: true,
  layoutThreshold: 70,
  commentRequiredOnOverride: true,
  sendLowScoreToManualReview: true,
  manualReviewBand: 10,
  mandatoryFields: [
    "Name",
    "Address",
    "Date",
    "Declaration",
    "Signature",
  ],
  expectedSections: [
    "Introduction",
    "Details",
    "Declaration",
    "Signature",
  ],
};

export const DEFAULT_SETTINGS: AppSettings = {
  weights: DEFAULT_WEIGHTS,
  rules: DEFAULT_RULES,
};

export const CATEGORY_LABELS: Record<CategoryKey, string> = {
  text: "Text",
  fields: "Required Fields",
  structure: "Structure",
  layout: "Layout",
  signature: "Signature",
  stamp: "Stamp",
  letterhead: "Letterhead",
};
