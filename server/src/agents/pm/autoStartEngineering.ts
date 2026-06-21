import { buildPmPipelineContext } from "./pmPipelineContext";
import { pmAnalysisStore } from "./store";
import { enqueueIntakeFromJiraKey } from "../../pipeline/jira/intakeEnqueueService";
import { getActiveOrganizationId } from "../../organization/context";
import { logger } from "../../utils/logger";

/** After Virin HANDOFF completes, enqueue the classic engineering pipeline with PM context. */
export async function autoStartEngineeringFromVirin(jiraKey: string): Promise<void> {
  const key = jiraKey.trim().toUpperCase();
  const record = pmAnalysisStore.get(key);
  if (!record || record.status !== "COMPLETED" || !record.generatedPrd) {
    return;
  }

  const orgId = getActiveOrganizationId();
  if (!orgId) {
    logger.warn({ jiraKey: key }, "auto engineering start skipped — no org context");
    return;
  }

  try {
    const pmContext = buildPmPipelineContext(record);
    const intake = await enqueueIntakeFromJiraKey(key, undefined, pmContext, "manual");
    logger.info(
      { jiraKey: key, enqueued: intake.enqueued, started: intake.started },
      "engineering pipeline auto-started after Virin handoff"
    );
  } catch (err) {
    logger.error({ err, jiraKey: key }, "auto engineering start failed after Virin handoff");
  }
}
