/**
 * Light self-healing for e2e locators — multi-attribute fingerprints + confidence.
 * Heals are proposed for human review (merge-request style), never silent.
 */

export interface LocatorFingerprint {
  id?: string;
  name?: string;
  css?: string;
  xpath?: string;
  text?: string;
  role?: string;
  /** Stable neighbor hints */
  nearText?: string[];
}

export interface HealProposal {
  testFile: string;
  testName: string;
  oldPrimary: string;
  proposedPrimary: string;
  fingerprint: LocatorFingerprint;
  confidence: number;
  strategy: "attribute_majority" | "relative_neighbor" | "text_label" | "none";
  requiresHumanReview: boolean;
  rationale: string;
}

const AUTO_HEAL_THRESHOLD = 0.8;

/**
 * Score how well a candidate element matches a stored fingerprint.
 * Pure function — callers supply candidate attributes from the DOM snapshot.
 */
export function scoreLocatorMatch(
  fingerprint: LocatorFingerprint,
  candidate: LocatorFingerprint
): { score: number; matched: string[] } {
  const matched: string[] = [];
  let hits = 0;
  let total = 0;

  const checks: Array<[keyof LocatorFingerprint, number]> = [
    ["id", 0.3],
    ["name", 0.15],
    ["role", 0.15],
    ["text", 0.2],
    ["css", 0.1],
    ["xpath", 0.1],
  ];

  for (const [key, weight] of checks) {
    const expected = fingerprint[key];
    if (typeof expected !== "string" || !expected) continue;
    total += weight;
    const actual = candidate[key];
    if (typeof actual === "string" && actual && actual === expected) {
      hits += weight;
      matched.push(key);
    } else if (
      typeof actual === "string" &&
      typeof expected === "string" &&
      (actual.includes(expected) || expected.includes(actual))
    ) {
      hits += weight * 0.5;
      matched.push(`${key}~`);
    }
  }

  const score = total > 0 ? hits / total : 0;
  return { score: Number(score.toFixed(3)), matched };
}

export function proposeLocatorHeal(input: {
  testFile: string;
  testName: string;
  oldPrimary: string;
  fingerprint: LocatorFingerprint;
  candidates: LocatorFingerprint[];
}): HealProposal {
  let best: { candidate: LocatorFingerprint; score: number; matched: string[] } | null =
    null;

  for (const candidate of input.candidates) {
    const result = scoreLocatorMatch(input.fingerprint, candidate);
    if (!best || result.score > best.score) {
      best = { candidate, score: result.score, matched: result.matched };
    }
  }

  if (!best || best.score < 0.4) {
    return {
      testFile: input.testFile,
      testName: input.testName,
      oldPrimary: input.oldPrimary,
      proposedPrimary: input.oldPrimary,
      fingerprint: input.fingerprint,
      confidence: best?.score ?? 0,
      strategy: "none",
      requiresHumanReview: true,
      rationale: "No candidate matched fingerprint above minimum threshold — fail for human triage.",
    };
  }

  const proposed =
    best.candidate.css ||
    best.candidate.id ||
    best.candidate.role ||
    best.candidate.text ||
    input.oldPrimary;

  const strategy: HealProposal["strategy"] =
    best.matched.includes("id") || best.matched.includes("css")
      ? "attribute_majority"
      : best.matched.some((m) => m.startsWith("text"))
        ? "text_label"
        : "relative_neighbor";

  return {
    testFile: input.testFile,
    testName: input.testName,
    oldPrimary: input.oldPrimary,
    proposedPrimary: proposed,
    fingerprint: input.fingerprint,
    confidence: best.score,
    strategy,
    requiresHumanReview: best.score < AUTO_HEAL_THRESHOLD,
    rationale: `Matched on ${best.matched.join(", ") || "partial attributes"} (score ${best.score}). ${
      best.score >= AUTO_HEAL_THRESHOLD
        ? "Above auto-heal threshold — still logged for review/rollback."
        : "Below auto-heal threshold — human must approve."
    }`,
  };
}

/** Build a fingerprint from common Playwright/CSS attributes at authoring time. */
export function buildFingerprint(attrs: Partial<LocatorFingerprint>): LocatorFingerprint {
  return {
    id: attrs.id,
    name: attrs.name,
    css: attrs.css,
    xpath: attrs.xpath,
    text: attrs.text,
    role: attrs.role,
    nearText: attrs.nearText?.slice(0, 3),
  };
}
