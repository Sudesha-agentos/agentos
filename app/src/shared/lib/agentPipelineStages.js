export const AGENT_PIPELINE_STAGES = {
  virin: ["INGESTION", "PRODUCT_AGENT", "PRD_VALIDATION"],
  ananta: ["ENGINEERING_AGENT", "IMPLEMENTATION_VALIDATION"],
  neel: ["QA_AGENT", "QA_VALIDATION", "OUTPUT"],
};

export function pipelineMatchesAgentStage(currentStage, agentKey) {
  const stages = AGENT_PIPELINE_STAGES[agentKey] ?? [];
  return stages.includes(currentStage);
}

/** Copy for Ananta's implementation gate — next step is always Neel. */
export function implementationGateNextStepMessage(status) {
  if (status === "PAUSED") {
    return "Paused before Neel — resume or override to hand off to QA.";
  }
  if (status === "RUNNING") {
    return "Checking implementation — Neel starts next if the gate passes.";
  }
  return "Implementation gate before Neel.";
}
