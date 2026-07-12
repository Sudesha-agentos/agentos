import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { proposeLocatorHeal, scoreLocatorMatch, buildFingerprint } from "./locatorHeal";

describe("locatorHeal", () => {
  it("scores attribute matches", () => {
    const fp = buildFingerprint({ id: "save-btn", role: "button", text: "Save" });
    const { score, matched } = scoreLocatorMatch(fp, {
      id: "save-btn",
      role: "button",
      text: "Save",
    });
    assert.ok(score >= 0.9);
    assert.ok(matched.includes("id"));
  });

  it("requires human review below auto-heal threshold", () => {
    const proposal = proposeLocatorHeal({
      testFile: "e2e/save.spec.ts",
      testName: "saves form",
      oldPrimary: "#old-save",
      fingerprint: buildFingerprint({ text: "Save", role: "button" }),
      candidates: [{ text: "Save", role: "button" }],
    });
    assert.ok(proposal.confidence > 0);
    // text+role only — may be under 0.8 depending on weights
    if (proposal.confidence < 0.8) {
      assert.equal(proposal.requiresHumanReview, true);
    }
  });
});
