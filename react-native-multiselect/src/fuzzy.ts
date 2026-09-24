export type Range = [start: number, end: number];

export interface FuzzyResult {
  score: number;
  /** Matched character ranges in the searched text (end exclusive). */
  ranges: Range[];
}

const BOUNDARY = /[\s\-_/.&]/;

const isBoundary = (text: string, i: number) =>
  i === 0 || BOUNDARY.test(text[i - 1]);

/**
 * Lightweight fuzzy matcher. Contiguous substrings win, word-boundary hits get a
 * bonus, and scattered subsequences ("jvs" -> "JavaScript") still match.
 */
export function fuzzyMatch(query: string, text: string): FuzzyResult | null {
  const q = query.trim().toLowerCase();
  if (!q) return { score: 0, ranges: [] };
  const t = text.toLowerCase();

  const idx = t.indexOf(q);
  if (idx !== -1) {
    const score =
      1000 - idx - (t.length - q.length) + (isBoundary(t, idx) ? 500 : 0);
    return { score, ranges: [[idx, idx + q.length]] };
  }

  const ranges: Range[] = [];
  let score = 0;
  let from = 0;
  let prev = -2;
  for (const ch of q) {
    if (ch === ' ') continue;
    const found = t.indexOf(ch, from);
    if (found === -1) return null;
    if (found === prev + 1 && ranges.length) {
      ranges[ranges.length - 1][1] = found + 1;
      score += 15;
    } else {
      ranges.push([found, found + 1]);
      score -= found - from;
    }
    if (isBoundary(t, found)) score += 10;
    prev = found;
    from = found + 1;
  }
  return { score, ranges };
}
