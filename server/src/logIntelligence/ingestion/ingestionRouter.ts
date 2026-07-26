/**
 * Scheduled pull orchestration for all active LogSources.
 */

import { prisma } from "../../db/client";
import { decryptSourceConfig } from "../crypto/sourceSecrets";
import { getAdapter } from "../adapters/registry";
import { processNormalisedEntry, dispatchAnomalyActions } from "./processEntry";
import { runAnomalyDetection } from "../intelligence/anomalyDetector";
import { runPendingRootCauseAnalysis } from "../intelligence/rootCauseEngine";
import { correlateDeployment } from "../correlation/deploymentCorrelator";
import type { LogSeverityLevel } from "./schema";
import { logger } from "../../utils/logger";

function maxEntries(): number {
  return Number(process.env.LOG_MAX_ENTRIES_PER_CYCLE ?? 500) || 500;
}

export async function pullSingleSource(
  sourceId: string
): Promise<{ processed: number; error?: string }> {
  const source = await prisma.logSource.findUnique({ where: { id: sourceId } });
  if (!source || !source.isActive) {
    return { processed: 0, error: "source_not_found" };
  }

  const until = new Date();
  try {
    const adapter = getAdapter(source.sourceType);
    const config = decryptSourceConfig(source.config);
    const since =
      source.lastPulledAt ?? new Date(until.getTime() - 15 * 60 * 1000);
    const limit = Math.min(100, maxEntries());

    // Push-only adapters throw on pull — treat as success with zero rows
    let entries;
    try {
      entries = await adapter.pull({
        config,
        since,
        until,
        severityFilter: ["error", "fatal", "warn"],
        limit,
        sourceId: source.id,
        environment: String(config.environment ?? "production"),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("otlp_use_http_ingest") || msg.includes("not_implemented")) {
        await prisma.logSource.update({
          where: { id: source.id },
          data: {
            lastPullStatus: "ok",
            lastError: null,
            lastErrorAt: null,
          },
        });
        return { processed: 0 };
      }
      throw err;
    }

    let processed = 0;
    for (const entry of entries) {
      const result = await processNormalisedEntry({
        organizationId: source.organizationId,
        entry: { ...entry, sourceId: source.id },
      });
      if (result) processed += 1;
    }

    await prisma.logSource.update({
      where: { id: source.id },
      data: {
        lastPulledAt: until,
        lastPullStatus: "ok",
        lastError: null,
        lastErrorAt: null,
      },
    });
    return { processed };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.logSource.update({
      where: { id: source.id },
      data: {
        lastPullStatus: "error",
        lastError: message.slice(0, 2000),
        lastErrorAt: until,
      },
    });
    logger.warn(
      { err, sourceId: source.id, sourceType: source.sourceType },
      "log source pull failed"
    );
    return { processed: 0, error: message };
  }
}

export async function runIngestionCycle(
  severityFilter: LogSeverityLevel[]
): Promise<void> {
  const sources = await prisma.logSource.findMany({
    where: { isActive: true },
  });

  const until = new Date();
  let processed = 0;

  for (const source of sources) {
    if (processed >= maxEntries()) break;
    try {
      const adapter = getAdapter(source.sourceType);
      const config = decryptSourceConfig(source.config);
      const since =
        source.lastPulledAt ?? new Date(until.getTime() - 15 * 60 * 1000);
      const limit = Math.min(100, maxEntries() - processed);

      let entries;
      try {
        entries = await adapter.pull({
          config,
          since,
          until,
          severityFilter,
          limit,
          sourceId: source.id,
          environment: String(config.environment ?? "production"),
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("otlp_use_http_ingest") || msg.includes("not_implemented")) {
          await prisma.logSource.update({
            where: { id: source.id },
            data: { lastPullStatus: "skipped", lastError: null, lastErrorAt: null },
          });
          continue;
        }
        throw err;
      }

      for (const entry of entries) {
        if (processed >= maxEntries()) break;
        const result = await processNormalisedEntry({
          organizationId: source.organizationId,
          entry: { ...entry, sourceId: source.id },
        });
        if (result) processed += 1;
      }

      await prisma.logSource.update({
        where: { id: source.id },
        data: {
          lastPulledAt: until,
          lastPullStatus: "ok",
          lastError: null,
          lastErrorAt: null,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await prisma.logSource.update({
        where: { id: source.id },
        data: {
          lastPullStatus: "error",
          lastError: message.slice(0, 2000),
          lastErrorAt: until,
        },
      }).catch(() => undefined);
      logger.warn(
        { err, sourceId: source.id, sourceType: source.sourceType },
        "log ingestion source failed — skipping"
      );
    }
  }

  // Per-org anomaly + actions after cycle
  const orgIds = [...new Set(sources.map((s) => s.organizationId))];
  for (const orgId of orgIds) {
    try {
      await runAnomalyDetection(orgId);
      await dispatchAnomalyActions(orgId);
    } catch (err) {
      logger.warn({ err, orgId }, "post-ingestion anomaly/actions failed");
    }
  }

  logger.info(
    { processed, sources: sources.length, severityFilter },
    "log ingestion cycle complete"
  );
}

/** Re-attempt correlation for entries missing pipelineId. */
export async function runCorrelationSweep(): Promise<number> {
  const orphans = await prisma.logEntry.findMany({
    where: {
      pipelineId: null,
      timestamp: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
    include: { source: true },
    take: 100,
    orderBy: { timestamp: "desc" },
  });

  let updated = 0;
  for (const entry of orphans) {
    const corr = await correlateDeployment({
      organizationId: entry.source.organizationId,
      deploymentId: entry.deploymentId,
      timestamp: entry.timestamp,
    });
    if (!corr.pipelineId && !corr.jiraKey) continue;
    await prisma.logEntry.update({
      where: { id: entry.id },
      data: {
        pipelineId: corr.pipelineId,
        jiraKey: corr.jiraKey,
        correlationConfidence: corr.confidence,
        deploymentId: entry.deploymentId ?? corr.sha,
      },
    });
    if (entry.patternHash) {
      await prisma.errorPattern.updateMany({
        where: {
          organizationId: entry.source.organizationId,
          patternHash: entry.patternHash,
          pipelineId: null,
        },
        data: {
          pipelineId: corr.pipelineId ?? undefined,
          jiraKey: corr.jiraKey ?? undefined,
        },
      });
    }
    updated += 1;
  }
  return updated;
}

export async function runRetentionCleanup(): Promise<number> {
  const configs = await prisma.logIntelligenceConfig.findMany();
  let deleted = 0;
  const defaultDays = Number(process.env.LOG_RETENTION_DAYS ?? 30) || 30;

  const orgDays = new Map<string, number>();
  for (const c of configs) {
    orgDays.set(c.organizationId, c.logRetentionDays);
  }

  const sources = await prisma.logSource.findMany({
    select: { id: true, organizationId: true },
  });
  for (const source of sources) {
    const days = orgDays.get(source.organizationId) ?? defaultDays;
    const cutoff = new Date(Date.now() - days * 86_400_000);
    const result = await prisma.logEntry.deleteMany({
      where: { sourceId: source.id, createdAt: { lt: cutoff } },
    });
    deleted += result.count;
  }
  return deleted;
}

export { runAnomalyDetection, runPendingRootCauseAnalysis };
