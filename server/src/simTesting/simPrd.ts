import type { PrdOutput } from "../types/agents";

function asList(value: unknown): string[] {
  if (value == null) return [];
  if (typeof value === "string") return value.trim() ? [value.trim()] : [];
  if (!Array.isArray(value)) return [String(value)];
  const out: string[] = [];
  for (const item of value) {
    if (item == null) continue;
    if (typeof item === "string") {
      if (item.trim()) out.push(item.trim());
      continue;
    }
    if (typeof item === "object") {
      const rec = item as Record<string, unknown>;
      const text =
        rec.story ?? rec.question ?? rec.criterion ?? rec.title ?? rec.metric ?? rec.risk ?? rec.need;
      if (typeof text === "string" && text.trim()) out.push(text.trim());
    }
  }
  return out;
}

function flattenCriteria(raw: Record<string, unknown>): string[] {
  const direct = asList(raw.acceptanceCriteria);
  if (direct.length) return direct;
  if (!Array.isArray(raw.userStories)) return [];
  return raw.userStories.flatMap((story) => {
    if (story && typeof story === "object") {
      return asList((story as { acceptanceCriteria?: unknown }).acceptanceCriteria);
    }
    return [];
  });
}

function asScore(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0.75;
  if (n > 1 && n <= 100) return n / 100;
  return Math.min(1, Math.max(0, n));
}

export function normalizeSimPrd(raw: unknown, requirement: string): PrdOutput {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const title =
    typeof obj.title === "string" && obj.title.trim()
      ? obj.title.trim()
      : requirement.trim().slice(0, 80) || "Sim PRD";
  const acceptanceCriteria = flattenCriteria(obj);
  const userStories = asList(obj.userStories);
  return {
    title,
    problemStatement:
      typeof obj.problemStatement === "string" && obj.problemStatement.trim()
        ? obj.problemStatement.trim()
        : requirement.trim(),
    proposedSolution:
      typeof obj.proposedSolution === "string" && obj.proposedSolution.trim()
        ? obj.proposedSolution.trim()
        : "Implement the requested behavior in the connected repo.",
    userStories: userStories.length ? userStories : [requirement.trim()],
    acceptanceCriteria: acceptanceCriteria.length
      ? acceptanceCriteria
      : [
          "Happy path works as specified in the requirement",
          "Invalid input is rejected with a clear error",
          "Existing tests keep passing",
        ],
    outOfScope: asList(obj.outOfScope),
    edgeCases: asList(obj.edgeCases),
    dependencies: asList(obj.dependencies),
    successMetrics: asList(obj.successMetrics),
    openQuestions: asList(obj.openQuestions),
    confidenceScore: asScore(obj.confidenceScore),
    confidenceReason:
      typeof obj.confidenceReason === "string" && obj.confidenceReason.trim()
        ? obj.confidenceReason.trim()
        : "Normalized from Virin sim output",
  };
}
