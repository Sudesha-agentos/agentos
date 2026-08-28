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

  it("keeps Virin discovery questions in the chat stream", () => {
    const items = buildDashboardStream({
      messages: [
        {
          id: "virin-pending-PLT-42",
          role: "assistant",
          content: "Who is the primary user?",
          createdAt: "2026-08-26T00:00:00.000Z",
          metadata: { kind: "discovery_question", pending: true },
        },
      ],
    });

    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe("chat");
    expect(items[0].message.metadata.kind).toBe("discovery_question");
  });

  it("keeps issue and handoff messages in the chat stream", () => {
    const items = buildDashboardStream({
      messages: [
        {
          id: "release-issue-1",
          role: "assistant",
          content: "Need log access",
          createdAt: "2026-08-26T00:00:00.000Z",
          metadata: { kind: "issue", title: "Need log access", tone: "warning" },
        },
        {
          id: "release-handoff-1",
          role: "assistant",
          content: "1. **ENG-1** — Export API",
          createdAt: "2026-08-26T00:01:00.000Z",
          metadata: { kind: "handoff", tickets: [], handoffStatus: "not_started" },
        },
      ],
    });

    expect(items.map((row) => row.message.metadata.kind)).toEqual(["issue", "handoff"]);
  });

  it("keeps PRD, code, and QA artifacts in the chat stream", () => {
    const items = buildDashboardStream({
      messages: [
        {
          id: "release-prd-1",
          role: "assistant",
          content: "",
          createdAt: "2026-08-26T00:02:00.000Z",
          metadata: { kind: "prd", prd: { title: "Export PRD" } },
        },
        {
          id: "release-ananta-1",
          role: "assistant",
          content: "",
          createdAt: "2026-08-26T00:03:00.000Z",
          metadata: { kind: "ananta", files: [{ path: "src/a.ts" }] },
        },
        {
          id: "release-qa-1",
          role: "assistant",
          content: "",
          createdAt: "2026-08-26T00:04:00.000Z",
          metadata: { kind: "qa", coverage: { coveragePercent: 91 } },
        },
      ],
    });

    expect(items.map((row) => row.message.metadata.kind)).toEqual(["prd", "ananta", "qa"]);
  });
});
