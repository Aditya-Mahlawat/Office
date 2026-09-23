import fs from "node:fs";
import { NextRequest } from "next/server";
import { badRequest, json, readPdfUpload } from "@/lib/http";
import { extractPdf } from "@/lib/pdf-extract";
import { filePath } from "@/lib/paths";
import { getStore, nextReferenceVersion, withStore } from "@/lib/store";
import { deriveReferenceCriteria } from "@/lib/reference-criteria";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { references } = getStore();
  const visibleReferences = references.filter((reference) => !reference.deletedAt);
  return json({
    references: visibleReferences,
    activeId: visibleReferences.find((r) => r.active)?.id ?? null,
  });
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const parsed = await readPdfUpload(form.get("file") as File | null, "file");
  if ("error" in parsed) return badRequest(parsed.error);

  let pageCount = 0;
  let criteria;
  try {
    const extracted = await extractPdf(parsed.buffer);
    pageCount = extracted.pageCount;
    criteria = deriveReferenceCriteria(extracted.fullText);
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
      criteria,
    };
    store.references.push(doc);
    return doc;
  });

  return json({ reference: record }, 201);
}
