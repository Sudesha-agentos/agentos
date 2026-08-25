import { describe, expect, it } from "vitest";
import { mergeVirinDiscoveryMessages } from "./virinChatTranscript";

describe("mergeVirinDiscoveryMessages", () => {
  it("appends a pending Virin question so dashboard chat can show it", () => {
    const merged = mergeVirinDiscoveryMessages([], {
      jiraKey: "PLT-42",
      status: "AWAITING_INPUT",
      pendingQuestion: "Who is the primary user?",
      pendingQuestionOptions: ["PM", "Engineer"],
      questionMode: { conversation: [], plannedQuestions: [], maxTurns: 12 },
    });

    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({
      role: "assistant",
      content: "Who is the primary user?",
      metadata: {
        kind: "discovery_question",
        pending: true,
        jiraKey: "PLT-42",
      },
    });
  });
});
