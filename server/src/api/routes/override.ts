import { Router } from "express";
import { z } from "zod";
import { auditRepo } from "../../db/repositories/auditRepo";
import { pipelineRepo } from "../../db/repositories/pipelineRepo";
import { resumePipelineInBackground } from "../../queue/inProcessRunner";
import { stateManager } from "../../pipeline/stateManager";
import { NotFoundError, ValidationError } from "../../utils/errors";
import type { Prisma } from "../../db/prisma";
import {
  requireOrganizationUser,
  withOrganizationContext,
} from "../orgRequestContext";

const router = Router();

const overrideSchema = z.object({
  stage: z.enum([
    "PRD_VALIDATION",
    "IMPLEMENTATION_VALIDATION",
    "QA_VALIDATION",
  ]),
  correctedOutput: z.record(z.unknown()),
  overriddenBy: z.string().min(1),
  reason: z.string().optional(),
});

router.post("/:pipelineId/override", async (req, res, next) => {
  try {
    const user = requireOrganizationUser(req, res);
    if (!user?.organizationId) return;

    const parsed = overrideSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError("Invalid override payload", {
        issues: parsed.error.issues,
      });
    }

    await withOrganizationContext(user.organizationId, async () => {
      const pipeline = await pipelineRepo.findById(req.params.pipelineId);
      if (!pipeline) throw new NotFoundError("Pipeline not found");

      const previous = await pipelineRepo.getStageOutput(pipeline.id, parsed.data.stage);
      if (!previous) throw new NotFoundError("No prior output for stage");

      await pipelineRepo.recordOverride({
        pipelineId: pipeline.id,
        stage: parsed.data.stage,
        originalOutput: previous.output as Prisma.InputJsonValue,
        correctedOutput: parsed.data.correctedOutput as Prisma.InputJsonValue,
        overriddenBy: parsed.data.overriddenBy,
        reason: parsed.data.reason,
      });

      await auditRepo.log(pipeline.id, "HUMAN_OVERRIDE", {
        stage: parsed.data.stage,
        overriddenBy: parsed.data.overriddenBy,
        reason: parsed.data.reason,
      });

      // Resume (not restart) the pipeline: resume() reuses completed stage
      // outputs and the orchestrator's gates consult the HumanOverride row we
      // just wrote, so the overridden validation no longer pauses the run.
      await stateManager.advance(pipeline.id, nextStageAfter(parsed.data.stage));
      void resumePipelineInBackground(
        pipeline.ticketId,
        pipeline.ticket.jiraKey,
        pipeline.id,
        pipeline.organizationId
      );

      res.status(202).json({ ok: true });
    });
  } catch (err) {
    next(err);
  }
});

function nextStageAfter(
  stage: z.infer<typeof overrideSchema>["stage"]
): "ENGINEERING_AGENT" | "QA_AGENT" | "OUTPUT" {
  const map = {
    PRD_VALIDATION: "ENGINEERING_AGENT",
    IMPLEMENTATION_VALIDATION: "QA_AGENT",
    QA_VALIDATION: "OUTPUT",
  } as const;
  return map[stage];
}

router.get("/:pipelineId/audit", async (req, res, next) => {
  try {
    const user = requireOrganizationUser(req, res);
    if (!user?.organizationId) return;

    await withOrganizationContext(user.organizationId, async () => {
      const pipeline = await pipelineRepo.findById(req.params.pipelineId);
      if (!pipeline) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      const logs = await auditRepo.listForPipeline(pipeline.id);
      res.json({ items: logs });
    });
  } catch (err) {
    next(err);
  }
});

export default router;
