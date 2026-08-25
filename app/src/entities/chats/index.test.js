import { beforeEach, describe, expect, it } from "vitest";
import {
  createChatRecord,
  findStoredChatByContextKey,
  getStoredChat,
} from "./index";

describe("stored chats", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("stores an explicit context key so Virin tickets can reuse a dashboard chat", () => {
    const chat = createChatRecord({
      domain: "virin",
      title: "PLT-42",
      contextKey: "PLT-42",
    });

    expect(getStoredChat(chat.id)?.contextKey).toBe("PLT-42");
    expect(findStoredChatByContextKey("plt-42")?.id).toBe(chat.id);
  });

  it("returns null when no chat matches the context key", () => {
    createChatRecord({ domain: "virin", title: "New chat" });
    expect(findStoredChatByContextKey("PLT-99")).toBeNull();
  });
});
