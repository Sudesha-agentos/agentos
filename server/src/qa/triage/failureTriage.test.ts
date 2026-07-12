import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { triageFailure } from "./failureTriage";

describe("triageFailure", () => {
  it("classifies environment failures", () => {
    const t = triageFailure(
      { error_message: "ECONNREFUSED 127.0.0.1:5432", test_name: "db" },
      ["DB available"],
      0
    );
    assert.equal(t.triageClass, "environment");
    assert.ok(t.triageConfidence >= 0.8);
  });

  it("classifies locator drift as stale_test", () => {
    const t = triageFailure(
      {
        error_message: "Timeout waiting for getByRole('button') locator",
        test_name: "click save",
      },
      ["User can save"],
      0
    );
    assert.equal(t.triageClass, "stale_test");
    assert.equal(t.requiresHumanOverride, false);
  });

  it("requires human override on unknown / low confidence", () => {
    const t = triageFailure({ error_message: "", test_name: "x" }, [], 0);
    assert.equal(t.triageClass, "unknown");
    assert.equal(t.requiresHumanOverride, true);
  });
});
