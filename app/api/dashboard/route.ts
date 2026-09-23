import { json } from "@/lib/http";
import { getActiveReference, getStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const store = getStore();
  const list = store.verifications;
  const finalOf = (v: (typeof list)[number]) => v.review?.decision || v.finalDecision;
  const accepted = list.filter((v) => finalOf(v) === "ACCEPTED" || finalOf(v) === "ACCEPTED_WITH_WARNING").length;
  const rejected = list.filter((v) => finalOf(v) === "REJECTED").length;
  const reviews = list.filter(
    (v) => v.status === "manual_review" || v.automatedDecision === "MANUAL_REVIEW" || v.finalDecision === "PENDING"
  ).length;
  const scored = list.filter((v) => v.status !== "processing");
  const avg =
    scored.length === 0 ? 0 : Math.round((scored.reduce((s, v) => s + v.overallScore, 0) / scored.length) * 10) / 10;

  return json({
    stats: {
      total: list.length,
      accepted,
      rejected,
      manualReviews: reviews,
      averageScore: avg,
    },
    recent: list.slice(0, 8),
    recentRejected: list.filter((v) => finalOf(v) === "REJECTED").slice(0, 5),
    recentAccepted: list
      .filter((v) => finalOf(v) === "ACCEPTED" || finalOf(v) === "ACCEPTED_WITH_WARNING")
      .slice(0, 5),
    processing: list.filter((v) => v.status === "processing"),
    currentReference: getActiveReference(store) ?? null,
  });
}
