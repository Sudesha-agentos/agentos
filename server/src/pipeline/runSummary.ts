import type { ImplementationOutput, PrdOutput, QaOutput } from "../types/agents";

export type PipelineRunSummary = {
  status: "completed";
  markedCompleted: true;
  jiraKey: string;
  title: string;
  branch: string;
  prdTitle: string;
  codingSummary: string;
  filesChanged: string[];
  qaSummary: string;
  testsPassed: number | null;
  testsFailed: number | null;
  coveragePercent: number | null;
  recommendation: string | null;
  whatWasDone: string[];
};

export function buildPipelineRunSummary(input: {
  jiraKey: string;
  prd: PrdOutput;
  implementation: ImplementationOutput;
  qa: QaOutput;
  implementationBranch?: string;
  executionReport?: Record<string, unknown> | null;
}): PipelineRunSummary {
  const filesChanged = (input.implementation.codeChanges ?? [])
    .map((change) => change.filePath)
    .filter(Boolean);
  const report = input.executionReport ?? {};
  const testRun = (report.testRun ?? report.summary ?? {}) as Record<string, unknown>;
  const coverage = (report.coverageReport ?? input.qa.coverageReport ?? {}) as Record<
    string,
    unknown
  >;
  const testsPassed =
    asNumber(testRun.passed ?? testRun.passedCount) ??
    input.qa.testConductReport?.totals.passed ??
    null;
  const testsFailed =
    asNumber(testRun.failed ?? testRun.failedCount) ??
    input.qa.testConductReport?.totals.failed ??
    null;
  const coveragePercent = asNumber(coverage.coveragePercent ?? coverage.percent);
  const recommendation = asString(
    report.recommendation ?? (input.qa as { recommendation?: unknown }).recommendation
  );

  const whatWasDone = [
    `Virin produced the PRD: ${input.prd.title}.`,
    input.implementationBranch
      ? `Ananta wrote code on GitHub branch ${input.implementationBranch}.`
      : "Ananta wrote the implementation.",
    filesChanged.length
      ? `Changed ${filesChanged.length} file${filesChanged.length === 1 ? "" : "s"}.`
      : null,
    input.implementation.codingSummary || input.implementation.summary
      ? `Code: ${input.implementation.codingSummary || input.implementation.summary}`
      : null,
    input.qa.testConductReport?.headline
      ? input.qa.testConductReport.headline
      : testsPassed != null || testsFailed != null
        ? `Neel ran QA: ${testsPassed ?? 0} passed, ${testsFailed ?? 0} failed.`
        : `Neel ran QA: ${input.qa.testSummary || "test plan complete"}.`,
    recommendation
      ? `QA recommendation: ${recommendation.replace(/_/g, " ")}.`
      : null,
    "Ticket marked completed.",
  ].filter((line): line is string => Boolean(line));

  return {
    status: "completed",
    markedCompleted: true,
    jiraKey: input.jiraKey,
    title: input.prd.title,
    branch: input.implementationBranch?.trim() || "",
    prdTitle: input.prd.title,
    codingSummary:
      input.implementation.codingSummary || input.implementation.summary || "",
    filesChanged,
    qaSummary: input.qa.testSummary || "",
    testsPassed,
    testsFailed,
    coveragePercent,
    recommendation,
    whatWasDone,
  };
}

function asString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  return null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}
