import { describe, expect, it } from "vitest";
import { buildDashboardStream } from "./DashboardStream";

describe("buildDashboardStream", () => {
  it("orders operations by time and keeps chat last", () => {
    const items = buildDashboardStream({
      reviewItems: [
        { id: "r1", waitingMinutes: 10, jiraKey: "A-1", summary: "Review me" },
      ],
      events: [{ id: "e1", timestamp: "2026-01-01T00:00:00.000Z", message: "started" }],
      completions: [{ id: "c1", completedAt: "2026-01-02T00:00:00.000Z", jiraKey: "A-2" }],
      messages: [
        { id: "m1", role: "user", content: "hi", createdAt: "2020-01-01T00:00:00.000Z" },
      ],
    });

    expect(new Set(items.map((row) => row.kind))).toEqual(
      new Set(["review", "activity", "completion", "chat"])
    );
    expect(items.at(-1).kind).toBe("chat");
    expect(items.at(-1).message.content).toBe("hi");
  });
});
