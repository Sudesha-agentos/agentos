/**
 * Hypothesis (property-based testing) adapter via pytest.
 * Soft-skips when pytest/hypothesis are missing or no property tests found.
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

function hasPythonTests(cwd: string): boolean {
  return (
    existsSync(join(cwd, "pytest.ini")) ||
    existsSync(join(cwd, "pyproject.toml")) ||
    existsSync(join(cwd, "tests")) ||
    existsSync(join(cwd, "test"))
  );
}

export async function runHypothesisTests(input: {
  cwd: string;
  pipelineId?: string;
  timeoutMs?: number;
  extraArgs?: string;
}): Promise<ToolArtifact> {
  const runId = `hyp-${randomUUID().slice(0, 8)}`;
  const createdAt = new Date().toISOString();

  if (process.env.QA_HYPOTHESIS === "0") {
    const artifact: ToolArtifact = {
      toolId: "hypothesis",
      lane: "qa",
      pipelineId: input.pipelineId,
      runId,
      status: "skipped",
      summary: "Hypothesis disabled (QA_HYPOTHESIS=0)",
      findings: [],
      createdAt,
    };
    if (input.pipelineId) saveToolArtifact(artifact);
    return artifact;
  }

  if (!hasPythonTests(input.cwd)) {
    const artifact: ToolArtifact = {
      toolId: "hypothesis",
      lane: "qa",
      pipelineId: input.pipelineId,
      runId,
      status: "skipped",
      summary: "No Python/pytest layout detected — Hypothesis lane skipped",
      findings: [],
      createdAt,
    };
    if (input.pipelineId) saveToolArtifact(artifact);
    return artifact;
  }

  const extra = input.extraArgs ?? "";
  // Prefer hypothesis-marked tests; fall back to full pytest if none match.
  const cmd = `python -m pytest -q --tb=line --hypothesis-show-statistics ${extra}`.trim();

  try {
    const { stdout, stderr } = await execAsync(cmd, {
      cwd: input.cwd,
      timeout: input.timeoutMs ?? 180_000,
      maxBuffer: 5 * 1024 * 1024,
      env: { ...process.env },
    });
    const output = `${stdout}${stderr}`;
    const failed = /failed|ERROR/i.test(output) && !/0 failed/i.test(output);
    const findings: ToolFinding[] = failed
      ? [
          {
            id: "hyp-fail",
            title: "Hypothesis/pytest failures",
            severity: "high",
            detail: output.slice(0, 2000),
          },
        ]
      : [];

    const artifact: ToolArtifact = {
      toolId: "hypothesis",
      lane: "qa",
      pipelineId: input.pipelineId,
      runId,
      status: failed ? "failed" : "completed",
      summary: failed
        ? "Hypothesis/pytest reported failures"
        : "Hypothesis/pytest completed",
      findings,
      meta: { output: output.slice(0, 4000) },
      createdAt,
    };
    if (input.pipelineId) saveToolArtifact(artifact);
    return artifact;
  } catch (err) {
    const e = err as { message?: string; stdout?: string; stderr?: string };
    const message = e.message ?? String(err);
    const output = `${e.stdout ?? ""}${e.stderr ?? ""}`;
    const missing =
      isMissingCliError(message, "pytest") ||
      isMissingCliError(message, "python") ||
      /No module named ['"]hypothesis['"]/i.test(message + output);

    if (/no tests ran|collected 0 items/i.test(output + message)) {
      const artifact: ToolArtifact = {
        toolId: "hypothesis",
        lane: "qa",
        pipelineId: input.pipelineId,
        runId,
        status: "skipped",
        summary: "No pytest tests collected — Hypothesis lane skipped",
        findings: [],
        createdAt,
      };
      if (input.pipelineId) saveToolArtifact(artifact);
      return artifact;
    }

    const artifact = softSkipArtifact({
      toolId: "hypothesis",
      lane: "qa",
      pipelineId: input.pipelineId,
      runId,
      installHint: "pip install pytest hypothesis",
      error: (message + "\n" + output).slice(0, 1000),
      missing,
      createdAt,
    }) as ToolArtifact;
    if (!missing) {
      artifact.status = "failed";
      artifact.findings = [
        {
          id: "hyp-fail",
          title: "Hypothesis/pytest failed",
          severity: "high",
          detail: output.slice(0, 2000) || message.slice(0, 2000),
        },
      ];
      artifact.summary = "Hypothesis/pytest failed";
    }
    logger.warn({ err, cwd: input.cwd }, "hypothesis soft-failed");
    if (input.pipelineId) saveToolArtifact(artifact);
    return artifact;
  }
}
