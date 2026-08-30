import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeSimPrd } from "./simPrd";

describe("normalizeSimPrd", () => {
  it("flattens nested user-story criteria", () => {
    const prd = normalizeSimPrd(
      {
        title: "Calculator",
        userStories: [{ story: "As a user I can add", acceptanceCriteria: ["add(2,2) is 4"] }],
        openQuestions: [{ question: "Should divide throw?" }],
      },
      "Add a calculator"
    );
    assert.equal(prd.title, "Calculator");
    assert.deepEqual(prd.userStories, ["As a user I can add"]);
    assert.deepEqual(prd.acceptanceCriteria, ["add(2,2) is 4"]);
    assert.deepEqual(prd.openQuestions, ["Should divide throw?"]);
  });

  it("fills defaults when the model returns almost nothing", () => {
    const prd = normalizeSimPrd({}, "Add a calculator with divide-by-zero errors");
    assert.ok(prd.title);
    assert.ok(prd.acceptanceCriteria.length >= 2);
    assert.equal(prd.problemStatement.includes("calculator"), true);
  });
});
