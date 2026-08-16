import { Router } from "express";
import { z } from "zod";
import { auditRepo } from "../../db/repositories/auditRepo";
import { pipelineRepo } from "../../db/repositories/pipelineRepo";
import { resumePipelineInBackground } from "../../queue/inProcessRunner";
import { stateManager } from "../../pipeline/stateManager";
import { prisma } from "../../db/client";
import { NotFoundError, ValidationError } from "../../utils/errors";
import type { Prisma } from "../../db/prisma";

const router = Router();

const overrideSchema = z.object({
  stage: z.enum([
    "INGESTION",
    "PRODUCT_AGENT",
    "PRD_VALIDATION",
    "ENGINEERING_AGENT",
    "IMPLEMENTATION_VALIDATION",
    "QA_AGENT",
    "QA_VALIDATION",
    "OUTPUT",
  ]),
  correctedOutput: z.record(z.unknown()),
  overriddenBy: z.string().min(1),
  reason: z.string().optional(),
});

router.post("/:pipelineId/override", async (req, res, next) => {
  try {
    const parsed = overrideSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError("Invalid override payload", {
        issues: parsed.error.issues,
      });
    }

    const pipeline = await prisma.pipeline.findUnique({
      where: { id: req.params.pipelineId },
      include: { ticket: true },
    });
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
  } catch (err) {
    next(err);
  }
});

function nextStageAfter(
  stage: z.infer<typeof overrideSchema>["stage"]
): "PRODUCT_AGENT" | "PRD_VALIDATION" | "ENGINEERING_AGENT" | "IMPLEMENTATION_VALIDATION" | "QA_AGENT" | "QA_VALIDATION" | "OUTPUT" {
  const map = {
    INGESTION: "PRODUCT_AGENT",
    PRODUCT_AGENT: "PRD_VALIDATION",
    PRD_VALIDATION: "ENGINEERING_AGENT",
    ENGINEERING_AGENT: "IMPLEMENTATION_VALIDATION",
    IMPLEMENTATION_VALIDATION: "QA_AGENT",
    QA_AGENT: "QA_VALIDATION",
    QA_VALIDATION: "OUTPUT",
    OUTPUT: "OUTPUT",
  } as const;
  return map[stage];
}

router.get("/:pipelineId/audit", async (req, res) => {
  const logs = await auditRepo.listForPipeline(req.params.pipelineId);
  res.json({ items: logs });
});

export default router;
