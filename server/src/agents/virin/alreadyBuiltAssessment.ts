import type { CodebaseAnalysisOutput } from "./types";

export type OverlapVerdict = "already_shipped" | "partial_overlap" | "net_new";

const ALREADY_SHIPPED_FLAG_PREFIX = "Already built in codebase";

/**
 * Deterministic overlap verdict from Virin codebase analysis.
 * Used when the model omits overlapVerdict, and as a safety net when it under-flags.
 */
export function assessCodebaseOverlap(
  analysis: Pick<CodebaseAnalysisOutput, "alreadyExists" | "gapsToBuild" | "overlapVerdict">
): OverlapVerdict {
  const model = normalizeVerdict(analysis.overlapVerdict);
  if (model) return model;

  const exists = (analysis.alreadyExists ?? []).map((s) => s.trim()).filter(Boolean);
  const gaps = (analysis.gapsToBuild ?? []).map((s) => s.trim()).filter(Boolean);

  if (exists.length >= 1 && gaps.length === 0) return "already_shipped";
  if (exists.length >= 2 && gaps.length > 0 && exists.length >= gaps.length * 2) {
    return "partial_overlap";
  }
  if (exists.length >= 1 && gaps.length > 0 && exists.length >= gaps.length) {
    return "partial_overlap";
  }
  return "net_new";
}

function normalizeVerdict(raw: string | undefined | null): OverlapVerdict | null {
  if (!raw || typeof raw !== "string") return null;
  const v = raw.trim().toLowerCase().replace(/\s+/g, "_");
  if (v.includes("already_shipped") || v === "shipped" || v === "exists") {
    return "already_shipped";
  }
  if (v.includes("partial")) return "partial_overlap";
  if (v.includes("net_new") || v === "new") return "net_new";
  return null;
}

export function buildAlreadyBuiltFlag(
  analysis: CodebaseAnalysisOutput,
  verdict: OverlapVerdict
): string | null {
  if (verdict === "net_new") return null;
  const exists = (analysis.alreadyExists ?? []).slice(0, 4).join("; ");
  const gaps = (analysis.gapsToBuild ?? []).slice(0, 3).join("; ");
  if (verdict === "already_shipped") {
    return `${ALREADY_SHIPPED_FLAG_PREFIX}: ticket looks already implemented (${exists || "see codebase analysis"}). Prefer close/verify over rebuilding.`;
  }
  return `${ALREADY_SHIPPED_FLAG_PREFIX} (partial): substantial overlap (${exists}). Gaps only: ${gaps || "clarify remaining delta before engineering"}.`;
}

export function mergeOverlapIntoAnalysis(
  analysis: CodebaseAnalysisOutput
): CodebaseAnalysisOutput {
  const verdict = assessCodebaseOverlap(analysis);
  return {
    ...analysis,
    overlapVerdict: verdict,
    alreadyShippedNote:
      analysis.alreadyShippedNote?.trim() ||
      (verdict === "already_shipped"
        ? "Feature appears already present in the repo — do not rebuild; verify and close or scope a thin delta."
        : verdict === "partial_overlap"
          ? "Part of this ticket already exists — scope engineering to gapsToBuild only."
          : analysis.alreadyShippedNote),
  };
}

export function isAlreadyShipped(analysis: CodebaseAnalysisOutput | undefined | null): boolean {
  if (!analysis) return false;
  return assessCodebaseOverlap(analysis) === "already_shipped";
}
