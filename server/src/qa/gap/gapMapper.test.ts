import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mapCoverageGaps } from "./gapMapper";

describe("mapCoverageGaps", () => {
  it("flags uncovered criteria as gaps and builds edges", () => {
    const result = mapCoverageGaps({
      acceptanceCriteria: ["User can export CSV", "Admin sees audit log"],
      changedFiles: ["app/src/export.ts", "server/src/audit.ts"],
      testCases: [
        {
          id: "TC-001",
          linkedCriterion: "User can export CSV",
          type: "unit",
        },
      ],
    });
    assert.equal(result.gaps.length, 1);
    assert.match(result.gaps[0]!.criterion, /audit log/i);
    assert.equal(result.edges.length, 2);
    assert.ok(result.edges[0]!.testIds.includes("TC-001"));
  });
});
