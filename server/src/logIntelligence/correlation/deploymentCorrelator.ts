import { prisma } from "../../db/client";

export type DeploymentCorrelation = {
  pipelineId: string | null;
  jiraKey: string | null;
  sha: string | null;
  confidence: "high" | "medium" | "low";
};

/**
 * Correlate a log entry to CommitHistory via deploymentId (git SHA) or timestamp.
 */
export async function correlateDeployment(input: {
  organizationId: string;
  deploymentId?: string | null;
  timestamp: Date;
}): Promise<DeploymentCorrelation> {
  const dep = input.deploymentId?.trim();

  if (dep && dep.length >= 7) {
    const exact = await prisma.commitHistory.findFirst({
      where: {
        organizationId: input.organizationId,
        OR: [
          { sha: dep },
          { sha: { startsWith: dep.slice(0, 40) } },
        ],
      },
      orderBy: { authoredAt: "desc" },
    });
    if (exact) {
      return {
        pipelineId: exact.pipelineId,
        jiraKey: exact.jiraKey,
        sha: exact.sha,
        confidence: "high",
      };
    }

    // Prefix match for short SHAs
    const prefix = await prisma.commitHistory.findFirst({
      where: {
        organizationId: input.organizationId,
        sha: { startsWith: dep.slice(0, 7) },
      },
      orderBy: { authoredAt: "desc" },
    });
    if (prefix) {
      return {
        pipelineId: prefix.pipelineId,
        jiraKey: prefix.jiraKey,
        sha: prefix.sha,
        confidence: "medium",
      };
    }
  }

  // Probabilistic: most recent commit before log timestamp
  const nearest = await prisma.commitHistory.findFirst({
    where: {
      organizationId: input.organizationId,
      authoredAt: { lte: input.timestamp },
      pipelineId: { not: null },
    },
    orderBy: { authoredAt: "desc" },
  });

  if (nearest) {
    return {
      pipelineId: nearest.pipelineId,
      jiraKey: nearest.jiraKey,
      sha: nearest.sha,
      confidence: "low",
    };
  }

  return {
    pipelineId: null,
    jiraKey: null,
    sha: null,
    confidence: "low",
  };
}
