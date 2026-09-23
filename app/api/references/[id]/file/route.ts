import fs from "node:fs";
import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { filePath } from "@/lib/paths";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const doc = getStore().references.find((r) => r.id === id);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const buf = fs.readFileSync(filePath(doc.storedName));
    return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${doc.fileName}"`,
    },
  });
}
