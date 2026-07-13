import { exec } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { logger } from "../../utils/logger";
import { saveToolArtifact, type ToolArtifact } from "../../integrations/toolArtifacts";

const execAsync = promisify(exec);

export interface PlaywrightSmokeResult {
  attempted: boolean;
  skipped: boolean;
  skipReason?: string;
  passed: boolean;
  output: string;
  durationMs: number;
}

function persistPlaywrightArtifact(
  pipelineId: string | undefined,
  result: PlaywrightSmokeResult
): void {
  if (!pipelineId) return;
  const artifact: ToolArtifact = {
    toolId: "playwright",
    lane: "qa",
    pipelineId,
    runId: `pw-${randomUUID().slice(0, 8)}`,
    status: result.skipped ? "skipped" : result.passed ? "completed" : "failed",
    summary: result.skipped
      ? result.skipReason || "Playwright smoke skipped"
      : result.passed
        ? `Playwright @smoke passed (${result.durationMs}ms)`
        : `Playwright @smoke failed (${result.durationMs}ms)`,
    findings: result.passed || result.skipped
      ? []
      : [
          {
            id: "pw-smoke-fail",
            title: "Playwright @smoke failed",
            severity: "high",
            detail: result.output.slice(0, 2000),
          },
        ],
    meta: {
      attempted: result.attempted,
      skipped: result.skipped,
      durationMs: result.durationMs,
    },
    createdAt: new Date().toISOString(),
  };
  saveToolArtifact(artifact);
}

/**
 * Optional Playwright smoke lane — runs only when the repo already has Playwright
 * configured. Not a full Selenium/Appium grid.
 */
export async function runPlaywrightSmoke(input: {
  sandboxDir: string;
  timeoutSeconds?: number;
  /** When false, skip even if playwright is present */
  enabled?: boolean;
  pipelineId?: string;
}): Promise<PlaywrightSmokeResult> {
  if (input.enabled === false) {
    const result: PlaywrightSmokeResult = {
      attempted: false,
      skipped: true,
      skipReason: "Playwright smoke disabled for this ticket (not marked UI/user-facing).",
      passed: true,
      output: "",
      durationMs: 0,
    };
    persistPlaywrightArtifact(input.pipelineId, result);
    return result;
  }

  const appPkg = join(input.sandboxDir, "app", "package.json");
  const hasConfig =
    existsSync(join(input.sandboxDir, "playwright.config.ts")) ||
    existsSync(join(input.sandboxDir, "playwright.config.js")) ||
    existsSync(join(input.sandboxDir, "app", "playwright.config.ts")) ||
    existsSync(join(input.sandboxDir, "app", "playwright.config.js"));

  if (!hasConfig) {
    const result: PlaywrightSmokeResult = {
      attempted: false,
      skipped: true,
      skipReason: "No playwright.config found — smoke lane skipped.",
      passed: true,
      output: "",
      durationMs: 0,
    };
    persistPlaywrightArtifact(input.pipelineId, result);
    return result;
  }

  const cwd = existsSync(appPkg) ? join(input.sandboxDir, "app") : input.sandboxDir;
  const timeout = (input.timeoutSeconds ?? 180) * 1000;
  const start = Date.now();

  try {
    const { stdout, stderr } = await execAsync("npx playwright test --grep @smoke --reporter=line", {
      cwd,
      timeout,
      env: { ...process.env, CI: "true" },
      maxBuffer: 5 * 1024 * 1024,
    });
    const output = `${stdout}${stderr}`;
    logger.info({ cwd }, "Playwright smoke completed");
    const result: PlaywrightSmokeResult = {
      attempted: true,
      skipped: false,
      passed: true,
      output,
      durationMs: Date.now() - start,
    };
    persistPlaywrightArtifact(input.pipelineId, result);
    return result;
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string };
    const output = `${e.stdout ?? ""}${e.stderr ?? ""}`;
    // If grep matches nothing, playwright may exit non-zero — treat as soft skip
    if (/no tests found/i.test(output)) {
      const result: PlaywrightSmokeResult = {
        attempted: true,
        skipped: true,
        skipReason: "No @smoke Playwright tests found.",
        passed: true,
        output,
        durationMs: Date.now() - start,
      };
      persistPlaywrightArtifact(input.pipelineId, result);
      return result;
    }
    logger.warn({ cwd }, "Playwright smoke failed");
    const result: PlaywrightSmokeResult = {
      attempted: true,
      skipped: false,
      passed: false,
      output,
      durationMs: Date.now() - start,
    };
    persistPlaywrightArtifact(input.pipelineId, result);
    return result;
  }
}

/** Heuristic: should we enable Playwright for this ticket? */
export function shouldEnablePlaywrightSmoke(text: string): boolean {
  return /ui|frontend|page|button|form|browser|playwright|e2e|user.?facing|react|click/i.test(
    text
  );
}
