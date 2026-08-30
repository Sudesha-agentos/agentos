import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ImplementationOutput, PrdOutput } from "../types/agents";
import { buildQaInitialUserMessage } from "./inputBuilder";

const prd: PrdOutput = {
  title: "Calculator",
  problemStatement: "Need divide",
  proposedSolution: "Add divide",
  userStories: ["As a user I can divide"],
  acceptanceCriteria: ["Divide by zero throws"],
  outOfScope: [],
  edgeCases: ["zero divisor"],
  dependencies: [],
  successMetrics: [],
  openQuestions: [],
  confidenceScore: 0.8,
  confidenceReason: "test",
};

const implementation: ImplementationOutput = {
  summary: "Add divide",
  technicalApproach: "Throw on /0",
  components: [],
  apiChanges: [],
  databaseChanges: [],
  dependencies: [],
  risks: [],
  totalEstimateDays: 1,
  criteriaMapping: [{ criterion: "Divide by zero throws", implementation: "throw" }],
  blockers: [],
  confidenceScore: 0.8,
  confidenceReason: "test",
  codeChanges: [{ filePath: "src/calc.ts", action: "modify", summary: "throw on /0" }],
};

describe("buildQaInitialUserMessage", () => {
  it("hands Neel the branch, the job, and human answers — not a coding JSON schema", () => {
    const message = buildQaInitialUserMessage({
      pipelineId: "pipe-1",
      jiraKey: "SIM-1",
      prd,
      implementation,
      retrievedContext: [],
      branchName: "agentos/sim-1",
      qaHandoff: {
        status: 200,
        readyForQa: true,
        jiraKey: "SIM-1",
        implementationBranch: "agentos/sim-1",
        commitSha: "abc123",
        filesChanged: 1,
        codingSummary: "Ananta finished on the workspace for SIM-1 (1 file).",
        compileFailed: false,
      },
      humanAnswers: [{ question: "Should divide throw?", answer: "Yes, throw" }],
    });

    assert.match(message, /agentos\/sim-1/);
    assert.match(message, /HUMAN_ANSWERS_JSON/);
    assert.match(message, /Yes, throw/);
    assert.match(message, /Divide by zero throws/);
    assert.match(message, /test that checkout/);
    assert.doesNotMatch(message, /final JSON test plan/);
  });
});
