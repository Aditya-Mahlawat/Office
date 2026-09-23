import { extractText, extractTextItems, getDocumentProxy } from "unpdf";
import { jaccard, tokenize } from "./similarity";

export type TextItemLayout = {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
  pageWidth: number;
  pageHeight: number;
};

export type PageExtract = {
  page: number;
  width: number;
  height: number;
  text: string;
  items: TextItemLayout[];
  imageCount: number;
};

export type DocumentExtract = {
  pageCount: number;
  pages: PageExtract[];
  fullText: string;
  hasSelectableText: boolean;
  imageCount: number;
  topBandText: string;
  bottomBandText: string;
};

export async function extractPdf(buffer: Buffer): Promise<DocumentExtract> {
  const data = new Uint8Array(buffer);
  const doc = await getDocumentProxy(data);
  const [{ text: pageTexts }, { items: pageItems }] = await Promise.all([
    extractText(doc, { mergePages: false }),
    extractTextItems(doc),
  ]);

  const pages: PageExtract[] = [];
  for (let i = 1; i <= doc.numPages; i += 1) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 1 });
    let imageCount = 0;
    try {
      const ops = await page.getOperatorList();
      const fns = pdfjsNames(ops.fnArray);
      for (const fn of fns) {
        if (fn === 85 || fn === 82 || fn === 83) imageCount += 1;
      }
    } catch {
      imageCount = 0;
    }

    const structured = pageItems[i - 1] ?? [];
    const items: TextItemLayout[] = structured.map((it) => ({
      text: it.str,
      x: it.x,
      y: it.y,
      width: it.width,
      height: it.height,
      page: i,
      pageWidth: viewport.width,
      pageHeight: viewport.height,
    }));

    const text = (pageTexts[i - 1] || items.map((x) => x.text).join(" ")).replace(/\s+/g, " ").trim();
    pages.push({
      page: i,
      width: viewport.width,
      height: viewport.height,
      text,
      items,
      imageCount,
    });
  }

  const fullText = pages.map((p) => p.text).join("\n");
  const selectableChars = fullText.replace(/\s/g, "").length;
  const first = pages[0];
  const last = pages[pages.length - 1];

  return {
    pageCount: doc.numPages,
    pages,
    fullText,
    hasSelectableText: selectableChars >= 40,
    imageCount: pages.reduce((s, p) => s + p.imageCount, 0),
    topBandText: bandText(first, 0.78, 1),
    bottomBandText: bandText(last, 0, 0.28),
  };
}

function pdfjsNames(fnArray: unknown): number[] {
  if (Array.isArray(fnArray)) return fnArray as number[];
  return [];
}

function bandText(page: PageExtract | undefined, yMinRatio: number, yMaxRatio: number): string {
  if (!page) return "";
  return page.items
    .filter((it) => {
      const ratio = it.y / page.height;
      return ratio >= yMinRatio && ratio <= yMaxRatio;
    })
    .map((it) => it.text)
    .join(" ");
}

export function detectSections(text: string, expected: string[]): string[] {
  const found: string[] = [];
  const lower = text.toLowerCase();
  for (const section of expected) {
    if (lower.includes(section.toLowerCase())) found.push(section);
  }
  const headingLike = text
    .split(/[\n.]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 3 && s.length < 60 && /^[A-Z][A-Za-z0-9 &/()-]{3,}$/.test(s));
  return Array.from(new Set([...found, ...headingLike.slice(0, 12)]));
}

export function fieldPresence(text: string, fields: string[]): { present: string[]; missing: string[] } {
  const present: string[] = [];
  const missing: string[] = [];
  const hay = text.toLowerCase();
  for (const field of fields) {
    const key = field.toLowerCase();
    const variants = [key, `${key}:`, `${key} :`, key.replace(/\s+/g, "")];
    if (variants.some((v) => hay.includes(v))) present.push(field);
    else missing.push(field);
  }
  return { present, missing };
}

const SIGNATURE_HINTS = [
  "signature",
  "signed",
  "signatory",
  "authorised signatory",
  "authorized signatory",
  "digitally signed",
];

const STAMP_HINTS = ["stamp", "seal", "official seal", "rubber stamp", "company seal"];

