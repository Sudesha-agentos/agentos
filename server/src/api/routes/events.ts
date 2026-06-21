import { Router } from "express";
import { prisma } from "../../db/client";
import type { PipelineStage, PipelineStatus } from "../../generated/prisma/client";
import { listRecentIntakeEvents } from "../../db/repositories/intakeEventRepo";
import {
  dismissNotification,
  dismissNotifications,
  filterUndismissedNotifications,
} from "../../notifications/notificationDismissStore";
import {
  clearIntakeNotifications,
  removeIntakeNotification,
} from "../../pipeline/jira/intakeNotificationStore";
import { requireOrganizationUser } from "../orgRequestContext";
import { ValidationError } from "../../utils/errors";

const router = Router();

const STAGE_LABELS: Record<PipelineStage, string> = {
  INGESTION: "Ingestion",
  PRODUCT_AGENT: "Virin",
  PRD_VALIDATION: "PRD Gate",
  ENGINEERING_AGENT: "Ananta",
  IMPLEMENTATION_VALIDATION: "Impl. Gate",
  QA_AGENT: "Neel",
  QA_VALIDATION: "QA Gate",
  OUTPUT: "Writeback",
};

function pipelineMessage(
  status: PipelineStatus,
  stage: PipelineStage
): string {
  const stageLabel = STAGE_LABELS[stage] ?? stage;
  if (status === "COMPLETED") return `${stageLabel} finished ✓`;
  if (status === "PAUSED") return `${stageLabel} — awaiting human review`;
  if (status === "FAILED") return `${stageLabel} failed`;
  return `${stageLabel} running…`;
}

function intakeTone(outcome: string): string {
  if (outcome === "enqueued") return "intake";
  if (outcome === "failed") return "attention";
  return "muted";
}

router.get("/recent", async (req, res, next) => {
  try {
    const user = requireOrganizationUser(req, res);
    if (!user?.organizationId) return;

    const pipelines = await prisma.pipeline.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { startedAt: "desc" },
      take: 20,
      include: { ticket: true },
    });

    const events = pipelines.map((pipeline) => {
      const tone =
        pipeline.status === "COMPLETED"
          ? "complete"
          : pipeline.status === "RUNNING"
            ? "progress"
            : pipeline.status === "PAUSED"
              ? "attention"
              : "muted";

      return {
        id: pipeline.id,
        pipelineId: pipeline.id,
        jiraKey: pipeline.ticket.jiraKey,
        tone,
        live: pipeline.status === "RUNNING",
        message: pipelineMessage(pipeline.status, pipeline.currentStage),
        timestamp:
          pipeline.completedAt?.toISOString() ??
          pipeline.startedAt.toISOString(),
      };
    });

    const intakeRows = await listRecentIntakeEvents(user.organizationId, 15);
    const intakeEvents = intakeRows.map((item) => ({
      id: item.id,
      pipelineId: null,
      jiraKey: item.jiraKey,
      tone: intakeTone(item.outcome),
      live: item.outcome === "enqueued",
      message:
        item.message ??
        (item.outcome === "skipped"
          ? `${item.jiraKey} skipped${item.skipReason ? `: ${item.skipReason}` : ""}`
          : item.outcome === "failed"
            ? `${item.jiraKey} intake failed`
            : `${item.jiraKey} enqueued`),
      summary: item.summary,
      issueType: item.issueType,
      outcome: item.outcome,
      skipReason: item.skipReason,
      source: item.source,
      timestamp: item.createdAt.toISOString(),
    }));

    const merged = filterUndismissedNotifications(user.organizationId, [
      ...intakeEvents,
      ...events,
    ])
      .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
      .slice(0, 30);

    res.json({ events: merged });
  } catch (err) {
    next(err);
  }
});

router.post("/dismiss", (req, res, next) => {
  try {
    const user = requireOrganizationUser(req, res);
    if (!user?.organizationId) return;

    const id = String(req.body?.id ?? "").trim();
    if (!id) throw new ValidationError("id is required");

    dismissNotification(user.organizationId, id);
    if (id.startsWith("intake-")) {
      removeIntakeNotification(user.organizationId, id);
    }

    res.json({ ok: true, id });
  } catch (err) {
    next(err);
  }
});

router.post("/clear", (req, res, next) => {
  try {
    const user = requireOrganizationUser(req, res);
    if (!user?.organizationId) return;

    const ids = Array.isArray(req.body?.ids)
      ? req.body.ids.map((value: unknown) => String(value).trim()).filter(Boolean)
      : [];

    if (!ids.length) throw new ValidationError("ids is required");

    const dismissed = dismissNotifications(user.organizationId, ids);
    for (const id of ids) {
      if (id.startsWith("intake-")) {
        removeIntakeNotification(user.organizationId, id);
      }
    }

    res.json({ ok: true, dismissed });
  } catch (err) {
    next(err);
  }
});

router.post("/clear-intake-memory", (req, res, next) => {
  try {
    const user = requireOrganizationUser(req, res);
    if (!user?.organizationId) return;

    const removed = clearIntakeNotifications(user.organizationId);
    res.json({ ok: true, removed });
  } catch (err) {
    next(err);
  }
});

export default router;
