/**
 * Mandatory Canary OSS suite: Playwright monitor → ZAP → Locust (sprint order).
 */

import path from "node:path";
import { logger } from "../utils/logger";
import { runPlaywrightMonitor } from "./playwrightMonitor/runPlaywrightMonitor";
import { runLocustLoad } from "./locust/runLocust";
import { runZapBaseline } from "./zap/runZap";
import type { ToolArtifact } from "./toolArtifacts";

function defaultLocustCwd(): string {
  if (process.env.CANARY_LOCUST_CWD?.trim()) return process.env.CANARY_LOCUST_CWD.trim();
  return path.join(process.cwd(), "vendor", "locust");
}

export async function runCanaryOssAdapters(input: {
  targetUrl: string;
  pipelineId?: string;
  runId: string;
}): Promise<ToolArtifact[]> {
  const scopeId = input.pipelineId || input.runId;
  const out: ToolArtifact[] = [];

  if (process.env.CANARY_OSS_ADAPTERS === "0") {
    logger.info({ runId: input.runId }, "canary OSS adapters disabled");
    return out;
  }

  // 1) Playwright synthetic monitor
  try {
    out.push(
      await runPlaywrightMonitor({
        baseUrl: input.targetUrl,
        pipelineId: scopeId,
        lane: "canary",
        timeoutMs: 120_000,
      })
    );
  } catch (err) {
    logger.warn({ err }, "canary playwright monitor crashed");
  }

  // 2) ZAP baseline
  try {
    out.push(
      await runZapBaseline({
        targetUrl: input.targetUrl,
        pipelineId: scopeId,
        timeoutMs: 300_000,
      })
    );
  } catch (err) {
    logger.warn({ err }, "canary zap adapter crashed");
  }

  // 3) Locust
  try {
    out.push(
      await runLocustLoad({
        host: input.targetUrl,
        cwd: defaultLocustCwd(),
        users: Number(process.env.CANARY_LOCUST_USERS ?? 5) || 5,
        spawnRate: 1,
        runTime: process.env.CANARY_LOCUST_TIME ?? "30s",
        pipelineId: scopeId,
        timeoutMs: 120_000,
      })
    );
  } catch (err) {
    logger.warn({ err }, "canary locust adapter crashed");
  }

  return out;
}