export function hintScore(text: string, imageCount: number, hints: string[], imageBoost: number): {
  score: number;
  detected: boolean;
  reason: string;
} {
  const hay = text.toLowerCase();
  const hit = hints.find((h) => hay.includes(h));
  if (hit && imageCount > 0) {
    return { score: 100, detected: true, reason: `Found “${hit}” and embedded image objects.` };
  }
  if (hit) {
    return { score: 82, detected: true, reason: `Found label “${hit}” (no nearby image object confirmed).` };
  }
  if (imageCount >= imageBoost) {
    return { score: 70, detected: true, reason: "Image objects present in expected region; visual model not connected." };
  }
  return { score: 18, detected: false, reason: "No matching label or image object in the expected region." };
}

export function signatureAnalysis(extract: DocumentExtract) {
  const last = extract.pages[extract.pages.length - 1];
  const regionImages = last ? last.imageCount : 0;
  return hintScore(`${extract.bottomBandText} ${extract.fullText}`, regionImages, SIGNATURE_HINTS, 1);
}

export function stampAnalysis(extract: DocumentExtract) {
  return hintScore(extract.fullText, extract.imageCount, STAMP_HINTS, 2);
}

export function letterheadAnalysis(ref: DocumentExtract, uploaded: DocumentExtract) {
  const refTop = ref.topBandText;
  const upTop = uploaded.topBandText;
  const refHasImage = (ref.pages[0]?.imageCount ?? 0) > 0;
  const upHasImage = (uploaded.pages[0]?.imageCount ?? 0) > 0;
  const textScore = jaccard(tokenize(refTop), tokenize(upTop));
  let score = textScore;
  if (refHasImage && upHasImage) score = Math.max(score, 78);
  if (refHasImage && !upHasImage) score = Math.min(score, 55);
  if (!refTop.trim() && !upTop.trim() && upHasImage) score = 72;
  return {
    score: Math.max(0, Math.min(100, score)),
    detected: score >= 55,
    reason:
      refHasImage && !upHasImage
        ? "Reference letterhead appears image-based; uploaded top band has no similar image object."
        : `Top-of-page text similarity ${textScore}%.`,
  };
}

export function layoutScore(ref: DocumentExtract, uploaded: DocumentExtract): {
  score: number;
  notes: string[];
} {
  const notes: string[] = [];
  let score = 100;
  if (ref.pageCount !== uploaded.pageCount) {
    score -= Math.min(40, Math.abs(ref.pageCount - uploaded.pageCount) * 18);
    notes.push(
      `Page count differs (reference ${ref.pageCount}, uploaded ${uploaded.pageCount}).`
    );
  }

  const n = Math.min(ref.pages.length, uploaded.pages.length);
  let marginDelta = 0;
  for (let i = 0; i < n; i += 1) {
    const r = ref.pages[i];
    const u = uploaded.pages[i];
    const rMargin = averageMargins(r);
    const uMargin = averageMargins(u);
    marginDelta += Math.abs(rMargin.left - uMargin.left) + Math.abs(rMargin.top - uMargin.top);
    const aspectR = r.width / r.height;
    const aspectU = u.width / u.height;
    if (Math.abs(aspectR - aspectU) > 0.08) {
      score -= 8;
      notes.push(`Page ${i + 1} aspect ratio differs (scan/scale variation possible).`);
    }
  }
  if (n > 0) {
    const avgMargin = marginDelta / n;
    if (avgMargin > 40) {
      score -= 12;
      notes.push("Margin / alignment variation relative to the reference.");
    } else if (avgMargin > 18) {
      score -= 5;
      notes.push("Slight margin or alignment difference.");
    }
  }

  const itemDelta = Math.abs(countItems(ref) - countItems(uploaded));
  if (itemDelta > 80) {
    score -= 10;
    notes.push("Text block density differs substantially from the template.");
  }

  return { score: Math.max(35, Math.round(score)), notes };
}

function countItems(doc: DocumentExtract) {
  return doc.pages.reduce((s, p) => s + p.items.length, 0);
}

function averageMargins(page: PageExtract) {
  if (page.items.length === 0) return { left: 0, top: 0 };
  const xs = page.items.map((i) => i.x);
  const ys = page.items.map((i) => i.y);
  return {
    left: Math.min(...xs),
    top: page.height - Math.max(...ys),
  };
}
