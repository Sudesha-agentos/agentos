/**
 * Vendored Playwright synthetic monitor (inspired by Playwright monitoring patterns).
 * Runs against BASE_URL — used by Canary and as QA fallback when repo has no playwright.config.
 */

import { exec } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { logger } from "../../utils/logger";
import { saveToolArtifact, type ToolArtifact, type ToolFinding } from "../toolArtifacts";
import { isMissingCliError, softSkipArtifact } from "../cliSoftSkip";

const execAsync = promisify(exec);

function vendorMonitorDir(): string {
  return join(process.cwd(), "vendor", "playwright-monitor");
}

/** Ensure scaffold files exist (idempotent). */
export function ensurePlaywrightMonitorScaffold(): string {
  const dir = vendorMonitorDir();
  const testsDir = join(dir, "monitors");
  mkdirSync(testsDir, { recursive: true });

  const configPath = join(dir, "playwright.config.ts");
  if (!existsSync(configPath)) {
    writeFileSync(
      configPath,
      `import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./monitors",
  timeout: 45_000,
  retries: 0,
  use: {
    baseURL: process.env.BASE_URL || "http://127.0.0.1:3999",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
`,
      "utf8"
    );
  }

  const specPath = join(testsDir, "canary-health.spec.ts");
  if (!existsSync(specPath)) {
    writeFileSync(
      specPath,
      `import { test, expect } from "@playwright/test";

test.describe("Canary / health monitor", () => {
  test("home responds", async ({ page, baseURL }) => {
    const res = await page.goto(baseURL || "/", { waitUntil: "domcontentloaded" });
    expect(res).toBeTruthy();
    expect(res!.status()).toBeLessThan(500);
  });

  test("common health paths", async ({ request, baseURL }) => {
    const root = (baseURL || "").replace(/\\/$/, "");
    let ok = false;
    for (const path of ["/api/health", "/health", "/"]) {
      const res = await request.get(root + path);
      if (res.status() < 500) {
        ok = true;
        break;
      }
    }
    expect(ok).toBeTruthy();
  });
});
`,
      "utf8"
    );
  }

  const pkg = join(dir, "package.json");
  if (!existsSync(pkg)) {
    writeFileSync(
      pkg,
      JSON.stringify(
        {
          name: "agentox-playwright-monitor",
          private: true,
          type: "module",
          scripts: { test: "playwright test" },
          devDependencies: { "@playwright/test": "^1.49.0" },
        },
        null,
        2
      ),
      "utf8"
    );
  }

  return dir;
}

export async function runPlaywrightMonitor(input: {
  baseUrl: string;
  pipelineId?: string;
  lane?: "qa" | "canary";
  timeoutMs?: number;
}): Promise<ToolArtifact> {
  const runId = `pwmon-${randomUUID().slice(0, 8)}`;
  const createdAt = new Date().toISOString();
  const lane = input.lane ?? "canary";
  const dir = ensurePlaywrightMonitorScaffold();
  const baseUrl = input.baseUrl.replace(/\/$/, "");

  try {
    // Ensure deps once (soft)
    if (!existsSync(join(dir, "node_modules", "@playwright", "test"))) {
      await execAsync("npm install --no-fund --no-audit", {
        cwd: dir,
        timeout: 180_000,
        env: { ...process.env },
      });
      await execAsync("npx playwright install chromium", {
        cwd: dir,
        timeout: 300_000,
        env: { ...process.env },
      });
    }

    const { stdout, stderr } = await execAsync(
      "npx playwright test --reporter=line",
      {
        cwd: dir,
        timeout: input.timeoutMs ?? 120_000,
        maxBuffer: 5 * 1024 * 1024,
        env: { ...process.env, BASE_URL: baseUrl, CI: "true" },
      }
    );
    const output = `${stdout}\n${stderr}`.slice(0, 6000);
    const artifact: ToolArtifact = {
      toolId: "playwright-monitor",
      lane,
      pipelineId: input.pipelineId,
      runId,
      status: "completed",
      summary: `Playwright monitor passed against ${baseUrl}`,
      findings: [],
      meta: { baseUrl, output },
      createdAt,
    };
    if (input.pipelineId) saveToolArtifact(artifact);
    return artifact;
  } catch (err) {
    const e = err as { message?: string; stdout?: string; stderr?: string };
    const message = e.message ?? String(err);
    const output = `${e.stdout ?? ""}${e.stderr ?? ""}`;
    const missing =
      isMissingCliError(message, "playwright") ||
      /Cannot find module '@playwright/i.test(message + output);

    if (missing) {
      const artifact = softSkipArtifact({
        toolId: "playwright-monitor",
        lane,
        pipelineId: input.pipelineId,
        runId,
        installHint: "npm i -D @playwright/test && npx playwright install chromium",
        error: message,
        missing: true,
        createdAt,
      }) as ToolArtifact;
      if (input.pipelineId) saveToolArtifact(artifact);
      return artifact;
    }

    const findings: ToolFinding[] = [
      {
        id: "pwmon-fail",
        title: "Playwright monitor failed",
        severity: "high",
        detail: (output || message).slice(0, 2000),
      },
    ];
    const artifact: ToolArtifact = {
      toolId: "playwright-monitor",
      lane,
      pipelineId: input.pipelineId,
      runId,
      status: "failed",
      summary: `Playwright monitor failed against ${baseUrl}`,
      findings,
      meta: { baseUrl, output: output.slice(0, 4000) },
      createdAt,
    };
    logger.warn({ baseUrl }, "playwright monitor failed");
    if (input.pipelineId) saveToolArtifact(artifact);
    return artifact;
  }
}
