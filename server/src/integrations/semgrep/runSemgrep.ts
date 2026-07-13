/**
 * Semgrep CLI adapter — runs `semgrep --json` in a sandbox directory.
 * Soft-skips when the binary is missing.
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { logger } from "../../utils/logger";
import {
  listToolArtifacts,
  saveToolArtifact,
  type ToolArtifact,
  type ToolFinding,
} from "../toolArtifacts";

const execAsync = promisify(exec);

export async function runSemgrepScan(input: {
  cwd: string;
  pipelineId?: string;
  timeoutMs?: number;
}): Promise<ToolArtifact> {
  const runId = `semgrep-${randomUUID().slice(0, 8)}`;
  const createdAt = new Date().toISOString();

  try {
    const { stdout, stderr } = await execAsync(
      "semgrep scan --config auto --json --quiet",
      {
        cwd: input.cwd,
        timeout: input.timeoutMs ?? 180_000,
        maxBuffer: 8 * 1024 * 1024,
        env: { ...process.env, SEMGREP_SEND_METRICS: "off" },
      }
    );

    let parsed: { results?: Array<Record<string, unknown>> } = {};
    try {
      parsed = JSON.parse(stdout || "{}");
    } catch {
      parsed = {};
    }

    const findings: ToolFinding[] = (parsed.results ?? []).slice(0, 200).map((r, i) => {
      const extra = (r.extra as Record<string, unknown>) || {};
      const path = String(r.path ?? "");
      const start = (r.start as { line?: number }) || {};
      const end = (r.end as { line?: number }) || {};
      const severityRaw = String(extra.severity ?? "INFO").toLowerCase();
      const severity =
        severityRaw === "error" || severityRaw === "critical"
          ? "critical"
          : severityRaw === "warning" || severityRaw === "high"
            ? "high"
            : severityRaw === "info" || severityRaw === "low"
              ? "low"
              : "medium";
      return {
        id: `sg-${i}-${String(r.check_id ?? i)}`,
        title: String(extra.message ?? r.check_id ?? "semgrep finding"),
        severity,
        path,
        startLine: start.line,
        endLine: end.line,
        ruleId: String(r.check_id ?? ""),
        detail: String(extra.message ?? stderr ?? "").slice(0, 2000),
      };
    });

    const artifact: ToolArtifact = {
      toolId: "semgrep",
      lane: "qa",
      pipelineId: input.pipelineId,
      runId,
      status: "completed",
      summary: `${findings.length} Semgrep finding(s)`,
      findings,
      createdAt,
    };
    if (input.pipelineId) saveToolArtifact(artifact);
    return artifact;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const missing =
      /not found|ENOENT|is not recognized|command not found/i.test(message) ||
      /semgrep/i.test(message) && /exit code 127|127/.test(message);

    const artifact: ToolArtifact = {
      toolId: "semgrep",
      lane: "qa",
      pipelineId: input.pipelineId,
      runId,
      status: missing ? "skipped" : "failed",
      summary: missing
        ? "Semgrep CLI not installed — skipped (install: pip install semgrep)"
        : `Semgrep failed: ${message.slice(0, 300)}`,
      findings: [],
      meta: { error: message.slice(0, 1000) },
      createdAt,
    };
    logger.warn({ err, cwd: input.cwd }, "semgrep scan soft-failed");
    if (input.pipelineId) saveToolArtifact(artifact);
    return artifact;
  }
}

export { listToolArtifacts };
