import type { PipelineStage } from "../db/prisma";
import { auditRepo } from "../db/repositories/auditRepo";
import { pipelineRepo } from "../db/repositories/pipelineRepo";
import { stateManager } from "../pipeline/stateManager";
import { assertPipelineNotCancelled } from "../pipeline/cancelSession";
import type { GateId, GateResult } from "../types/pipeline";

export const GATE_STAGE: Record<Exclude<GateId, "virin_discovery" | "virin_prd">, PipelineStage> = {
  prd: "PRD_VALIDATION",
  implementation: "IMPLEMENTATION_VALIDATION",
  qa: "QA_VALIDATION",
};

export const STAGE_GATE: Partial<Record<PipelineStage, GateId>> = {
  PRD_VALIDATION: "prd",
  IMPLEMENTATION_VALIDATION: "implementation",
  QA_VALIDATION: "qa",
};

const NEXT_AFTER_GATE: Record<PipelineStage, PipelineStage> = {
  INGESTION: "PRODUCT_AGENT",
  PRODUCT_AGENT: "PRD_VALIDATION",
  PRD_VALIDATION: "ENGINEERING_AGENT",
  ENGINEERING_AGENT: "IMPLEMENTATION_VALIDATION",
  IMPLEMENTATION_VALIDATION: "QA_AGENT",
  QA_AGENT: "QA_VALIDATION",
  QA_VALIDATION: "OUTPUT",
  OUTPUT: "OUTPUT",
};

export async function applyGateDecision(
  pipelineId: string,
  gateId: GateId,
  result: GateResult
): Promise<boolean> {
  assertPipelineNotCancelled(pipelineId);
  if (gateId === "virin_discovery" || gateId === "virin_prd") {
    return result.passed;
  }
  const stage = GATE_STAGE[gateId];

  if (result.passed) {
    const pipeline = await pipelineRepo.findById(pipelineId);
    if (pipeline?.currentStage === stage) {
      await stateManager.advance(pipelineId, NEXT_AFTER_GATE[stage]);
    }
    return true;
  }

  const override = await pipelineRepo.getLatestOverride(pipelineId, stage);
  if (override) {
    await auditRepo.log(pipelineId, "HUMAN_OVERRIDE_APPLIED", {
      stage,
      gateId,
      overriddenBy: override.overriddenBy,
      overriddenAt: override.overriddenAt.toISOString(),
      bypassedIssues: result.issues.map((i) => i.message),
      blockingIssueCodes: result.blockingIssueCodes,
    });
    const pipeline = await pipelineRepo.findById(pipelineId);
    if (pipeline?.currentStage === stage) {
      await stateManager.advance(pipelineId, NEXT_AFTER_GATE[stage]);
    }
    return true;
  }

  await stateManager.pauseForHuman(
    pipelineId,
    stage,
    result.issues
      .filter((i) => i.severity === "error")
      .map((i) => i.message)
      .join("; ")
  );
  return false;
}
