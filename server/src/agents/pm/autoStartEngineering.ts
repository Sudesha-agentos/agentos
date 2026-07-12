import { patchEngineeringHandoff } from "./handoffStatus";
import { pmAnalysisStore } from "./store";
import { startEngineeringHandoff } from "./startEngineeringHandoff";
import { prisma } from "../../db/client";
import { getActiveOrganizationId } from "../../organization/context";
import { logger } from "../../utils/logger";
import { isAlreadyShipped } from "../virin/alreadyBuiltAssessment";

async function resolveOrganizationIdForHandoff(
  jiraKey: string,
  record: NonNullable<ReturnType<typeof pmAnalysisStore.get>>
): Promise<string | null> {
  const key = jiraKey.trim().toUpperCase();
  if (record.organizationId?.trim()) return record.organizationId;

  const active = getActiveOrganizationId();
  if (active) return active;

  if (!process.env.DATABASE_URL?.trim()) return null;

  const pmRow = await prisma.pmAnalysisRecord.findFirst({
    where: { jiraKey: key },
    orderBy: { updatedAt: "desc" },
    select: { organizationId: true },
  });
  if (pmRow?.organizationId) return pmRow.organizationId;

  const jiraRow = await prisma.jiraIssue.findFirst({
    where: { jiraKey: key },
    orderBy: { updatedAt: "desc" },
    select: { organizationId: true },
  });
  if (jiraRow?.organizationId) return jiraRow.organizationId;

  return null;
}

/** After Virin HANDOFF completes, enqueue the classic engineering pipeline with PM context. */
export async function autoStartEngineeringFromVirin(jiraKey: string): Promise<void> {
  const key = jiraKey.trim().toUpperCase();
  const record = pmAnalysisStore.get(key);
  if (!record || record.status !== "COMPLETED" || !record.generatedPrd) {
    logger.warn(
      { jiraKey: key, status: record?.status, hasPrd: Boolean(record?.generatedPrd) },
      "auto engineering start skipped — Virin not ready for handoff"
    );
    return;
  }

  if (isAlreadyShipped(record.codebaseAnalysis)) {
    patchEngineeringHandoff(key, {
      status: "not_started",
      message:
        record.codebaseAnalysis?.alreadyShippedNote?.trim() ||
        "Auto handoff skipped — codebase analysis says this capability already exists. Verify in product or start Ananta manually for a thin delta only.",
    });
    logger.info(
      { jiraKey: key, overlapVerdict: record.codebaseAnalysis?.overlapVerdict },
      "auto engineering start skipped — feature already shipped in codebase"
    );
    return;
  }

  const orgId = await resolveOrganizationIdForHandoff(key, record);
  if (!orgId) {
    patchEngineeringHandoff(key, {
      status: "failed",
      message: "Auto handoff failed — no organization context",
    });
    logger.error({ jiraKey: key }, "auto engineering start failed — no organization context");
    return;
  }

  try {
    await startEngineeringHandoff(key, orgId);
  } catch (err) {
    logger.error({ err, jiraKey: key, orgId }, "auto engineering start failed after Virin handoff");
  }
}
