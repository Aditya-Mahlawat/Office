import { NextResponse } from "next/server";

export type PdfUpload = {
  file: File;
  buffer: Buffer;
};

export type UploadError = {
  error: string;
};

export function json<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function badRequest(message: string) {
  return json({ error: message }, 400);
}

export function notFound(message = "Not found") {
  return json({ error: message }, 404);
}

export async function readPdfUpload(
  file: File | null,
  fieldName: string
): Promise<PdfUpload | UploadError> {
  if (!file) return { error: `${fieldName} is required` as const };
  if (file.type && file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return { error: "Only PDF files are supported" as const };
  }
  if (file.size > 25 * 1024 * 1024) {
    return { error: "File exceeds 25 MB limit" as const };
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.subarray(0, 4).toString() !== "%PDF") {
    return { error: "File is not a valid PDF" as const };
  }
  return { file, buffer };
}
