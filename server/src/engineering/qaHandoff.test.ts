import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertQaHandoffReady,
  buildReadyQaHandoff,
  formatQaHandoffForPrompt,
  QA_HANDOFF_OK,
} from "./qaHandoff";

describe("qaHandoff", () => {
  it("builds a 200 handoff only when a branch and commit exist", () => {
    const handoff = buildReadyQaHandoff({
      jiraKey: "AO-1",
      implementationBranch: "agentos/ao-1",
      commitSha: "abc123",
      filesChanged: 3,
      codingSummary: "Saved filters",
    });
    assert.equal(handoff.status, QA_HANDOFF_OK);
    assert.equal(handoff.readyForQa, true);
    assert.equal(assertQaHandoffReady(handoff).implementationBranch, "agentos/ao-1");
    assert.match(formatQaHandoffForPrompt(handoff), /status: 200/);
  });

  it("refuses QA when the 200 handoff is missing", () => {
    assert.throws(() => assertQaHandoffReady(null), /status 200/);
    assert.throws(
      () =>
        buildReadyQaHandoff({
          jiraKey: "AO-1",
          implementationBranch: "",
          commitSha: "abc",
          filesChanged: 1,
          codingSummary: "x",
        }),
      /implementation branch/
    );
  });
});
