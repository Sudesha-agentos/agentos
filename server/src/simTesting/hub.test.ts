import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createSimRun, emitSimEvent, completeSimRun, isSimPipelineId } from "./hub";

describe("simTesting hub", () => {
  it("records timed events and completes a run", () => {
    const run = createSimRun("org-1", "Add a calculator");
    assert.equal(isSimPipelineId(run.id), true);
    emitSimEvent(run.id, { agent: "virin", kind: "stage", label: "PRD" });
    completeSimRun(run.id, { jiraKey: "SIM-1", branch: "agentos/sim-1", qaTestCases: 8 });
    assert.equal(run.status, "completed");
    assert.ok(run.events.some((event) => event.kind === "done"));
    assert.ok(run.events[0].elapsedMs >= 0);
  });
});
