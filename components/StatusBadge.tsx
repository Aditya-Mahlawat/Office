import type { AutomatedDecision, FinalDecision, VerificationStatus } from "@/lib/types";

const LABELS: Record<string, string> = {
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
  ACCEPTED_WITH_WARNING: "Accepted with warning",
  MANUAL_REVIEW: "Manual review",
  PENDING: "Pending review",
  processing: "Processing",
  completed: "Completed",
  failed: "Failed",
  manual_review: "Manual review",
};

function tone(value: string) {
  const v = value.toLowerCase();
  if (v.includes("accept")) return "accepted";
  if (v.includes("reject") || v === "failed") return "rejected";
  if (v.includes("manual") || v.includes("pending") || v.includes("warning")) return "manual_review";
  if (v.includes("process")) return "processing";
  return "pending";
}

export function StatusBadge({
  value,
}: {
  value: AutomatedDecision | FinalDecision | VerificationStatus | string;
}) {
  const cls = tone(String(value));
  return (
    <span className={`badge ${cls}`}>
      <span className="dot" />
      {LABELS[value] || String(value)}
    </span>
  );
}
