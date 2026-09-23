import fs from "node:fs";
import { NextRequest } from "next/server";
import { badRequest, json, readPdfUpload } from "@/lib/http";
import { extractPdf } from "@/lib/pdf-extract";
import { filePath } from "@/lib/paths";
import { getStore, nextReferenceVersion, withStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { references } = getStore();
  return json({
    references,
    activeId: references.find((r) => r.active)?.id ?? null,
  });
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const parsed = await readPdfUpload(form.get("file") as File | null, "file");
  if ("error" in parsed) return badRequest(parsed.error);

  let pageCount = 0;
  try {
    pageCount = (await extractPdf(parsed.buffer)).pageCount;
  } catch {
    return badRequest("Could not read this PDF.");
  }

  const record = withStore((store) => {
    const version = nextReferenceVersion(store);
    const id = `REF-${String(version).padStart(3, "0")}`;
    const storedName = `${id}.pdf`;
    fs.writeFileSync(filePath(storedName), parsed.buffer);
    for (const r of store.references) r.active = false;
    const doc = {
      id,
      version,
      fileName: parsed.file.name,
      storedName,
      uploadedAt: new Date().toISOString(),
      active: true,
      pageCount,
      sizeBytes: parsed.buffer.length,
    };
    store.references.push(doc);
    return doc;
  });

  return json({ reference: record }, 201);
}
