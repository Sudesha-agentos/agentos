/**
 * Cover-Agent CLI adapter (Codium-ai/cover-agent).
 * Soft-skips when the binary is missing. Requires source + test file paths.
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { logger } from "../../utils/logger";
import { saveToolArtifact, type ToolArtifact } from "../toolArtifacts";
import { isMissingCliError, softSkipArtifact } from "../cliSoftSkip";

const execAsync = promisify(exec);

export async function runCoverAgent(input: {
  cwd: string;
  sourceFilePath: string;
  testFilePath: string;
  testCommand?: string;
  coverageReportPath?: string;
  desiredCoverage?: number;
  maxIterations?: number;
  pipelineId?: string;
  timeoutMs?: number;
}): Promise<ToolArtifact> {
  const runId = `cover-${randomUUID().slice(0, 8)}`;
  const createdAt = new Date().toISOString();
  const coverageReport = input.coverageReportPath ?? "coverage.xml";
  const testCommand =
    input.testCommand ?? "npx vitest run --coverage --reporter=verbose";
  const desired = input.desiredCoverage ?? 70;
  const maxIter = input.maxIterations ?? 2;

  if (process.env.QA_COVER_AGENT === "0") {
    const artifact: ToolArtifact = {
      toolId: "cover-agent",
      lane: "qa",
      pipelineId: input.pipelineId,
      runId,
      status: "skipped",
      summary: "Cover-Agent disabled (QA_COVER_AGENT=0)",
      findings: [],
      createdAt,
    };
    if (input.pipelineId) saveToolArtifact(artifact);
    return artifact;
  }

  const cmd = [
    "cover-agent",
    `--source-file-path ${JSON.stringify(input.sourceFilePath)}`,
    `--test-file-path ${JSON.stringify(input.testFilePath)}`,
    `--code-coverage-report-path ${JSON.stringify(coverageReport)}`,
    `--test-command ${JSON.stringify(testCommand)}`,
    `--test-command-dir "."`,
    `--desired-coverage ${desired}`,
    `--max-iterations ${maxIter}`,
  ].join(" ");

  try {
    const { stdout, stderr } = await execAsync(cmd, {
      cwd: input.cwd,
      timeout: input.timeoutMs ?? 300_000,
      maxBuffer: 8 * 1024 * 1024,
      env: { ...process.env },
    });
    const output = `${stdout}\n${stderr}`.slice(0, 8000);
    const artifact: ToolArtifact = {
      toolId: "cover-agent",
      lane: "qa",
      pipelineId: input.pipelineId,
      runId,
      status: "completed",
      summary: `Cover-Agent finished for ${input.sourceFilePath} (target ${desired}%)`,
      findings: [
        {
          id: "cover-output",
          title: "Cover-Agent output",
          severity: "info",
          path: input.testFilePath,
          detail: output.slice(0, 2000),
        },
      ],
      meta: { sourceFilePath: input.sourceFilePath, testFilePath: input.testFilePath },
      createdAt,
    };
    if (input.pipelineId) saveToolArtifact(artifact);
    return artifact;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const missing = isMissingCliError(message, "cover-agent");
    const artifact = softSkipArtifact({
      toolId: "cover-agent",
      lane: "qa",
      pipelineId: input.pipelineId,
      runId,
      installHint: "pip install cover-agent",
      error: message,
      missing,
      createdAt,
    }) as ToolArtifact;
    logger.warn({ err, cwd: input.cwd }, "cover-agent soft-failed");
    if (input.pipelineId) saveToolArtifact(artifact);
    return artifact;
  }
}
