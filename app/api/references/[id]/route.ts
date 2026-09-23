import { NextRequest } from "next/server";
import fs from "node:fs";
import { json, notFound } from "@/lib/http";
import { filePath } from "@/lib/paths";
import { withStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = (await req.json()) as { active?: boolean };
  const updated = withStore((store) => {
    const doc = store.references.find((r) => r.id === id);
    if (!doc) return null;
    if (body.active && !doc.deletedAt) {
      for (const r of store.references) r.active = r.id === id;
    } else if (body.active === false) {
      doc.active = false;
    }
    return doc;
  });
  if (!updated) return notFound("Reference not found");
  return json({ reference: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = withStore((store) => {
    const doc = store.references.find((reference) => reference.id === id);
    if (!doc || doc.deletedAt) return null;
    const hasHistory = store.verifications.some((verification) => verification.referenceId === id);
    doc.active = false;
    doc.deletedAt = new Date().toISOString();
    const fallback = store.references.find((reference) => !reference.deletedAt && reference.id !== id);
    if (fallback) fallback.active = true;
    if (!hasHistory && fs.existsSync(filePath(doc.storedName))) {
      fs.unlinkSync(filePath(doc.storedName));
    }
    return { id: doc.id, retainedForHistory: hasHistory };
  });
  if (!result) return notFound("Reference not found");
  return json({ deleted: true, ...result });
}
