import { describe, expect, it } from "vitest";
import { deriveReviewQueueItems } from "./pipelineCounts";

describe("deriveReviewQueueItems", () => {
  it("uses real gate issues instead of hardcoded copy", () => {
    const items = deriveReviewQueueItems(
      [
        {
          id: "pl_1",
          jiraKey: "AG-1",
          summary: "Export audit CSV",
          status: "PAUSED",
          currentStage: "IMPLEMENTATION_VALIDATION",
          startedAt: new Date().toISOString(),
          latestValidation: {
            passed: false,
            score: 0.2,
            issues: [
              {
                code: "ATTRIBUTION_MISSING",
                severity: "error",
                message: "No requirement link for src/discountEngine.ts",
              },
            ],
            amberFlags: [],
            checkedAt: new Date().toISOString(),
          },
        },
      ],
      (...segments) => `/app/${segments.join("/")}`
    );

    expect(items).toHaveLength(1);
    expect(items[0].reason).toContain("discountEngine");
    expect(items[0].actionTo).toBe("/app/pipelines/pl_1/override");
  });
});
