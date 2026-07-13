import { Router } from "express";
import {
  getEngineeringRun,
  listEngineeringRuns,
} from "../../engineering/engineeringRunsService";
import {
  subscribeEngineeringCodingEvents,
} from "../../engineering/codingEventsHub";
import { listToolArtifacts } from "../../integrations/toolArtifacts";
import { NotFoundError } from "../../utils/errors";
import {
  requireOrganizationUser,
  withOrganizationContext,
} from "../orgRequestContext";

const router = Router();

router.get("/runs", async (req, res, next) => {
  try {
    const user = requireOrganizationUser(req, res);
    if (!user?.organizationId) return;

    await withOrganizationContext(user.organizationId, async () => {
      const data = await listEngineeringRuns(user.organizationId!);
      res.json(data);
    });
  } catch (err) {
    next(err);
  }
});

router.get("/runs/:pipelineId", async (req, res, next) => {
  try {
    const user = requireOrganizationUser(req, res);
    if (!user?.organizationId) return;

    await withOrganizationContext(user.organizationId, async () => {
      const run = await getEngineeringRun(req.params.pipelineId);
      if (!run) throw new NotFoundError("Engineering run not found");
      res.json(run);
    });
  } catch (err) {
    next(err);
  }
});

router.get("/runs/:pipelineId/tool-artifacts", async (req, res, next) => {
  try {
    const user = requireOrganizationUser(req, res);
    if (!user?.organizationId) return;

    await withOrganizationContext(user.organizationId, async () => {
      const lane =
        typeof req.query.lane === "string"
          ? (req.query.lane as "engineering" | "qa" | "canary" | "codebase")
          : undefined;
      res.json({
        pipelineId: req.params.pipelineId,
        artifacts: listToolArtifacts(req.params.pipelineId, lane),
      });
    });
  } catch (err) {
    next(err);
  }
});

router.get("/runs/:pipelineId/events", async (req, res, next) => {
  try {
    const user = requireOrganizationUser(req, res);
    if (!user?.organizationId) return;

    await withOrganizationContext(user.organizationId, async () => {
      const run = await getEngineeringRun(req.params.pipelineId);
      if (!run) throw new NotFoundError("Engineering run not found");

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders?.();

      res.write(`data: ${JSON.stringify({ type: "connected", pipelineId: req.params.pipelineId })}\n\n`);

      const unsubscribe = subscribeEngineeringCodingEvents(req.params.pipelineId, res);

      req.on("close", () => {
        unsubscribe();
        res.end();
      });
    });
  } catch (err) {
    next(err);
  }
});

export default router;
