import fs from "node:fs";
import { NextRequest, NextResponse } from "next/server";
import { getStore, getVerification } from "@/lib/store";
import { filePath } from "@/lib/paths";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const side = new URL(req.url).searchParams.get("side") || "uploaded";
  const record = getVerification(id);
  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (side === "reference") {
    const ref = getStore().references.find((r) => r.id === record.referenceId);
    if (!ref) return NextResponse.json({ error: "Reference missing" }, { status: 404 });
    const buf = fs.readFileSync(filePath(ref.storedName));
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${ref.fileName}"`,
      },
    });
  }

  const buf = fs.readFileSync(filePath(record.uploadedStoredName));
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${record.uploadedFileName}"`,
    },
  });
}
