/**
 * Locust load-test adapter — headless run when a locustfile is present.
 * Soft-skips when CLI or locustfile is missing.
 */

import { exec } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { logger } from "../../utils/logger";
import { saveToolArtifact, type ToolArtifact, type ToolFinding } from "../toolArtifacts";
import { isMissingCliError, softSkipArtifact } from "../cliSoftSkip";

const execAsync = promisify(exec);

function findLocustfile(cwd: string): string | null {
  for (const name of ["locustfile.py", "locustfile", "loadtest/locustfile.py"]) {
    if (existsSync(join(cwd, name))) return name;
  }
  return null;
}

export async function runLocustLoad(input: {
  cwd?: string;
  host: string;
  users?: number;
  spawnRate?: number;
  runTime?: string;
  pipelineId?: string;
  timeoutMs?: number;
}): Promise<ToolArtifact> {
  const runId = `locust-${randomUUID().slice(0, 8)}`;
  const createdAt = new Date().toISOString();
  const cwd = input.cwd ?? process.cwd();

  if (process.env.CANARY_LOCUST === "0" || process.env.QA_LOCUST === "0") {
    const artifact: ToolArtifact = {
      toolId: "locust",
      lane: "canary",
      pipelineId: input.pipelineId,
      runId,
      status: "skipped",
      summary: "Locust disabled via env",
      findings: [],
      createdAt,
    };
    if (input.pipelineId) saveToolArtifact(artifact);
    return artifact;
  }

  const locustfile = findLocustfile(cwd);
  if (!locustfile) {
    const artifact: ToolArtifact = {
      toolId: "locust",
      lane: "canary",
      pipelineId: input.pipelineId,
      runId,
      status: "skipped",
      summary: "No locustfile.py found — Locust lane skipped",
      findings: [],
      createdAt,
    };
    if (input.pipelineId) saveToolArtifact(artifact);
    return artifact;
  }

  const users = input.users ?? 5;
  const spawnRate = input.spawnRate ?? 1;
  const runTime = input.runTime ?? "30s";
  const host = input.host.replace(/\/$/, "");
  const cmd = `locust -f ${JSON.stringify(locustfile)} --headless -u ${users} -r ${spawnRate} -t ${runTime} --host ${JSON.stringify(host)}`;

  try {
    const { stdout, stderr } = await execAsync(cmd, {
      cwd,
      timeout: input.timeoutMs ?? 120_000,
      maxBuffer: 5 * 1024 * 1024,
      env: { ...process.env },
    });
    const output = `${stdout}\n${stderr}`;
    const failRatio = /FailRatio\s*[:=]\s*([0-9.]+)/i.exec(output);
    const ratio = failRatio ? Number(failRatio[1]) : 0;
    const findings: ToolFinding[] =
      ratio > 0.05
        ? [
            {
              id: "locust-fail-ratio",
              title: `Locust fail ratio ${(ratio * 100).toFixed(1)}%`,
              severity: ratio > 0.2 ? "high" : "medium",
              detail: output.slice(0, 2000),
            },
          ]
        : [];

    const artifact: ToolArtifact = {
      toolId: "locust",
      lane: "canary",
      pipelineId: input.pipelineId,
      runId,
      status: findings.length ? "failed" : "completed",
      summary: `Locust ${users} users / ${runTime} against ${host}`,
      findings,
      meta: { host, users, runTime, output: output.slice(0, 4000) },
      createdAt,
    };
    if (input.pipelineId) saveToolArtifact(artifact);
    return artifact;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const missing = isMissingCliError(message, "locust");
    const artifact = softSkipArtifact({
      toolId: "locust",
      lane: "canary",
      pipelineId: input.pipelineId,
      runId,
      installHint: "pip install locust",
      error: message,
      missing,
      createdAt,
    }) as ToolArtifact;
    logger.warn({ err, host }, "locust soft-failed");
    if (input.pipelineId) saveToolArtifact(artifact);
    return artifact;
  }
}
