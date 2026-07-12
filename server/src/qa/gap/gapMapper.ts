/**
 * Change / gap mapper — ranks untested scenarios for this ticket's change surface.
 * Uses PRD criteria + changed files + existing test inventory (no Neo4j required).
 */

export interface CoverageGap {
  id: string;
  criterion: string;
  severity: "blocking" | "high" | "medium" | "low";
  reason: string;
  suggestedTestType: "unit" | "integration" | "e2e" | "security";
  relatedFiles: string[];
}

export interface TraceabilityEdge {
  requirement: string;
  codePaths: string[];
  testIds: string[];
  testFiles: string[];
  lastRunStatus?: "passed" | "failed" | "skipped" | "not_run";
}

export interface GapMapResult {
  gaps: CoverageGap[];
  edges: TraceabilityEdge[];
  changedFiles: string[];
  summary: string;
}

export interface GapMapInput {
  acceptanceCriteria: string[];
  /** Paths touched on the implementation branch */
  changedFiles: string[];
  /** Existing or newly planned test cases */
  testCases: Array<{
    id: string;
    linkedCriterion: string;
    type?: string;
    title?: string;
  }>;
  /** Paths of existing test files already in the repo */
  existingTestFiles?: string[];
  /** Optional strategic risk tags from ticket text */
  riskHints?: string[];
}

function normalize(s: string): string {
  return s
    .trim()
    .replace(/^\d+\.\s*/, "")
    .replace(/^[-*•]\s*/, "")
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function criterionCovered(
  criterion: string,
  testCases: GapMapInput["testCases"]
): boolean {
  const c = normalize(criterion);
  return testCases.some((tc) => {
    const linked = normalize(tc.linkedCriterion ?? "");
    if (!linked || !c) return false;
    return linked === c || linked.includes(c.slice(0, 40)) || c.includes(linked.slice(0, 40));
  });
}

function filesForCriterion(criterion: string, changedFiles: string[]): string[] {
  const tokens = normalize(criterion)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 4)
    .slice(0, 8);
  if (!tokens.length) return changedFiles.slice(0, 5);
  const matched = changedFiles.filter((f) => {
    const lower = f.toLowerCase();
    return tokens.some((t) => lower.includes(t));
  });
  return matched.length ? matched.slice(0, 8) : changedFiles.slice(0, 5);
}

function suggestType(
  criterion: string,
  relatedFiles: string[],
  riskHints: string[]
): CoverageGap["suggestedTestType"] {
  const hay = `${criterion} ${relatedFiles.join(" ")} ${riskHints.join(" ")}`.toLowerCase();
  if (/auth|security|permission|xss|csrf|injection/.test(hay)) return "security";
  if (/ui|button|page|click|form|browser|playwright|e2e/.test(hay)) return "e2e";
  if (/api|route|endpoint|handler|controller/.test(hay)) return "integration";
  return "unit";
}

function severityFor(
  criterion: string,
  riskHints: string[],
  index: number
): CoverageGap["severity"] {
  const hay = `${criterion} ${riskHints.join(" ")}`.toLowerCase();
  if (/must|shall|security|auth|payment|billing|cannot|block/.test(hay)) return "blocking";
  if (index < 2) return "high";
  if (/should|prefer/.test(hay)) return "medium";
  return "medium";
}

/**
 * Build ranked coverage gaps and lightweight req→code→test edges.
 */
export function mapCoverageGaps(input: GapMapInput): GapMapResult {
  const riskHints = input.riskHints ?? [];
  const changedFiles = input.changedFiles ?? [];
  const existingTestFiles = input.existingTestFiles ?? [];
  const gaps: CoverageGap[] = [];
  const edges: TraceabilityEdge[] = [];

  input.acceptanceCriteria.forEach((criterion, index) => {
    const relatedFiles = filesForCriterion(criterion, changedFiles);
    const covering = input.testCases.filter((tc) => {
      const linked = normalize(tc.linkedCriterion ?? "");
      const c = normalize(criterion);
      return linked === c || linked.includes(c.slice(0, 40)) || c.includes(linked.slice(0, 40));
    });
    const covered = covering.length > 0;

    edges.push({
      requirement: criterion,
      codePaths: relatedFiles,
      testIds: covering.map((t) => t.id),
      testFiles: existingTestFiles.filter((f) =>
        covering.some((t) => f.toLowerCase().includes(t.id.toLowerCase()))
      ),
      lastRunStatus: covered ? "not_run" : "not_run",
    });

    if (!covered) {
      gaps.push({
        id: `GAP-${String(index + 1).padStart(3, "0")}`,
        criterion,
        severity: severityFor(criterion, riskHints, index),
        reason: relatedFiles.length
          ? `No test linked to this criterion; related change surface: ${relatedFiles.slice(0, 3).join(", ")}`
          : "No test linked to this acceptance criterion on the current change.",
        suggestedTestType: suggestType(criterion, relatedFiles, riskHints),
        relatedFiles,
      });
    }
  });

  const severityRank = { blocking: 0, high: 1, medium: 2, low: 3 };
  gaps.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);

  const summary =
    gaps.length === 0
      ? `All ${input.acceptanceCriteria.length} acceptance criteria have linked tests.`
      : `${gaps.length} coverage gap(s) on this change — ${gaps.filter((g) => g.severity === "blocking").length} blocking.`;

  return { gaps, edges, changedFiles, summary };
}

/** Extract likely changed file paths from implementation output / coding summary. */
export function extractChangedFilesFromImplementation(impl: {
  targetFiles?: string[];
  codeChanges?: Array<{ path?: string; filePath?: string }>;
  codingSummary?: string;
}): string[] {
  const paths = new Set<string>();
  for (const p of impl.targetFiles ?? []) {
    if (p?.trim()) paths.add(p.trim());
  }
  for (const change of impl.codeChanges ?? []) {
    const p = change.path ?? change.filePath;
    if (p?.trim()) paths.add(p.trim());
  }
  const summary = impl.codingSummary ?? "";
  const fileMatches = summary.match(
    /(?:^|[\s`"'(])([a-zA-Z0-9_./-]+\.(?:ts|tsx|js|jsx|py|go|java|md))/g
  );
  for (const m of fileMatches ?? []) {
    const cleaned = m.replace(/^[\s`"'(]+/, "");
    if (cleaned) paths.add(cleaned);
  }
  return [...paths];
}
