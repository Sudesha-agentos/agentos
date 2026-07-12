import { prisma } from "../db/client";
import { auditRepo } from "../db/repositories/auditRepo";
import { ticketRepo } from "../db/repositories/ticketRepo";
import { requestPmAnalysisCancel } from "../agents/pm/backgroundRunner";
import { syncEngineeringHandoffFromPipelineState } from "../agents/pm/handoffStatus";
import { pmAnalysisStore } from "../agents/pm/store";
import { logger } from "../utils/logger";
import { stateManager } from "./stateManager";

const cancelledPipelines = new Set<string>();
const cancelledByJiraKey = new Set<string>();

export class PipelineCancelledError extends Error {
  constructor(message = "Pipeline stopped by user") {
    super(message);
    this.name = "PipelineCancelledError";
  }
}

export function isPipelineCancelled(pipelineId: string): boolean {
  return cancelledPipelines.has(pipelineId);
}

export function isPipelineCancelledForJiraKey(jiraKey: string): boolean {
  return cancelledByJiraKey.has(jiraKey.trim().toUpperCase());
}

export function assertPipelineNotCancelled(pipelineId: string, jiraKey?: string): void {
  if (cancelledPipelines.has(pipelineId)) {
    throw new PipelineCancelledError();
  }
  if (jiraKey && cancelledByJiraKey.has(jiraKey.trim().toUpperCase())) {
    throw new PipelineCancelledError();
  }
}

export function clearPipelineCancel(pipelineId: string, jiraKey?: string): void {
  if (pipelineId) cancelledPipelines.delete(pipelineId);
  if (jiraKey) cancelledByJiraKey.delete(jiraKey.trim().toUpperCase());
}

export function clearPipelineCancelByJiraKey(jiraKey: string): void {
  cancelledByJiraKey.delete(jiraKey.trim().toUpperCase());
}

export interface StopSessionResult {
  jiraKey: string;
  virinCancelled: boolean;
  pipelinesStopped: string[];
  queueItemsCancelled: number;
  message: string;
}

/**
 * Stop Virin discovery and any linked engineering/QA pipeline for a ticket.
 * User can start again manually from Virin by selecting the ticket and analyzing.
 */
export async function stopWorkingSession(jiraKey: string): Promise<StopSessionResult> {
  const key = jiraKey.trim().toUpperCase();
  cancelledByJiraKey.add(key);

  const virinCancelled = requestPmAnalysisCancel(key);

  const ticket = await prisma.ticket.findFirst({
    where: { jiraKey: key },
    select: { id: true },
  });

  const pipelinesStopped: string[] = [];
  let queueItemsCancelled = 0;

  if (ticket) {
    const activePipelines = await prisma.pipeline.findMany({
      where: {
        ticketId: ticket.id,
        status: { in: ["RUNNING", "PAUSED"] },
      },
      select: { id: true, currentStage: true },
    });

    for (const pipeline of activePipelines) {
      cancelledPipelines.add(pipeline.id);
      await stateManager.fail(
        pipeline.id,
        pipeline.currentStage,
        "Stopped by user — restart manually from Virin"
      );
      await prisma.pipelineStageLog.updateMany({
        where: { pipelineId: pipeline.id, status: "RUNNING" },
        data: {
          status: "FAILED",
          completedAt: new Date(),
          output: {
            error: "Stopped by user",
            cancelled: true,
          },
        },
      });
      await auditRepo.log(pipeline.id, "PIPELINE_CANCELLED", {
        reason: "Stopped by user",
        jiraKey: key,
      });
      void syncEngineeringHandoffFromPipelineState(pipeline.id).catch(() => undefined);
      pipelinesStopped.push(pipeline.id);
    }

    const queueResult = await prisma.pipelineQueueItem.updateMany({
      where: {
        OR: [{ ticketId: ticket.id }, { jiraKey: key }],
        status: { in: ["PENDING", "ACTIVE"] },
      },
      data: { status: "FAILED", completedAt: new Date() },
    });
    queueItemsCancelled = queueResult.count;

    try {
      await ticketRepo.setStatus(ticket.id, "FAILED");
    } catch {
      // Ticket status update is best-effort
    }
  }

  const stoppedAnything =
    virinCancelled || pipelinesStopped.length > 0 || queueItemsCancelled > 0;

  // Mark Virin analysis stopped so the UI shows a clear restart path
  // (even when only the Ananta/Neel pipeline was live).
  if (stoppedAnything) {
    const record = pmAnalysisStore.get(key);
    if (record && record.status !== "CANCELLED") {
      pmAnalysisStore.setStatus(
        key,
        "CANCELLED",
        "Stopped by user — restart manually from Virin"
      );
      pmAnalysisStore.setCurrentStage(key, null);
    }
  }

  logger.info(
    {
      jiraKey: key,
      virinCancelled,
      pipelinesStopped,
      queueItemsCancelled,
    },
    "working session stopped by user"
  );

  return {
    jiraKey: key,
    virinCancelled: virinCancelled || stoppedAnything,
    pipelinesStopped,
    queueItemsCancelled,
    message: stoppedAnything
      ? "Session stopped. Open this ticket in Virin and click Analyze to start again."
      : "No active Virin session or pipeline was running for this ticket.",
  };
}
