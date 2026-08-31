import { exec } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { logger } from "../../utils/logger";
import {
  mergeParsedTestRuns,
  parseCoverageOutput,
  parseTestOutput,
  type ParsedTestResult,
} from "./testParser";
import { sandboxManager } from "./sandboxManager";

const execAsync = promisify(exec);

export type TestResult = ParsedTestResult;

export interface CoverageResult {
  lines: number;
  statements: number;
  functions: number;
  branches: number;
  uncoveredFiles: string[];
}

export interface TestRunResult {
  runId: string;
  status: "completed" | "timeout" | "error";
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  errors: number;
  duration: number;
  coverage?: CoverageResult;
  testResults: TestResult[];
  rawOutput: string;
  sandboxAvailable: boolean;
  message?: string;
}

export const testRunner = {
  async runTestsInSandbox(input: {
    branchName: string;
    testFiles?: string[];
    runType: "new_tests_only" | "regression_only" | "full_suite";
    timeoutSeconds?: number;
    stagedTestFiles?: Array<{ filePath: string; content: string }>;
  }): Promise<TestRunResult> {
    const runId = `qa-${Date.now()}`;
    const timeout = (input.timeoutSeconds ?? 120) * 1000;
    const { sandboxDir } = sandboxManager.create(runId);

    logger.info(
      { runId, branchName: input.branchName, runType: input.runType },
      "QA test run starting"
    );

    try {
      if (!process.env.GITHUB_TOKEN) {
        return {
          runId,
          status: "error",
          totalTests: 0,
          passed: 0,
          failed: 0,
          skipped: 0,
          errors: 0,
          duration: 0,
          testResults: [],
          rawOutput: "",
          sandboxAvailable: false,
          message:
            "Sandbox test execution skipped: GITHUB_TOKEN not configured. Tests were staged but not executed.",
        };
      }

      await sandboxManager.cloneBranch(sandboxDir, input.branchName);
      await sandboxManager.installDependencies(sandboxDir);

      if (input.stagedTestFiles?.length) {
        sandboxManager.writeTestFiles(sandboxDir, input.stagedTestFiles);
      }

      const commands = buildTestCommands(sandboxDir, input.runType, input.testFiles);
      const startTime = Date.now();
      let rawOutput = "";
      let status: TestRunResult["status"] = "completed";
      const parsedRuns = [];

      for (const command of commands) {
        try {
          const { stdout, stderr } = await execAsync(command.cmd, {
            cwd: command.cwd,
            timeout,
            env: {
              ...process.env,
              NODE_ENV: "test",
              CI: "true",
            },
          });
          const chunk = stdout + stderr;
          rawOutput += `\n--- ${command.label} ---\n${chunk}`;
          parsedRuns.push(parseTestOutput(chunk));
        } catch (execError: unknown) {
          const err = execError as {
            stdout?: string;
            stderr?: string;
            signal?: string;
          };
          const chunk = (err.stdout ?? "") + (err.stderr ?? "");
          rawOutput += `\n--- ${command.label} ---\n${chunk}`;
          parsedRuns.push(parseTestOutput(chunk));
          if (err.signal === "SIGTERM") {
            status = "timeout";
          }
        }
      }

      const duration = Date.now() - startTime;
      const parsed = mergeParsedTestRuns(parsedRuns);
      const coverage = parseCoverageOutput(rawOutput);

      const result: TestRunResult = {
        runId,
        status,
        totalTests: parsed.total,
        passed: parsed.passed,
        failed: parsed.failed,
        skipped: parsed.skipped,
        errors: parsed.errors,
        duration,
        coverage,
        testResults: parsed.testResults,
        rawOutput: rawOutput.slice(0, 10_000),
        sandboxAvailable: true,
      };

      logger.info(
        {
          runId,
          passed: result.passed,
          failed: result.failed,
          duration: result.duration,
        },
        "QA test run complete"
      );

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn({ runId, message }, "QA sandbox test run failed");
      return {
        runId,
        status: "error",
        totalTests: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        errors: 1,
        duration: 0,
        testResults: [],
        rawOutput: message,
        sandboxAvailable: false,
        message,
      };
    } finally {
      sandboxManager.destroy(sandboxDir);
    }
  },
};

function resolveTestCwd(sandboxDir: string): string {
  if (existsSync(join(sandboxDir, "app", "package.json"))) {
    return join(sandboxDir, "app");
  }
  if (existsSync(join(sandboxDir, "server", "package.json"))) {
    return join(sandboxDir, "server");
  }
  return sandboxDir;
}

function buildTestCommands(
  sandboxDir: string,
  runType: string,
  testFiles?: string[]
): Array<{ label: string; cmd: string; cwd: string }> {
  const commands: Array<{ label: string; cmd: string; cwd: string }> = [];
  const nodeRoots = uniqueDirs([
    sandboxDir,
    join(sandboxDir, "app"),
    join(sandboxDir, "server"),
  ]).filter((dir) => existsSync(join(dir, "package.json")));

  for (const cwd of nodeRoots) {
    const relativePrefix =
      cwd === sandboxDir ? "" : cwd.replace(sandboxDir, "").replace(/^[/\\]/, "");
    if (existsSync(join(cwd, "node_modules", "vitest"))) {
      const coverage = existsSync(join(cwd, "node_modules", "@vitest/coverage-v8"))
        ? " --coverage"
        : "";
      const base = `npx vitest run --reporter=json${coverage}`;
      let cmd = base;
      if (runType === "new_tests_only" && testFiles?.length) {
        const files = testFiles
          .map((f) => `"${relativePrefix ? `${relativePrefix}/` : ""}${f}"`.replace(/\/+/g, "/"))
          .join(" ");
        cmd = `${base} ${files}`;
      } else if (runType === "regression_only") {
        cmd = `${base} --exclude "**/qa-agent/**"`;
      }
      commands.push({ label: `vitest:${cwd === sandboxDir ? "." : relativePrefix}`, cmd, cwd });
    } else if (existsSync(join(cwd, "node_modules", "jest"))) {
      const flags =
        "--json --coverage --forceExit --passWithNoTests --testTimeout=10000";
      let cmd = `npx jest ${flags}`;
      if (runType === "new_tests_only" && testFiles?.length) {
        cmd = `${cmd} ${testFiles.map((f) => `"${f}"`).join(" ")}`;
      } else if (runType === "regression_only") {
        cmd = `${cmd} --testPathIgnorePatterns=qa-agent`;
      }
      commands.push({ label: `jest:${cwd === sandboxDir ? "." : relativePrefix}`, cmd, cwd });
    }
  }

  if (hasPytestLayout(sandboxDir)) {
    const files =
      runType === "new_tests_only" && testFiles?.length
        ? ` ${testFiles.map((f) => `"${f}"`).join(" ")}`
        : "";
    commands.push({
      label: "pytest",
      cmd: `python -m pytest -q --tb=line${files}`,
      cwd: sandboxDir,
    });
  }

  if (!commands.length) {
    const cwd = resolveTestCwd(sandboxDir);
    commands.push({ label: "npm-test", cmd: "npm test", cwd });
  }
  return commands;
}

function hasPytestLayout(sandboxDir: string): boolean {
  return (
    existsSync(join(sandboxDir, "pytest.ini")) ||
    existsSync(join(sandboxDir, "conftest.py")) ||
    existsSync(join(sandboxDir, "tests")) ||
    existsSync(join(sandboxDir, "pyproject.toml"))
  );
}

function uniqueDirs(dirs: string[]): string[] {
  return [...new Set(dirs)];
}
