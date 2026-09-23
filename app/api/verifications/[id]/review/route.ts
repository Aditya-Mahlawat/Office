import { NextRequest } from "next/server";
import { badRequest, json, notFound } from "@/lib/http";
import { getSettings, getVerification, saveVerification } from "@/lib/store";
import type { ReviewerDecision } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const record = getVerification(id);
  if (!record) return notFound("Verification not found");

  const body = (await req.json()) as {
    reviewer?: string;
    decision?: ReviewerDecision;
    comment?: string;
  };

  if (!body.decision || !["ACCEPTED", "REJECTED", "ACCEPTED_WITH_WARNING"].includes(body.decision)) {
    return badRequest("decision must be ACCEPTED, REJECTED, or ACCEPTED_WITH_WARNING");
  }

  const settings = getSettings();
  const overridden = body.decision !== record.automatedDecision;
  const comment = (body.comment || "").trim();
  if (settings.rules.commentRequiredOnOverride && overridden && !comment) {
    return badRequest("A reviewer comment is required when overriding the automated decision.");
  }

  record.review = {
    reviewer: body.reviewer?.trim() || "reviewer",
    decision: body.decision,
    comment,
    overridden,
    timestamp: new Date().toISOString(),
  };
  record.finalDecision = body.decision;
  record.status = "completed";
  saveVerification(record);

  return json({ verification: record });
}
