import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ticketNeedsDatabase } from "./databaseNeed";
import { buildEngineeringCodingInitialUserMessage } from "./inputBuilder";
import type { ImplementationOutput, PrdOutput } from "../types/agents";

const prd: PrdOutput = {
  title: "Add saved filters",
  problemStatement: "PMs cannot reuse Jira filters.",
  proposedSolution: "Persist named filters per workspace.",
  userStories: ["As a PM I can save a filter"],
  acceptanceCriteria: ["User can save a named filter", "Saved filters reload on next visit"],
  outOfScope: ["Shared org filters"],
  edgeCases: ["Empty name is rejected"],
  dependencies: [],
  successMetrics: ["At least one saved filter per active workspace"],
  openQuestions: [],
  confidenceScore: 0.8,
  confidenceReason: "test",
};

const implementation: ImplementationOutput = {
  summary: "Add filter persistence",
  technicalApproach: "Store filters on the workspace record",
  components: [{ name: "filters API", description: "CRUD", estimatedDays: 1 }],
  apiChanges: ["POST /filters"],
  databaseChanges: [],
  dependencies: [],
  risks: [],
  totalEstimateDays: 1,
  criteriaMapping: [
    { criterion: "User can save a named filter", implementation: "POST /filters" },
  ],
  blockers: [],
  confidenceScore: 0.8,
  confidenceReason: "test",
};

describe("ticketNeedsDatabase", () => {
  it("is true when the plan lists database changes", () => {
    assert.equal(
      ticketNeedsDatabase(prd, { ...implementation, databaseChanges: ["filters table"] }),
      true
    );
  });

  it("is true when the PRD mentions schema work", () => {
    assert.equal(
      ticketNeedsDatabase({
        ...prd,
        proposedSolution: "Add a postgres migration for named filters",
      }),
      true
    );
  });

  it("is false for a UI-only ticket", () => {
    assert.equal(ticketNeedsDatabase(prd, implementation), false);
  });
});

describe("buildEngineeringCodingInitialUserMessage", () => {
  it("leads with codebase intel, databases, logs, and the entire PRD", () => {
    const message = buildEngineeringCodingInitialUserMessage({
      pipelineId: "pipe-1",
      jiraKey: "AO-1",
      prd,
      implementation,
      enrichedPrdDocument: {},
      branchName: "main",
      selectedModelLabel: "ChatGPT · gpt-5.1",
      codebaseIntelligenceBlock: "## 1. Codebase intelligence layer\nRepo: acme/app",
      databaseCatalogBlock: "CUSTOMER DATABASES: none connected.",
      logIntelligenceBlock: "## 3. Log intelligence\nNo log sources connected.",
      mustAskForDatabase: true,
    });

    assert.match(message, /Selected Tech LLM: ChatGPT · gpt-5\.1/);
    assert.match(message, /## 1\. Codebase intelligence layer/);
    assert.match(message, /## 2\. Customer databases/);
    assert.match(message, /## 3\. Log intelligence/);
    assert.match(message, /## 4\. Entire PRD/);
    assert.match(message, /"title": "Add saved filters"/);
    assert.match(message, /STOP on schema work/);
    assert.match(message, /Write production-quality code/);
    assert.equal(message.indexOf("## 1. Codebase intelligence"), message.lastIndexOf("## 1. Codebase intelligence"));
    assert.ok(message.indexOf("## 4. Entire PRD") < message.indexOf("Implementation plan summary:"));
  });
});
