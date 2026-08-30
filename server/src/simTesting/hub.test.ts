import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addSimPrompt,
  collectSimAnswers,
  createSimRun,
  emitSimEvent,
  completeSimRun,
  isSimPipelineId,
  recordSimUsage,
  resolveSimPrompt,
  waitForSimPromptsClear,
} from "./hub";

describe("simTesting hub", () => {
  it("records timed events and completes a run", () => {
    const run = createSimRun("org-1", "Add a calculator");
    assert.equal(isSimPipelineId(run.id), true);
    emitSimEvent(run.id, { agent: "virin", kind: "stage", label: "PRD" });
    recordSimUsage(run.id, {
      agent: "virin",
      stage: "Virin PRD",
      model: "gpt-5.1",
      inputTokens: 200,
      outputTokens: 800,
    });
    completeSimRun(run.id, { jiraKey: "SIM-1", branch: "agentos/sim-1", qaTestCases: 8 });
    assert.equal(run.status, "completed");
    assert.ok(run.events.some((event) => event.kind === "done"));
    assert.ok(run.events.some((event) => event.kind === "usage"));
    assert.equal(run.usage.inputTokens, 200);
    assert.equal(run.usage.outputTokens, 800);
    assert.ok(run.usage.costUsd > 0);
    assert.ok(run.events[0].elapsedMs >= 0);
  });

  it("records questions and approvals without blocking the run", () => {
    const run = createSimRun("org-1", "Add a calculator");
    const prompt = addSimPrompt(run.id, {
      agent: "virin",
      kind: "question",
      title: "Divide by zero",
      body: "Should divide throw or return null?",
    });
    assert.ok(prompt);
    assert.equal(run.prompts.length, 1);
    resolveSimPrompt(run.id, prompt.id, { action: "answer", answer: "Throw an error" });
    assert.equal(run.prompts[0].status, "answered");
    assert.equal(run.prompts[0].answer, "Throw an error");
    const answers = collectSimAnswers(run.id);
    assert.equal(answers[0].question, "Should divide throw or return null?");
    assert.equal(answers[0].answer, "Throw an error");
  });

  it("does not resume until every question has an answer", async () => {
    const run = createSimRun("org-1", "Add a calculator");
    const first = addSimPrompt(run.id, {
      agent: "virin",
      kind: "question",
      title: "Q1",
      body: "Should divide throw?",
    });
    const second = addSimPrompt(run.id, {
      agent: "virin",
      kind: "question",
      title: "Q2",
      body: "What precision?",
    });
    assert.ok(first && second);
    let released = false;
    const pending = waitForSimPromptsClear(run.id).then(() => {
      released = true;
    });
    resolveSimPrompt(run.id, first.id, { action: "answer", answer: "Throw" });
    await Promise.resolve();
    assert.equal(released, false);
    assert.equal(collectSimAnswers(run.id).length, 1);
    resolveSimPrompt(run.id, second.id, { action: "dismiss" });
    await Promise.resolve();
    assert.equal(released, false);
    assert.equal(second.status, "open");
    resolveSimPrompt(run.id, second.id, { action: "answer", answer: "   " });
    await Promise.resolve();
    assert.equal(released, false);
    resolveSimPrompt(run.id, second.id, { action: "answer", answer: "Two decimals" });
    await pending;
    assert.equal(released, true);
    assert.equal(collectSimAnswers(run.id).length, 2);
  });

  it("resolves waitForSimPromptsClear after the last open prompt", async () => {
    const run = createSimRun("org-1", "Add a calculator");
    const prompt = addSimPrompt(run.id, {
      agent: "virin",
      kind: "approval",
      title: "Continue",
      body: "Continue to Ananta",
    });
    assert.ok(prompt);
    const pending = waitForSimPromptsClear(run.id);
    resolveSimPrompt(run.id, prompt.id, { action: "approve" });
    await pending;
  });
});
