/**
 * OWASP ZAP baseline scan adapter.
 * Prefers `zap-baseline.py` ( zaproxy/zaproxy Docker / zap Scripts ).
 * Soft-skips when ZAP CLI is missing.
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { logger } from "../../utils/logger";
import { saveToolArtifact, type ToolArtifact, type ToolFinding } from "../toolArtifacts";
import { isMissingCliError, softSkipArtifact } from "../cliSoftSkip";

const execAsync = promisify(exec);

function parseZapFindings(output: string): ToolFinding[] {
  const findings: ToolFinding[] = [];
  const lines = output.split(/\r?\n/);
  for (let i = 0; i < lines.length && findings.length < 50; i++) {
    const line = lines[i];
    // Common zap-baseline WARN/FAIL lines
    const m = /^(WARN|FAIL|INFO)-NEW:\s*(.+)$/i.exec(line.trim());
    if (!m) continue;
    const level = m[1].toUpperCase();
    findings.push({
      id: `zap-${findings.length}`,
      title: m[2].slice(0, 200),
      severity:
        level === "FAIL" ? "high" : level === "WARN" ? "medium" : "info",
      detail: line.slice(0, 500),
      ruleId: level,
    });
  }
  return findings;
}

export async function runZapBaseline(input: {
  targetUrl: string;
  pipelineId?: string;
  timeoutMs?: number;
}): Promise<ToolArtifact> {
  const runId = `zap-${randomUUID().slice(0, 8)}`;
  const createdAt = new Date().toISOString();
  const target = input.targetUrl.replace(/\/$/, "");

  if (process.env.CANARY_ZAP === "0" || process.env.QA_ZAP === "0") {
    const artifact: ToolArtifact = {
      toolId: "zap",
      lane: "canary",
      pipelineId: input.pipelineId,
      runId,
      status: "skipped",
      summary: "ZAP disabled via env",
      findings: [],
      createdAt,
    };
    if (input.pipelineId) saveToolArtifact(artifact);
    return artifact;
  }

  // Try local script first, then docker image (official zaproxy)
  const localCmd = `zap-baseline.py -t ${JSON.stringify(target)} -I`;
  const dockerCmd = `docker run --rm -t ghcr.io/zaproxy/zaproxy:stable zap-baseline.py -t ${JSON.stringify(target)} -I`;

  async function tryCmd(cmd: string): Promise<{ stdout: string; stderr: string }> {
    return execAsync(cmd, {
      timeout: input.timeoutMs ?? 300_000,
      maxBuffer: 8 * 1024 * 1024,
      env: { ...process.env },
    });
  }

  try {
    let stdout = "";
    let stderr = "";
    try {
      ({ stdout, stderr } = await tryCmd(localCmd));
    } catch (first) {
      const msg = first instanceof Error ? first.message : String(first);
      if (isMissingCliError(msg, "zap-baseline")) {
        ({ stdout, stderr } = await tryCmd(dockerCmd));
      } else {
        // zap-baseline often exits non-zero when WARN/FAIL present — parse output
        const e = first as { stdout?: string; stderr?: string; message?: string };
        stdout = e.stdout ?? "";
        stderr = e.stderr ?? msg;
        if (!stdout && !stderr) throw first;
      }
    }

    const output = `${stdout}\n${stderr}`;
    const findings = parseZapFindings(output);
    const artifact: ToolArtifact = {
      toolId: "zap",
      lane: "canary",
      pipelineId: input.pipelineId,
      runId,
      status: findings.some((f) => f.severity === "high" || f.severity === "critical")
        ? "failed"
        : "completed",
      summary:
        findings.length > 0
          ? `ZAP baseline: ${findings.length} alert(s) on ${target}`
          : `ZAP baseline completed for ${target}`,
      findings,
      meta: { target, output: output.slice(0, 4000) },
      createdAt,
    };
    if (input.pipelineId) saveToolArtifact(artifact);
    return artifact;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const missing =
      isMissingCliError(message, "zap-baseline") ||
      isMissingCliError(message, "docker") ||
      /Unable to find image|Cannot connect to the Docker/i.test(message);

    const artifact = softSkipArtifact({
      toolId: "zap",
      lane: "canary",
      pipelineId: input.pipelineId,
      runId,
      installHint: "install OWASP ZAP or Docker image ghcr.io/zaproxy/zaproxy:stable",
      error: message,
      missing,
      createdAt,
    }) as ToolArtifact;
    logger.warn({ err, target }, "zap baseline soft-failed");
    if (input.pipelineId) saveToolArtifact(artifact);
    return artifact;
  }
}
