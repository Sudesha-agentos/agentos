import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createSimRun, emitSimEvent, completeSimRun, isSimPipelineId, recordSimUsage } from "./hub";

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
});
