import type { PipelineStage } from "../db/prisma";
import { prisma } from "../db/client";
import { pipelineStageLabel } from "../pipeline/liveStatus";
import type { QaOutput } from "../types/agents";

export interface QaInboxItem {
  pipelineId: string;
  jiraKey: string;
  ticketId: string;
  summary: string;
  status: string;
  currentStage: PipelineStage;
  currentStageLabel: string;
  message: string;
  updatedAt: string | null;
  /** Present on completed report rows */
  testCount?: number;
  passRate?: number;
  testSummary?: string | null;
  completedAt?: string | null;
}

export interface QaInboxResponse {
  running: QaInboxItem[];
  blocked: QaInboxItem[];
  failed: QaInboxItem[];
  completed: QaInboxItem[];
}

function ticketSummary(normalizedData: unknown, jiraKey: string): string {
  if (normalizedData && typeof normalizedData === "object") {
    const summary = (normalizedData as { summary?: unknown }).summary;
    if (typeof summary === "string" && summary.trim()) return summary.trim();
  }
  return jiraKey;
}

function mapCompletedReport(stage: {
  pipelineId: string;
  completedAt: Date | null;
  output: unknown;
  pipeline: {
    ticketId: string;
    ticket: { jiraKey: string; normalizedData: unknown };
  };
}): QaInboxItem {
  const out = stage.output as {
    qa?: QaOutput;
    executionReport?: { testRun?: { passed?: number; failed?: number; totalTests?: number } };
  } | null;
  const qa = out?.qa;
  const total = qa?.testCases?.length ?? 0;
  const testRun = out?.executionReport?.testRun;
  let passRate = 0;
  if (testRun && (testRun.totalTests ?? 0) > 0) {
    passRate = Math.round(((testRun.passed ?? 0) / testRun.totalTests!) * 100);
  } else if (total > 0) {
    passRate = 100;
  }

  return {
    pipelineId: stage.pipelineId,
    jiraKey: stage.pipeline.ticket.jiraKey,
    ticketId: stage.pipeline.ticketId,
    summary: ticketSummary(stage.pipeline.ticket.normalizedData, stage.pipeline.ticket.jiraKey),
    status: "COMPLETED",
    currentStage: "QA_AGENT",
    currentStageLabel: pipelineStageLabel("QA_AGENT"),
    message: qa?.testSummary?.trim() || "QA report ready",
    updatedAt: stage.completedAt?.toISOString() ?? null,
    testCount: total,
    passRate,
    testSummary: qa?.testSummary ?? null,
    completedAt: stage.completedAt?.toISOString() ?? null,
  };
}

/**
 * Neel inbox: running QA, blocked before/at Neel gates, failed QA, completed reports.
 */
export async function getQaInbox(organizationId: string): Promise<QaInboxResponse> {
  const [runningPipelines, blockedPipelines, failedPipelines, completedStages] =
    await Promise.all([
      prisma.pipeline.findMany({
        where: {
          organizationId,
          status: "RUNNING",
          currentStage: { in: ["QA_AGENT", "QA_VALIDATION", "OUTPUT"] },
        },
        orderBy: { startedAt: "desc" },
        take: 30,
        include: { ticket: true },
      }),
      prisma.pipeline.findMany({
        where: {
          organizationId,
          status: "PAUSED",
          currentStage: {
            in: ["IMPLEMENTATION_VALIDATION", "QA_AGENT", "QA_VALIDATION"],
          },
        },
        orderBy: { startedAt: "desc" },
        take: 30,
        include: { ticket: true },
      }),
      prisma.pipeline.findMany({
        where: {
          organizationId,
          status: "FAILED",
          currentStage: {
            in: ["QA_AGENT", "QA_VALIDATION", "OUTPUT", "IMPLEMENTATION_VALIDATION"],
          },
        },
        orderBy: { startedAt: "desc" },
        take: 30,
        include: { ticket: true },
      }),
      prisma.pipelineStageLog.findMany({
        where: {
          stage: "QA_AGENT",
          status: "COMPLETED",
          pipeline: { organizationId },
        },
        orderBy: { completedAt: "desc" },
        take: 50,
        include: {
          pipeline: { include: { ticket: true } },
        },
      }),
    ]);

  const running: QaInboxItem[] = runningPipelines.map((p) => ({
    pipelineId: p.id,
    jiraKey: p.ticket.jiraKey,
    ticketId: p.ticketId,
    summary: ticketSummary(p.ticket.normalizedData, p.ticket.jiraKey),
    status: p.status,
    currentStage: p.currentStage,
    currentStageLabel: pipelineStageLabel(p.currentStage),
    message:
      p.currentStage === "QA_VALIDATION"
        ? "Neel finished tests — QA validation gate"
        : p.currentStage === "OUTPUT"
          ? "Writing results back to Jira"
          : "Neel is writing and running tests",
    updatedAt: (p.completedAt ?? p.startedAt)?.toISOString() ?? null,
  }));

  const blocked: QaInboxItem[] = blockedPipelines.map((p) => {
    let message =
      "Paused at implementation gate — resume or override to hand off to Neel";
    if (p.currentStage === "QA_VALIDATION") {
      message = "Paused at QA validation — resume or override to finish";
    } else if (p.currentStage === "QA_AGENT") {
      message = "Paused during Neel QA — resume to continue";
    }
    return {
      pipelineId: p.id,
      jiraKey: p.ticket.jiraKey,
      ticketId: p.ticketId,
      summary: ticketSummary(p.ticket.normalizedData, p.ticket.jiraKey),
      status: p.status,
      currentStage: p.currentStage,
      currentStageLabel: pipelineStageLabel(p.currentStage),
      message,
      updatedAt: (p.completedAt ?? p.startedAt)?.toISOString() ?? null,
    };
  });

  const failed: QaInboxItem[] = failedPipelines.map((p) => ({
    pipelineId: p.id,
    jiraKey: p.ticket.jiraKey,
    ticketId: p.ticketId,
    summary: ticketSummary(p.ticket.normalizedData, p.ticket.jiraKey),
    status: p.status,
    currentStage: p.currentStage,
    currentStageLabel: pipelineStageLabel(p.currentStage),
    message: `Failed at ${pipelineStageLabel(p.currentStage)} — open pipeline or resume to retry`,
    updatedAt: (p.completedAt ?? p.startedAt)?.toISOString() ?? null,
  }));

  const completed = completedStages.map(mapCompletedReport);

  return { running, blocked, failed, completed };
}
