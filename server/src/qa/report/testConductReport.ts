import type { QaOutput } from "../../types/agents";
import type { ToolArtifact } from "../../integrations/toolArtifacts";
import type { QaExecutionReport } from "./reportGenerator";
import type { TestRunResult } from "../testing/testRunner";

export type ConductedTestStatus = "pass" | "fail" | "skip" | "error";

export interface ConductedTest {
  name: string;
  status: ConductedTestStatus;
  durationMs?: number;
  suite?: string;
  error?: string;
}

export interface OssToolUse {
  tool: string;
  status: "ran" | "skipped" | "failed" | "not_run";
  summary: string;
  findings: number;
}

export interface TestConductReport {
  headline: string;
  totals: {
    passed: number;
    failed: number;
    skipped: number;
    errors: number;
    planned: number;
    executed: number;
  };
  executed: ConductedTest[];
  planned: Array<{ id: string; title: string; status: string }>;
  tools: OssToolUse[];
  markdown: string;
}

const OSS_TOOL_ORDER = [
  "semgrep",
  "playwright",
  "playwright-monitor",
  "cover-agent",
  "hypothesis",
  "npm-audit",
  "security-scan",
];

export function buildTestConductReport(input: {
  qa: QaOutput;
  executionReport?: QaExecutionReport;
  testRun?: TestRunResult;
  toolArtifacts?: ToolArtifact[];
}): TestConductReport {
  const testRun = input.testRun ?? input.executionReport?.testRun;
  const executed: ConductedTest[] = (testRun?.testResults ?? []).map((item) => ({
    name: item.testName,
    status: item.status,
    durationMs: item.duration,
    error: item.errorMessage,
  }));

  if (input.executionReport?.playwrightSmoke && !input.executionReport.playwrightSmoke.skipped) {
    executed.push({
      name: "Playwright @smoke",
      status: input.executionReport.playwrightSmoke.passed ? "pass" : "fail",
      durationMs: input.executionReport.playwrightSmoke.durationMs,
      suite: "playwright",
    });
  }

  const planned = (input.qa.testCases ?? []).map((tc) => ({
    id: tc.id,
    title: tc.title,
    status: matchPlannedStatus(tc, executed) ?? "planned",
  }));

  const passed = executed.filter((item) => item.status === "pass").length;
  const failed = executed.filter((item) => item.status === "fail").length;
  const skipped = executed.filter((item) => item.status === "skip").length;
  const errors = executed.filter((item) => item.status === "error").length;

  const tools = collectToolUses(input);
  const headline = buildHeadline({
    passed,
    failed,
    skipped,
    errors,
    executed: executed.length,
    planned: planned.length,
    tools,
    executionStatus: input.executionReport?.executionStatus,
  });

  const report: TestConductReport = {
    headline,
    totals: {
      passed,
      failed,
      skipped,
      errors,
      planned: planned.length,
      executed: executed.length,
    },
    executed,
    planned,
    tools,
    markdown: "",
  };
  report.markdown = formatConductMarkdown(report, input.qa);
  return report;
}

export function matchPlannedStatus(
  testCase: { id: string; title: string },
  executed: Array<{ name?: string; status: string }>
): string | undefined {
  const title = normalize(testCase.title);
  const id = normalize(testCase.id);
  const hit = executed.find((item) => {
    const name = normalize(item.name);
    return name === title || name.includes(title) || title.includes(name) || name.includes(id);
  });
  return hit?.status;
}

function collectToolUses(input: {
  executionReport?: QaExecutionReport;
  toolArtifacts?: ToolArtifact[];
}): OssToolUse[] {
  const byTool = new Map<string, OssToolUse>();

  for (const artifact of input.toolArtifacts ?? []) {
    byTool.set(artifact.toolId, {
      tool: artifact.toolId,
      status:
        artifact.status === "completed"
          ? "ran"
          : artifact.status === "skipped"
            ? "skipped"
            : "failed",
      summary: artifact.summary,
      findings: artifact.findings?.length ?? 0,
    });
  }

  const scan = input.executionReport?.securityScan;
  if (scan && !byTool.has("semgrep") && !byTool.has("security-scan")) {
    byTool.set("security-scan", {
      tool: "security-scan",
      status:
        scan.status === "skipped"
          ? "skipped"
          : scan.status === "error"
            ? "failed"
            : "ran",
      summary: scan.message ?? `${scan.criticalCount} critical / ${scan.highCount} high`,
      findings: scan.findings?.length ?? 0,
    });
  }

  const smoke = input.executionReport?.playwrightSmoke;
  if (smoke && !byTool.has("playwright") && !byTool.has("playwright-monitor")) {
    byTool.set("playwright", {
      tool: "playwright",
      status: smoke.skipped ? "skipped" : smoke.passed ? "ran" : "failed",
      summary: smoke.skipped
        ? smoke.skipReason ?? "Playwright skipped"
        : smoke.passed
          ? "Playwright @smoke passed"
          : "Playwright @smoke failed",
      findings: smoke.passed || smoke.skipped ? 0 : 1,
    });
  }

  const ordered = OSS_TOOL_ORDER.filter((id) => byTool.has(id)).map((id) => byTool.get(id)!);
  for (const item of byTool.values()) {
    if (!ordered.some((existing) => existing.tool === item.tool)) ordered.push(item);
  }
  return ordered;
}

function buildHeadline(input: {
  passed: number;
  failed: number;
  skipped: number;
  errors: number;
  executed: number;
  planned: number;
  tools: OssToolUse[];
  executionStatus?: string;
}): string {
  if (input.executed === 0) {
    const reason =
      input.executionStatus === "unavailable"
        ? "Sandbox was unavailable, so no tests executed."
        : "No executable tests ran.";
    return `Neel finished QA: ${input.planned} planned case${input.planned === 1 ? "" : "s"}. ${reason}`;
  }
  const parts = [`${input.passed} passed`];
  if (input.failed) parts.push(`${input.failed} failed`);
  if (input.skipped) parts.push(`${input.skipped} skipped`);
  if (input.errors) parts.push(`${input.errors} errored`);
  const ranTools = input.tools.filter((tool) => tool.status === "ran").map((tool) => tool.tool);
  const toolNote = ranTools.length ? ` Tools used: ${ranTools.join(", ")}.` : "";
  return `Neel ran ${input.executed} test${input.executed === 1 ? "" : "s"}: ${parts.join(", ")}.${toolNote}`;
}

export function formatConductMarkdown(report: TestConductReport, qa?: QaOutput): string {
  const lines = [
    "## Neel test report",
    "",
    report.headline,
    "",
    `Passed **${report.totals.passed}** · Failed **${report.totals.failed}** · Skipped **${report.totals.skipped}** · Errors **${report.totals.errors}**`,
  ];

  if (qa?.coverageReport) {
    lines.push(
      "",
      `Acceptance criteria: ${qa.coverageReport.coveredCriteria}/${qa.coverageReport.totalCriteria} (${qa.coverageReport.coveragePercent}%)`
    );
  }

  if (report.executed.length) {
    lines.push("", "### Tests conducted");
    for (const test of report.executed) {
      const mark =
        test.status === "pass" ? "PASS" : test.status === "fail" ? "FAIL" : test.status.toUpperCase();
      const extra = test.error ? ` — ${test.error}` : "";
      lines.push(`- [${mark}] ${test.name}${extra}`);
    }
  }

  if (report.tools.length) {
    lines.push("", "### Open-source tools");
    for (const tool of report.tools) {
      lines.push(`- **${tool.tool}** (${tool.status}): ${tool.summary}`);
    }
  }

  return lines.join("\n");
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}
