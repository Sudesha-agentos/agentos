import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeExplainableConfidence,
  estimateModuleRiskFromText,
} from "./explainableConfidence";

describe("computeExplainableConfidence", () => {
  it("scores high when criteria covered, tests ran green, security clean", () => {
    const result = computeExplainableConfidence({
      criteriaCoveragePercent: 100,
      moduleRisk: 0.2,
      sandboxAvailable: true,
      testRunStatus: "completed",
      totalTests: 10,
      failedTests: 0,
      securityCriticalCount: 0,
      securityHighCount: 0,
    });
    assert.ok(result.score >= 0.85, `expected high score, got ${result.score}`);
    assert.equal(result.testsNotExecuted, false);
    assert.ok(result.breakdown.length >= 5);
  });

  it("caps score when tests never ran", () => {
    const result = computeExplainableConfidence({
      criteriaCoveragePercent: 100,
      moduleRisk: 0.1,
      sandboxAvailable: false,
      testRunStatus: "error",
      totalTests: 0,
      failedTests: 0,
    });
    assert.equal(result.testsNotExecuted, true);
    assert.ok(result.score <= 0.45, `expected capped score, got ${result.score}`);
  });

  it("estimates higher module risk for auth/billing text", () => {
    assert.ok(
      estimateModuleRiskFromText("SSO auth billing payment") >
        estimateModuleRiskFromText("update tooltip copy")
    );
  });
});
