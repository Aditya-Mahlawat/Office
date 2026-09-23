import { NextRequest } from "next/server";
import { json } from "@/lib/http";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const decision = searchParams.get("decision");
  const status = searchParams.get("status");
  const user = searchParams.get("user")?.toLowerCase();
  const refVersion = searchParams.get("reference_version");
  const minScore = Number(searchParams.get("min_score") || "");
  const maxScore = Number(searchParams.get("max_score") || "");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  let items = getStore().verifications;

  if (decision === "accepted") {
    items = items.filter((v) => (v.review?.decision || v.finalDecision) === "ACCEPTED" || v.finalDecision === "ACCEPTED_WITH_WARNING");
  } else if (decision === "rejected") {
    items = items.filter((v) => (v.review?.decision || v.finalDecision) === "REJECTED");
  } else if (decision === "manual_review") {
    items = items.filter(
      (v) => v.status === "manual_review" || v.automatedDecision === "MANUAL_REVIEW" || v.finalDecision === "PENDING"
    );
  }

  if (status) items = items.filter((v) => v.status === status);
  if (user) {
    items = items.filter(
      (v) => v.userId.toLowerCase().includes(user) || v.userName.toLowerCase().includes(user)
    );
  }
  if (refVersion) items = items.filter((v) => String(v.referenceVersion) === refVersion);
  if (!Number.isNaN(minScore) && searchParams.has("min_score")) {
    items = items.filter((v) => v.overallScore >= minScore);
  }
  if (!Number.isNaN(maxScore) && searchParams.has("max_score")) {
    items = items.filter((v) => v.overallScore <= maxScore);
  }
  if (from) items = items.filter((v) => v.createdAt >= from);
  if (to) items = items.filter((v) => v.createdAt <= `${to}T23:59:59.999Z`);

  return json({ verifications: items });
}
