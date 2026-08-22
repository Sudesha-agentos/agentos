const STOP = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "to",
  "of",
  "in",
  "for",
  "on",
  "with",
  "is",
  "be",
  "this",
  "that",
  "as",
  "by",
  "at",
  "from",
  "it",
  "we",
  "user",
  "users",
  "should",
  "must",
  "will",
  "can",
  "into",
  "via",
  "using",
  "also",
  "not",
  "are",
  "was",
  "were",
  "have",
  "has",
  "been",
  "given",
  "when",
  "then",
]);

export function significantTokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length > 2 && !STOP.has(word))
  );
}

export function tokenOverlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const token of a) {
    if (b.has(token)) inter += 1;
  }
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

export function splitUnits(text: string): string[] {
  return text
    .split(/(?<=[.!?\n])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 16);
}
