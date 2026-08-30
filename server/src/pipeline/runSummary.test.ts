import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildPipelineRunSummary } from "./runSummary";
import type { ImplementationOutput, PrdOutput, QaOutput } from "../types/agents";

const prd = {
  title: "Saved filters",
  problemStatement: "p",
  proposedSolution: "s",
  userStories: [],
  acceptanceCriteria: ["Save a filter"],
  outOfScope: [],
  edgeCases: [],
  dependencies: [],
  successMetrics: [],
  openQuestions: [],
  confidenceScore: 1,
  confidenceReason: "t",
} as PrdOutput;

const implementation = {
  summary: "Persist filters",
  technicalApproach: "API",
  components: [],
  apiChanges: [],
  databaseChanges: [],
  dependencies: [],
  risks: [],
  totalEstimateDays: 1,
  criteriaMapping: [],
  blockers: [],
  confidenceScore: 1,
  confidenceReason: "t",
  codingSummary: "Added POST /filters",
  codeChanges: [{ filePath: "server/src/filters.ts", action: "create", summary: "api", linesChanged: 20 }],
} as ImplementationOutput;

const qa = {
  testSummary: "Covered save + reload",
  testCases: [],
  coverageReport: {
    totalCriteria: 2,
    coveredCriteria: 2,
    coveragePercent: 88,
    uncoveredCriteria: [],
  },
  riskAreas: [],
  automationRecommendations: [],
  recommendation: "ship",
  confidenceScore: 1,
  confidenceReason: "t",
} as unknown as QaOutput;

describe("buildPipelineRunSummary", () => {
  it("summarizes PRD, branch, files, QA, and marks completed", () => {
    const summary = buildPipelineRunSummary({
      jiraKey: "AO-1",
      prd,
      implementation,
      qa,
      implementationBranch: "agentos/ao-1",
      executionReport: { testRun: { passed: 4, failed: 0 } },
    });
    assert.equal(summary.status, "completed");
    assert.equal(summary.markedCompleted, true);
    assert.equal(summary.branch, "agentos/ao-1");
    assert.deepEqual(summary.filesChanged, ["server/src/filters.ts"]);
    assert.equal(summary.testsPassed, 4);
    assert.ok(summary.whatWasDone.some((line) => /4 passed/.test(line)));
    assert.ok(summary.whatWasDone.some((line) => line.includes("agentos/ao-1")));
    assert.ok(summary.whatWasDone.some((line) => /marked completed/i.test(line)));
  });
});
