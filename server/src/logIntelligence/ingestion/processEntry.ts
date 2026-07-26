import { prisma } from "../../db/client";
import { finaliseNormalisedEntry } from "./normaliser";
import type { NormalizedLogEntry } from "./schema";
import { upsertErrorPattern } from "../intelligence/patternDetector";
import { correlateDeployment } from "../correlation/deploymentCorrelator";
import { detectQaGap } from "../correlation/qaGapDetector";
import { createBugTicketForAnomaly } from "../actions/ticketCreator";
import { notifySlackForAnomaly } from "../actions/slackNotifier";
import { feedCanaryHypothesisLibrary } from "../actions/canaryFeedback";

const recentDedupe = new Map<string, number>();

function seenRecently(key: string): boolean {
  const now = Date.now();
  const prev = recentDedupe.get(key);
  if (prev && now - prev < 120_000) return true;
  recentDedupe.set(key, now);
  if (recentDedupe.size > 5000) {
    for (const [k, t] of recentDedupe) {
      if (now - t > 300_000) recentDedupe.delete(k);
    }
  }
  return false;
}

export async function processNormalisedEntry(input: {
  organizationId: string;
  entry: NormalizedLogEntry;
  runActions?: boolean;
}): Promise<{ entryId: string; patternHash: string; isNewPattern: boolean } | null> {
  const entry = finaliseNormalisedEntry(input.entry);
  const dedupe = [
    entry.sourceId,
    entry.timestamp.toISOString(),
    entry.serviceName,
    entry.stackTraceHash ?? entry.message.slice(0, 200),
  ].join("|");
  if (seenRecently(dedupe)) return null;

  // DB-level soft dedupe
  const existing = await prisma.logEntry.findFirst({
    where: {
      sourceId: entry.sourceId,
      timestamp: entry.timestamp,
      serviceName: entry.serviceName,
      message: entry.message.slice(0, 500),
    },
  });
  if (existing) return null;

  const corr = await correlateDeployment({
    organizationId: input.organizationId,
    deploymentId: entry.deploymentId,
    timestamp: entry.timestamp,
  });

  const pattern = await upsertErrorPattern({
    organizationId: input.organizationId,
    entry,
    pipelineId: corr.pipelineId,
    jiraKey: corr.jiraKey,
  });

  const created = await prisma.logEntry.create({
    data: {
      sourceId: entry.sourceId,
      timestamp: entry.timestamp,
      severity: entry.severity,
      message: entry.message,
      errorType: entry.errorType,
      stackTrace: entry.stackTrace,
      httpStatus: entry.httpStatus,
      endpoint: entry.endpoint,
      userId: entry.userId,
      deploymentId: entry.deploymentId ?? corr.sha,
      environment: entry.environment,
      serviceName: entry.serviceName,
      rawPayload: entry.rawPayload as object,
      pipelineId: corr.pipelineId,
      jiraKey: corr.jiraKey,
      correlationConfidence: corr.confidence,
      patternHash: pattern.patternHash,
    },
  });

  if (pattern.isNew || corr.pipelineId) {
    await detectQaGap(pattern.patternId);
  }

  if (input.runActions !== false && pattern.isNew) {
    const refreshed = await prisma.errorPattern.findUnique({
      where: { id: pattern.patternId },
    });
    if (refreshed?.isQaGap) {
      await feedCanaryHypothesisLibrary(pattern.patternId);
    }
  }

  return {
    entryId: created.id,
    patternHash: pattern.patternHash,
    isNewPattern: pattern.isNew,
  };
}

export async function dispatchAnomalyActions(
  organizationId: string
): Promise<void> {
  const recent = await prisma.anomalyDetection.findMany({
    where: {
      organizationId,
      detectedAt: { gte: new Date(Date.now() - 30 * 60 * 1000) },
      OR: [
        { jiraTicketCreated: false },
        { slackNotified: false },
        { canaryNotified: false },
      ],
    },
    take: 20,
    orderBy: { detectedAt: "desc" },
  });

  for (const a of recent) {
    if (["critical", "high"].includes(a.severity) && !a.jiraTicketCreated) {
      await createBugTicketForAnomaly(a.id);
    }
    if (!a.slackNotified) {
      await notifySlackForAnomaly(a.id);
    }
    if (a.patternId && !a.canaryNotified) {
      await feedCanaryHypothesisLibrary(a.patternId);
    }
  }
}
