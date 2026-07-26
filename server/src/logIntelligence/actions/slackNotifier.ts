import { prisma } from "../../db/client";
import { frontendBaseUrl } from "../../shared/frontendUrls";
import { logger } from "../../utils/logger";

export async function notifySlackForAnomaly(anomalyId: string): Promise<boolean> {
  const webhook = process.env.SLACK_WEBHOOK_URL?.trim();
  if (!webhook) return false;

  const anomaly = await prisma.anomalyDetection.findUnique({
    where: { id: anomalyId },
    include: { pattern: true },
  });
  if (!anomaly || anomaly.slackNotified) return false;

  const config = await prisma.logIntelligenceConfig.findUnique({
    where: { organizationId: anomaly.organizationId },
  });
  if (config && !config.autoNotifySlack) return false;

  const pattern = anomaly.pattern;
  const isCritical = anomaly.severity === "critical";
  const header = isCritical
    ? "🔴 Production Error Detected"
    : "🟡 New Error Pattern";
  const base = frontendBaseUrl() || "https://agentox.io";
  const patternUrl = pattern
    ? `${base}/logs/patterns/${pattern.id}`
    : `${base}/logs`;

  const fields = [
    `*Error Type:* ${pattern?.errorType ?? anomaly.anomalyType}`,
    `*Service:* ${anomaly.affectedService ?? "unknown"}`,
    `*Environment:* ${anomaly.environment ?? "production"}`,
    `*Occurrences:* ${pattern?.occurrenceCount ?? "n/a"}`,
  ];
  if (pattern?.jiraKey) {
    fields.push(`*Related Feature:* ${pattern.jiraKey}`);
  }
  if (pattern?.pipelineId) {
    fields.push(`*Pipeline Run:* ${pattern.pipelineId}`);
  }
  if (pattern?.isQaGap) {
    fields.push("*Is QA Gap:* Yes — this was not covered in QA run");
  }

  const rca = (pattern?.rootCauseHypothesis ?? "").slice(0, 200);

  const body = {
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: header, emoji: true },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: fields.join("\n"),
        },
      },
      ...(rca
        ? [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `*Root cause:* ${rca}`,
              },
            },
          ]
        : []),
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "View in Dashboard" },
            url: patternUrl,
          },
          ...(pattern?.bugJiraKey || anomaly.bugJiraKey
            ? [
                {
                  type: "button",
                  text: { type: "plain_text", text: "View Bug Ticket" },
                  url: `https://jira.atlassian.net/browse/${pattern?.bugJiraKey ?? anomaly.bugJiraKey}`,
                },
              ]
            : []),
        ],
      },
    ],
  };

  try {
    const res = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      logger.warn(
        { status: res.status, anomalyId },
        "slack notify failed"
      );
      return false;
    }
    await prisma.anomalyDetection.update({
      where: { id: anomalyId },
      data: { slackNotified: true },
    });
    return true;
  } catch (err) {
    logger.warn({ err, anomalyId }, "slack notify error");
    return false;
  }
}
