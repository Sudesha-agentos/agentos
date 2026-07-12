import { exec } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { logger } from "../../utils/logger";

const execAsync = promisify(exec);

export interface PlaywrightSmokeResult {
  attempted: boolean;
  skipped: boolean;
  skipReason?: string;
  passed: boolean;
  output: string;
  durationMs: number;
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
}): Promise<PlaywrightSmokeResult> {
  if (input.enabled === false) {
    return {
      attempted: false,
      skipped: true,
      skipReason: "Playwright smoke disabled for this ticket (not marked UI/user-facing).",
      passed: true,
      output: "",
      durationMs: 0,
    };
  }

  const rootPkg = join(input.sandboxDir, "package.json");
  const appPkg = join(input.sandboxDir, "app", "package.json");
  const hasConfig =
    existsSync(join(input.sandboxDir, "playwright.config.ts")) ||
    existsSync(join(input.sandboxDir, "playwright.config.js")) ||
    existsSync(join(input.sandboxDir, "app", "playwright.config.ts")) ||
    existsSync(join(input.sandboxDir, "app", "playwright.config.js"));

  if (!hasConfig) {
    return {
      attempted: false,
      skipped: true,
      skipReason: "No playwright.config found — smoke lane skipped.",
      passed: true,
      output: "",
      durationMs: 0,
    };
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
    return {
      attempted: true,
      skipped: false,
      passed: true,
      output,
      durationMs: Date.now() - start,
    };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string };
    const output = `${e.stdout ?? ""}${e.stderr ?? ""}`;
    // If grep matches nothing, playwright may exit non-zero — treat as soft skip
    if (/no tests found/i.test(output)) {
      return {
        attempted: true,
        skipped: true,
        skipReason: "No @smoke Playwright tests found.",
        passed: true,
        output,
        durationMs: Date.now() - start,
      };
    }
    logger.warn({ cwd }, "Playwright smoke failed");
    return {
      attempted: true,
      skipped: false,
      passed: false,
      output,
      durationMs: Date.now() - start,
    };
  }
}

/** Heuristic: should we enable Playwright for this ticket? */
export function shouldEnablePlaywrightSmoke(text: string): boolean {
  return /ui|frontend|page|button|form|browser|playwright|e2e|user.?facing|react|click/i.test(
    text
  );
}
