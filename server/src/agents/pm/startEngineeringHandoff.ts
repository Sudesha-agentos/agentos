import { buildPmPipelineContext } from "./pmPipelineContext";
import {
  patchEngineeringHandoff,
  resolvePipelineIdForJiraKey,
} from "./handoffStatus";
import { pmAnalysisStore } from "./store";
import { tryEngineeringIntakeEnqueue } from "../../pipeline/jira/intakeOrchestrator";
import { withOrganizationContext } from "../../api/orgRequestContext";
import { logger } from "../../utils/logger";
import { extractOriginalTicket, runGate } from "../../gates";

export interface EngineeringHandoffStartResult {
  enqueued: number;
  skipped: number;
  started: boolean;
  pipelineId: string | null;
  message: string;
  gateBlocked?: boolean;
  gateIssues?: string[];
}

/** Enqueue classic engineering pipeline with Virin PM context. */
export async function startEngineeringHandoff(
  jiraKey: string,
  organizationId: string,
  options?: { override?: boolean; overriddenBy?: string; reason?: string }
): Promise<EngineeringHandoffStartResult> {
  const key = jiraKey.trim().toUpperCase();
  const record = pmAnalysisStore.get(key);

  if (!record || record.status !== "COMPLETED" || !record.generatedPrd) {
    return {
      enqueued: 0,
      skipped: 1,
      started: false,
      pipelineId: null,
      message: "Virin analysis must be completed with a generated PRD before handoff",
    };
  }

  if (options?.override) {
    pmAnalysisStore.update(key, {
      gateOverrides: {
        ...record.gateOverrides,
        virin_prd: {
          overriddenBy: options.overriddenBy ?? "human",
          reason: options.reason ?? "Manual engineering handoff override",
          at: new Date().toISOString(),
        },
      },
    });
  }

  const latest = pmAnalysisStore.get(key) ?? record;
  const prdGate = await runGate("virin_prd", {
    pmRecord: latest,
    generatedPrd: latest.generatedPrd,
    ticket: extractOriginalTicket(undefined, latest),
  });
  pmAnalysisStore.update(key, {
    gateResults: { ...latest.gateResults, virin_prd: prdGate },
  });
  if (!prdGate.passed && !pmAnalysisStore.get(key)?.gateOverrides?.virin_prd) {
    patchEngineeringHandoff(key, {
      status: "not_started",
      message: prdGate.issues.map((i) => i.message).join("; "),
    });
    return {
      enqueued: 0,
      skipped: 1,
      started: false,
      pipelineId: null,
      gateBlocked: true,
      gateIssues: prdGate.issues.map((i) => i.message),
      message:
        "PRD gate blocked engineering handoff: " +
        prdGate.issues.map((i) => i.message).join("; "),
    };
  }

  if (!record.organizationId) {
    pmAnalysisStore.update(key, { organizationId });
  }

  patchEngineeringHandoff(key, { status: "pending", message: "Enqueueing engineering pipeline…" });

  try {
    const pmContext = await buildPmPipelineContext(record);
    const intake = await withOrganizationContext(organizationId, () =>
      tryEngineeringIntakeEnqueue(key, pmContext, "manual")
    );

    const pipelineId = await resolvePipelineIdForJiraKey(key, organizationId);

    if (intake.enqueued === 0) {
      patchEngineeringHandoff(key, {
        status: "failed",
        pipelineId: pipelineId ?? undefined,
        message:
          intake.skipped > 0
            ? "Engineering pipeline was not enqueued — ticket may already be active or intake was skipped"
            : "Engineering pipeline was not enqueued",
      });
      return {
        enqueued: 0,
        skipped: intake.skipped,
        started: intake.started,
        pipelineId,
        message: "Engineering pipeline was not enqueued — check intake diagnostics",
      };
    }

    patchEngineeringHandoff(key, {
      status: intake.started ? "running" : "enqueued",
      pipelineId: pipelineId ?? undefined,
      message: intake.started
        ? "Engineering pipeline started"
        : "Engineering pipeline queued",
    });

    logger.info(
      { jiraKey: key, enqueued: intake.enqueued, started: intake.started, pipelineId, organizationId },
      "engineering handoff enqueued"
    );

    return {
      enqueued: intake.enqueued,
      skipped: intake.skipped,
      started: intake.started,
      pipelineId,
      message: intake.started
        ? "Coding pipeline started with PM PRD"
        : "Coding pipeline enqueued with PM PRD",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    patchEngineeringHandoff(key, { status: "failed", message });
    logger.error({ err, jiraKey: key, organizationId }, "engineering handoff failed");
    throw err;
  }
}
