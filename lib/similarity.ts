export function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(input: string): string[] {
  const n = normalizeText(input);
  return n ? n.split(" ") : [];
}

export function jaccard(a: string[], b: string[]): number {
  const sa = new Set(a);
  const sb = new Set(b);
  if (sa.size === 0 && sb.size === 0) return 100;
  if (sa.size === 0 || sb.size === 0) return 0;
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter += 1;
  const union = sa.size + sb.size - inter;
  return Math.round((inter / union) * 100);
}

export function coverage(required: string[], haystack: string): number {
  if (required.length === 0) return 100;
  const h = normalizeText(haystack);
  const found = required.filter((r) => h.includes(normalizeText(r))).length;
  return Math.round((found / required.length) * 100);
}

export function sequenceSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 100;
  if (a.length === 0 || b.length === 0) return 0;
  const na = a.map(normalizeText);
  const nb = b.map(normalizeText);
  let match = 0;
  const used = new Set<number>();
  for (const item of na) {
    const idx = nb.findIndex((x, i) => x === item && !used.has(i));
    if (idx >= 0) {
      used.add(idx);
      match += 1;
    }
  }
  return Math.round((match / Math.max(na.length, nb.length)) * 100);
}

export function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(n)));
}

export function weightedScore(scores: Record<string, number>, weights: Record<string, number>): number {
  let totalW = 0;
  let acc = 0;
  for (const key of Object.keys(weights)) {
    const w = weights[key] ?? 0;
    totalW += w;
    acc += (scores[key] ?? 0) * w;
  }
  if (totalW <= 0) return 0;
  return clamp(acc / totalW);
}
