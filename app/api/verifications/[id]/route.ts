import { json, notFound } from "@/lib/http";
import { getVerification } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const record = getVerification(id);
  if (!record) return notFound("Verification not found");
  return json({ verification: record });
}
