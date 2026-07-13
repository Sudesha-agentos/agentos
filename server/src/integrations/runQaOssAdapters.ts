/**
 * Mandatory QA OSS suite for every ticket: Semgrep, Playwright, Cover-Agent, Hypothesis.
 * Always attempted; soft-skip artifacts still recorded for the frontend.
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { logger } from "../utils/logger";
import { runSemgrepScan } from "./semgrep/runSemgrep";
import { runHypothesisTests } from "./hypothesis/runHypothesis";
import { runCoverAgent } from "./coverAgent/runCoverAgent";
import { runPlaywrightSmoke } from "../qa/testing/playwrightSmoke";
import { runPlaywrightMonitor } from "./playwrightMonitor/runPlaywrightMonitor";
import type { ToolArtifact } from "./toolArtifacts";

function guessTestPath(sourcePath: string): string {
  const normalized = sourcePath.replace(/\\/g, "/");
  if (/\.(test|spec)\./i.test(normalized)) return normalized;
  const noExt = normalized.replace(/\.[^.]+$/, "");
  if (normalized.endsWith(".ts") || normalized.endsWith(".tsx")) {
    return `${noExt}.test.ts`;
  }
  if (normalized.endsWith(".js") || normalized.endsWith(".jsx")) {
    return `${noExt}.test.js`;
  }
  if (normalized.endsWith(".py")) {
    const base = normalized.split("/").pop()?.replace(/\.py$/, "") ?? "module";
    return `tests/test_${base}.py`;
  }
  return `${noExt}.test.ts`;
}

function ensureMinimalTestStub(cwd: string, testRel: string, sourceRel: string): void {
  const abs = join(cwd, testRel);
  if (existsSync(abs)) return;
  mkdirSync(dirname(abs), { recursive: true });
  if (testRel.endsWith(".py")) {
    writeFileSync(
      abs,
      `"""Auto-stub for Cover-Agent — grow coverage for ${sourceRel}."""\n\ndef test_placeholder():\n    assert True\n`,
      "utf8"
    );
  } else {
    writeFileSync(
      abs,
      `/** Auto-stub for Cover-Agent — target: ${sourceRel} */\ndescribe(${JSON.stringify(sourceRel)}, () => {\n  it("placeholder", () => {\n    expect(true).toBe(true);\n  });\n});\n`,
      "utf8"
    );
  }
}

export async function runQaOssAdapters(input: {
  cwd: string;
  pipelineId?: string;
  changedFiles?: string[];
  baseUrl?: string;
}): Promise<ToolArtifact[]> {
  const out: ToolArtifact[] = [];
  if (process.env.QA_OSS_ADAPTERS === "0") {
    return out;
  }

  // 1) Semgrep
  try {
    out.push(
      await runSemgrepScan({
        cwd: input.cwd,
        pipelineId: input.pipelineId,
        timeoutMs: 180_000,
      })
    );
  } catch (err) {
    logger.warn({ err }, "qa semgrep mandatory adapter crashed");
  }

  // 2) Playwright — repo @smoke first, else vendored monitor
  try {
    const smoke = await runPlaywrightSmoke({
      sandboxDir: input.cwd,
      enabled: true,
      pipelineId: input.pipelineId,
    });
    // Always persist via smoke helper; if skipped for missing config, run monitor
    if (smoke.skipped && /no playwright\.config/i.test(smoke.skipReason ?? "")) {
      const base =
        input.baseUrl?.trim() ||
        process.env.QA_PLAYWRIGHT_BASE_URL?.trim() ||
        process.env.CANARY_STAGING_BASE_URL?.trim() ||
        process.env.FRONTEND_URL?.trim() ||
        "http://127.0.0.1:5173";
      out.push(
        await runPlaywrightMonitor({
          baseUrl: base,
          pipelineId: input.pipelineId,
          lane: "qa",
        })
      );
    }
  } catch (err) {
    logger.warn({ err }, "qa playwright mandatory adapter crashed");
  }

  // 3) Cover-Agent on up to 2 changed source files
  try {
    const candidates = (input.changedFiles ?? [])
      .filter((f) => /\.(ts|tsx|js|jsx|py)$/i.test(f))
      .filter((f) => !/\.(test|spec)\./i.test(f))
      .slice(0, 2);

    if (candidates.length === 0) {
      // Still record Cover-Agent attempt against a synthetic pair if repo has src
      const fallback = ["src/index.ts", "index.ts", "main.py", "app.py"].find((p) =>
        existsSync(join(input.cwd, p))
      );
      if (fallback) candidates.push(fallback);
    }

    for (const source of candidates) {
      const testFile = guessTestPath(source);
      ensureMinimalTestStub(input.cwd, testFile, source);
      const testCommand = source.endsWith(".py")
        ? "pytest --cov=. --cov-report=xml --cov-report=term -q"
        : "npx vitest run --coverage --reporter=dot";
      out.push(
        await runCoverAgent({
          cwd: input.cwd,
          sourceFilePath: source,
          testFilePath: testFile,
          testCommand,
          desiredCoverage: 60,
          maxIterations: 2,
          pipelineId: input.pipelineId,
          timeoutMs: 240_000,
        })
      );
    }

    if (candidates.length === 0) {
      const { saveToolArtifact } = await import("./toolArtifacts");
      const { randomUUID } = await import("node:crypto");
      const artifact: ToolArtifact = {
        toolId: "cover-agent",
        lane: "qa",
        pipelineId: input.pipelineId,
        runId: `cover-none-${randomUUID().slice(0, 8)}`,
        status: "skipped",
        summary: "Cover-Agent: no eligible source files in this ticket change set",
        findings: [],
        createdAt: new Date().toISOString(),
      };
      if (input.pipelineId) saveToolArtifact(artifact);
      out.push(artifact);
    }
  } catch (err) {
    logger.warn({ err }, "qa cover-agent mandatory adapter crashed");
  }

  // 4) Hypothesis / pytest
  try {
    out.push(
      await runHypothesisTests({
        cwd: input.cwd,
        pipelineId: input.pipelineId,
        timeoutMs: 120_000,
      })
    );
  } catch (err) {
    logger.warn({ err }, "qa hypothesis mandatory adapter crashed");
  }

  return out;
}
