import { NextRequest } from "next/server";
import { json, notFound } from "@/lib/http";
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
    if (body.active) {
      for (const r of store.references) r.active = r.id === id;
    } else if (body.active === false) {
      doc.active = false;
    }
    return doc;
  });
  if (!updated) return notFound("Reference not found");
  return json({ reference: updated });
}
