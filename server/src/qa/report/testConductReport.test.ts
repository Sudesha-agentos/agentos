import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildTestConductReport, matchPlannedStatus } from "./testConductReport";
import type { QaOutput } from "../../types/agents";

const qa = {
  testSummary: "Covered divide by zero",
  testCases: [
    {
      id: "TC-001",
      title: "throws on divide by zero",
      type: "unit",
      linkedCriterion: "Throw on divide by zero",
      preconditions: [],
      steps: [],
      expectedResult: "Error",
      priority: "critical",
    },
  ],
  coverageReport: {
    totalCriteria: 1,
    coveredCriteria: 1,
    coveragePercent: 100,
    uncoveredCriteria: [],
  },
  riskAreas: [],
  automationRecommendations: [],
  confidenceScore: 0.9,
  confidenceReason: "ran",
} as QaOutput;

describe("buildTestConductReport", () => {
  it("lists every executed test and OSS tool with a headline", () => {
    const report = buildTestConductReport({
      qa,
      testRun: {
        runId: "qa-1",
        status: "completed",
        totalTests: 2,
        passed: 2,
        failed: 0,
        skipped: 0,
        errors: 0,
        duration: 40,
        testResults: [
          {
            testId: "a",
            testName: "throws on divide by zero",
            status: "pass",
            duration: 12,
          },
          {
            testId: "b",
            testName: "adds two numbers",
            status: "pass",
            duration: 8,
          },
        ],
        rawOutput: "",
        sandboxAvailable: true,
      },
      executionReport: {
        generatedAt: new Date().toISOString(),
        summary: "ok",
        overallRecommendation: "approve",
        criteriaCoverage: { total: 1, covered: 1, uncovered: [] },
        executionStatus: "ran",
        playwrightSmoke: {
          attempted: true,
          skipped: false,
          passed: true,
          output: "",
          durationMs: 200,
        },
      },
      toolArtifacts: [
        {
          toolId: "semgrep",
          lane: "qa",
          runId: "sg-1",
          status: "completed",
          summary: "Semgrep clean",
          findings: [],
          createdAt: new Date().toISOString(),
        },
      ],
    });

    assert.match(report.headline, /3 tests/);
    assert.match(report.headline, /3 passed/);
    assert.equal(report.totals.passed, 3);
    assert.equal(report.executed.some((item) => item.name === "Playwright @smoke"), true);
    assert.equal(report.planned[0].status, "pass");
    assert.equal(report.tools.some((tool) => tool.tool === "semgrep" && tool.status === "ran"), true);
    assert.match(report.markdown, /\[PASS\] throws on divide by zero/);
    assert.match(report.markdown, /semgrep/);
  });

  it("says when nothing executed", () => {
    const report = buildTestConductReport({
      qa,
      executionReport: {
        generatedAt: new Date().toISOString(),
        summary: "none",
        overallRecommendation: "request_changes",
        criteriaCoverage: { total: 1, covered: 0, uncovered: ["Throw"] },
        executionStatus: "unavailable",
      },
    });
    assert.match(report.headline, /no tests executed/i);
    assert.equal(report.totals.executed, 0);
  });

  it("joins planned cases to executed tests by title, not TC id", () => {
    assert.equal(
      matchPlannedStatus(
        { id: "TC-001", title: "throws on divide by zero" },
        [{ name: "calculator > throws on divide by zero", status: "pass" }]
      ),
      "pass"
    );
    assert.equal(
      matchPlannedStatus({ id: "TC-002", title: "unrelated" }, [
        { name: "adds two numbers", status: "fail" },
      ]),
      undefined
    );
  });
});
