/**
 * Log Intelligence Layer entry point — start from server bootstrap.
 */

import { logger } from "../utils/logger";
import {
  runIngestionCycle,
  runCorrelationSweep,
  runRetentionCleanup,
  runAnomalyDetection,
  runPendingRootCauseAnalysis,
} from "./ingestion/ingestionRouter";
import { prisma } from "../db/client";

let started = false;

async function startRealtimeStreams(): Promise<void> {
  // Render SSE optional — scheduled pull covers MVP. Hook reserved for future.
  logger.info("log intelligence realtime streams: using scheduled pull");
}

export async function startLogIntelligence(): Promise<void> {
  if (process.env.LOG_INGESTION_ENABLED !== "1" && process.env.LOG_INGESTION_ENABLED !== "true") {
    logger.info("Log Intelligence Layer disabled (set LOG_INGESTION_ENABLED=1)");
    return;
  }
  if (started) return;
  started = true;

  logger.info("Log Intelligence Layer starting");
  await startRealtimeStreams();

  const errorCycleMs =
    (Number(process.env.LOG_INGESTION_CYCLE_MINUTES ?? 2) || 2) * 60 * 1000;

  setInterval(() => {
    void runIngestionCycle(["error", "fatal"]).catch((err) =>
      logger.warn({ err }, "error ingestion cycle failed")
    );
  }, errorCycleMs);

  setInterval(() => {
    void runIngestionCycle(["warn"]).catch((err) =>
      logger.warn({ err }, "warn ingestion cycle failed")
    );
  }, 5 * 60 * 1000);

  setInterval(() => {
    void (async () => {
      const orgs = await prisma.logSource.findMany({
        distinct: ["organizationId"],
        select: { organizationId: true },
      });
      for (const o of orgs) {
        await runAnomalyDetection(o.organizationId);
      }
    })().catch((err) => logger.warn({ err }, "anomaly sweep failed"));
  }, 10 * 60 * 1000);

  setInterval(() => {
    void runPendingRootCauseAnalysis().catch((err) =>
      logger.warn({ err }, "root cause sweep failed")
    );
  }, 60 * 60 * 1000);

  setInterval(() => {
    void runCorrelationSweep().catch((err) =>
      logger.warn({ err }, "correlation sweep failed")
    );
  }, 15 * 60 * 1000);

  setInterval(() => {
    void runRetentionCleanup().catch((err) =>
      logger.warn({ err }, "retention cleanup failed")
    );
  }, 6 * 60 * 60 * 1000);

  // Kick once shortly after boot
  setTimeout(() => {
    void runIngestionCycle(["error", "fatal"]).catch(() => undefined);
  }, 15_000);

  logger.info("Log Intelligence Layer running");
}

export { runIngestionCycle, runCorrelationSweep, runRetentionCleanup };
