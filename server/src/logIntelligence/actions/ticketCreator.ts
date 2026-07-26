import { prisma } from "../../db/client";
import { getPipelineJiraClient } from "../../pipeline/jira/client";
import { logger } from "../../utils/logger";

function priorityForSeverity(severity: string): string {
  if (severity === "critical") return "Highest";
  if (severity === "high") return "High";
  if (severity === "medium") return "Medium";
  return "Low";
}

export async function createBugTicketForAnomaly(anomalyId: string): Promise<string | null> {
  const anomaly = await prisma.anomalyDetection.findUnique({
    where: { id: anomalyId },
    include: { pattern: true },
  });
  if (!anomaly || anomaly.jiraTicketCreated) return anomaly?.bugJiraKey ?? null;

  const config = await prisma.logIntelligenceConfig.findUnique({
    where: { organizationId: anomaly.organizationId },
  });
  if (config && !config.autoCreateJiraOnCritical) return null;
  if (!["critical", "high"].includes(anomaly.severity)) return null;

  const pattern = anomaly.pattern;
  let client: ReturnType<typeof getPipelineJiraClient>;
  try {
    client = getPipelineJiraClient();
  } catch {
    logger.warn("log-intelligence Jira bug skipped — Jira not configured");
    return null;
  }

  const service =
    anomaly.affectedService ||
    (Array.isArray(pattern?.affectedServices)
      ? String(pattern?.affectedServices[0] ?? "unknown")
      : "unknown");
  const env = anomaly.environment ?? "production";
  const errorType = pattern?.errorType ?? anomaly.anomalyType;

  const labels = ["log-intelligence", "production-bug"];
  if (pattern?.isQaGap) labels.push("qa-gap");

  const description = [
    `*Error Pattern:* ${pattern?.messageTemplate ?? anomaly.description}`,
    `*First Seen:* ${pattern?.firstSeen?.toISOString() ?? anomaly.detectedAt.toISOString()}`,
    `*Occurrences:* ${pattern?.occurrenceCount ?? "n/a"}`,
    `*Affected:* ${JSON.stringify(pattern?.affectedEndpoints ?? [])}`,
    "",
    "*Root Cause Analysis:*",
    pattern?.rootCauseHypothesis ?? anomaly.aiAnalysis ?? "Pending analysis",
    "",
    "*Remediation Steps:*",
    pattern?.remediationSteps ?? "See root cause analysis",
    "",
    `*Related Pipeline:* ${pattern?.jiraKey ?? "n/a"}`,
    `*Is QA Gap:* ${pattern?.isQaGap ? "Yes" : "No"}`,
    pattern?.qaGapReason ? `*QA Gap Reason:* ${pattern.qaGapReason}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const created = await client.createIssue({
      summary: `[BUG] ${errorType} in ${service} — ${env}`,
      description,
      issueType: "Bug",
      labels,
      priority: priorityForSeverity(anomaly.severity),
    });

    if (!created?.key) return null;

    await prisma.anomalyDetection.update({
      where: { id: anomalyId },
      data: {
        jiraTicketCreated: true,
        bugJiraKey: created.key,
      },
    });

    if (pattern) {
      await prisma.errorPattern.update({
        where: { id: pattern.id },
        data: { bugJiraKey: created.key },
      });
    }

    // Comment on original ticket when correlated
    if (pattern?.jiraKey) {
      try {
        await client.addPlainTextComment(
          pattern.jiraKey,
          `Production error detected from this feature.\nBug ticket: ${created.key}`
        );
      } catch {
        /* non-fatal */
      }
    }

    logger.info(
      { anomalyId, bugKey: created.key },
      "log-intelligence Jira bug created"
    );
    return created.key;
  } catch (err) {
    logger.warn({ err, anomalyId }, "log-intelligence Jira bug failed");
    return null;
  }
}
