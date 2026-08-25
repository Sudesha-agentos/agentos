import { describe, expect, it } from "vitest";
import { compactProperties } from "./mixpanel";
import { shouldTrackPrdCompleted } from "./useTrackPrdCompleted";

describe("compactProperties", () => {
  it("omits null, undefined, and empty strings", () => {
    expect(
      compactProperties({
        jira_key: "PLT-1",
        prd_confidence: 0,
        skip_empty: "",
        skip_null: null,
        skip_undefined: undefined,
      })
    ).toEqual({ jira_key: "PLT-1", prd_confidence: 0 });
  });
});

describe("shouldTrackPrdCompleted", () => {
  const base = {
    status: "COMPLETED",
    generatedPrd: { title: "PRD" },
    id: "PLT-1",
    alreadyFired: false,
  };

  it("fires only when a running analysis becomes completed with a PRD", () => {
    expect(shouldTrackPrdCompleted({ ...base, prevStatus: "RUNNING" })).toBe(true);
    expect(shouldTrackPrdCompleted({ ...base, prevStatus: "AWAITING_INPUT" })).toBe(true);
    expect(shouldTrackPrdCompleted({ ...base, prevStatus: undefined })).toBe(false);
    expect(shouldTrackPrdCompleted({ ...base, prevStatus: "COMPLETED" })).toBe(false);
    expect(shouldTrackPrdCompleted({ ...base, prevStatus: "RUNNING", generatedPrd: null })).toBe(
      false
    );
    expect(shouldTrackPrdCompleted({ ...base, prevStatus: "RUNNING", alreadyFired: true })).toBe(
      false
    );
  });
});
