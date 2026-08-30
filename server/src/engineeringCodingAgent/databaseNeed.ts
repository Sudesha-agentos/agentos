import type { GeneratedPRD } from "../prd/prdGenerator";
import type { ImplementationOutput, PrdOutput } from "../types/agents";

export function ticketNeedsDatabase(
  prd: PrdOutput,
  implementation?: ImplementationOutput | null,
  generatedPrd?: GeneratedPRD | null
): boolean {
  if ((implementation?.databaseChanges ?? []).some((item) => String(item).trim())) {
    return true;
  }
  const haystack = [
    prd.problemStatement,
    prd.proposedSolution,
    ...(prd.acceptanceCriteria ?? []),
    ...(prd.userStories ?? []),
    generatedPrd?.implementationDeltaSummary,
    ...(generatedPrd?.netNewWork ?? []),
    ...(generatedPrd?.technicalRequirements?.systemsAffected ?? []),
  ]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();
  return /\b(database|db schema|migration|postgres|mysql|sql table|prisma)\b/.test(haystack);
}
