import { describe, expect, it } from "vitest";
import {
  assessCodebaseOverlap,
  buildAlreadyBuiltFlag,
  mergeOverlapIntoAnalysis,
} from "./alreadyBuiltAssessment";

describe("assessCodebaseOverlap", () => {
  it("flags already_shipped when exists without gaps", () => {
    expect(
      assessCodebaseOverlap({
        alreadyExists: ["app/src/app/pages/QaCenter.jsx — QA inbox"],
        gapsToBuild: [],
      })
    ).toBe("already_shipped");
  });

  it("respects model overlapVerdict", () => {
    expect(
      assessCodebaseOverlap({
        alreadyExists: [],
        gapsToBuild: ["something"],
        overlapVerdict: "already_shipped",
      })
    ).toBe("already_shipped");
  });

  it("returns net_new when only gaps", () => {
    expect(
      assessCodebaseOverlap({
        alreadyExists: [],
        gapsToBuild: ["new endpoint"],
      })
    ).toBe("net_new");
  });

  it("returns partial_overlap when both sides present", () => {
    expect(
      assessCodebaseOverlap({
        alreadyExists: ["inbox API", "Ananta banner"],
        gapsToBuild: ["polish copy"],
      })
    ).toBe("partial_overlap");
  });

  it("mergeOverlapIntoAnalysis sets note for already_shipped", () => {
    const merged = mergeOverlapIntoAnalysis({
      relevantModules: [],
      reuseOpportunities: [],
      alreadyExists: ["existing feature"],
      gapsToBuild: [],
      technicalDebt: [],
      architectureConstraints: [],
      technicalRisks: [],
      testableAcceptanceCriteria: [],
      scopeAssessment: "small",
      suggestedFirstFile: "x",
    });
    expect(merged.overlapVerdict).toBe("already_shipped");
    expect(merged.alreadyShippedNote).toMatch(/already present/i);
    expect(buildAlreadyBuiltFlag(merged, "already_shipped")).toMatch(/Already built/);
  });
});
