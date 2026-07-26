import { prisma } from "../../db/client";

export type PipelineCorrelationContext = {
  pipelineId: string;
  jiraKey: string | null;
  acceptanceCriteria: string[];
  userStories: string[];
  changedFiles: string[];
  qaCoverageSummary: string;
  uncoveredCriteria: string[];
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(String).filter(Boolean);
}

export async function loadPipelineCorrelationContext(
  pipelineId: string
): Promise<PipelineCorrelationContext | null> {
  const pipeline = await prisma.pipeline.findUnique({
    where: { id: pipelineId },
    include: {
      ticket: true,
      stages: { orderBy: { startedAt: "asc" } },
    },
  });
  if (!pipeline) return null;

  let acceptanceCriteria: string[] = [];
  let userStories: string[] = [];
  let qaCoverageSummary = "Not tested";
  let uncoveredCriteria: string[] = [];
  const changedFiles: string[] = [];

  for (const stage of pipeline.stages) {
    const output = asRecord(stage.output);
    if (
      stage.stage === "PRODUCT_AGENT" ||
      stage.stage === "PRD_VALIDATION"
    ) {
      const prd = asRecord(output.prd ?? output);
      const ac = asStringArray(prd.acceptanceCriteria);
      const stories = asStringArray(prd.userStories);
      if (ac.length) acceptanceCriteria = ac;
      if (stories.length) userStories = stories;
    }
    if (stage.stage === "ENGINEERING_AGENT" || stage.stage === "IMPLEMENTATION_VALIDATION") {
      const files = asStringArray(
        output.filesChanged ?? output.changedFiles ?? output.files
      );
      changedFiles.push(...files);
    }
    if (stage.stage === "QA_AGENT" || stage.stage === "QA_VALIDATION") {
      const coverage = asRecord(output.coverageReport ?? output);
      const covered = asStringArray(coverage.coveredCriteria);
      const uncovered = asStringArray(
        coverage.uncoveredCriteria ?? coverage.trulyUncovered
      );
      uncoveredCriteria = uncovered;
      const total =
        Number(coverage.totalCriteria ?? acceptanceCriteria.length) ||
        acceptanceCriteria.length;
      qaCoverageSummary = `covered=${covered.length}/${total}; uncovered=${uncovered.length}`;
    }
  }

  // Also pull files from CommitHistory
  const commits = await prisma.commitHistory.findMany({
    where: { pipelineId },
    take: 20,
  });
  for (const c of commits) {
    changedFiles.push(
      ...asStringArray(c.filesAdded),
      ...asStringArray(c.filesModified)
    );
  }

  return {
    pipelineId,
    jiraKey: pipeline.ticket?.jiraKey ?? null,
    acceptanceCriteria,
    userStories,
    changedFiles: [...new Set(changedFiles)].slice(0, 100),
    qaCoverageSummary,
    uncoveredCriteria,
  };
}
