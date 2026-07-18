import { Router } from "express";
import { getPrisma } from "../../db/client";
import { getQueueStats } from "../../queue/inProcessRunner";
import { isOssToolsRequired } from "../../integrations/cliSoftSkip";
import { getOssToolStatus } from "../../integrations/ossStatus";

const router = Router();

router.get("/healthz", async (_req, res) => {
  const stats = await getQueueStats();
  let ossSummary: { required: boolean; ready: boolean; installed: string[] } | undefined;
  try {
    const oss = await getOssToolStatus();
    ossSummary = {
      required: oss.required,
      ready: oss.ready,
      installed: oss.tools.filter((t) => t.installed).map((t) => t.id),
    };
  } catch {
    ossSummary = { required: isOssToolsRequired(), ready: false, installed: [] };
  }
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    openaiChatTokenParam: "max_completion_tokens",
    pipelineQueue: {
      pending: stats.pending,
      active: stats.active,
      completed: stats.completed,
    },
    ossTools: ossSummary,
  });
});

router.get("/readyz", async (_req, res) => {
  const checks: Record<string, "ok" | string> = {};
  const prisma = getPrisma();
  if (!prisma) {
    checks.postgres = "skipped (DATABASE_URL not set)";
  } else {
    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.postgres = "ok";
    } catch (err) {
      checks.postgres = err instanceof Error ? err.message : "error";
    }
  }
  const ok = Object.values(checks).every((v) => v === "ok" || v.startsWith("skipped"));
  res.status(ok ? 200 : 503).json({ status: ok ? "ready" : "degraded", checks });
});

export default router;
