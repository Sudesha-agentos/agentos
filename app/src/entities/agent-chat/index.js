import { DATA_MODE, DATA_MODES } from "../../shared/config/app";
import { apiPath } from "../../shared/config/apiBase";
import { authHeaders } from "../../shared/lib/authHeaders";
import { fetchJson } from "../../shared/lib/fetchJson";

const STORAGE_PREFIX = "agentos.agentChat.";

function headers(extra = {}) {
  return { ...authHeaders(), ...extra };
}

function storageKey(domain, contextKey) {
  return `${STORAGE_PREFIX}${domain}:${contextKey || ""}`;
}

const mockThreads = new Map();

function mockKey(domain, contextKey) {
  return `${domain}:${contextKey || ""}`;
}

function readMockThread(domain, contextKey) {
  if (typeof window === "undefined") return null;
  const mem = mockThreads.get(mockKey(domain, contextKey));
  if (mem) return mem;
  const raw = window.localStorage.getItem(storageKey(domain, contextKey));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    mockThreads.set(mockKey(domain, contextKey), parsed);
    return parsed;
  } catch {
    return null;
  }
}

function writeMockThread(domain, contextKey, thread) {
  if (thread) {
    mockThreads.set(mockKey(domain, contextKey), thread);
  } else {
    mockThreads.delete(mockKey(domain, contextKey));
  }
  if (typeof window !== "undefined") {
    if (thread) {
      window.localStorage.setItem(storageKey(domain, contextKey), JSON.stringify(thread));
    } else {
      window.localStorage.removeItem(storageKey(domain, contextKey));
    }
  }
}

function mockReply(domain, content) {
  const toolHint =
    domain === "virin"
      ? "search_historical_context"
      : domain === "ananta"
        ? "search_codebase"
        : "read_existing_tests";
  return {
    id: `mock-${Date.now()}`,
    role: "assistant",
    content: `**Mock ${domain} reply**: connect the API server for live tool calls.\n\nYou asked: "${content.slice(0, 120)}${content.length > 120 ? "…" : ""}"\n\nI would call \`${toolHint}\` and synthesize an answer from domain data.`,
    metadata: { toolCallLog: [{ tool: toolHint, query: content.slice(0, 40), resultsFound: 3 }] },
    createdAt: new Date().toISOString(),
  };
}

const restAdapter = {
  async listThreads() {
    const data = await fetchJson(apiPath("/api", "/agent-chat/threads"), {
      headers: headers(),
    });
    return data?.threads ?? [];
  },
  async getThread(domain, contextKey = "") {
    const qs = new URLSearchParams({ domain, contextKey });
    const data = await fetchJson(apiPath("/api", `/agent-chat/threads?${qs}`), {
      headers: headers(),
    });
    return data?.thread ?? null;
  },
  async ensureThread(domain, contextKey = "", title) {
    const existing = await this.getThread(domain, contextKey);
    if (existing) return existing;
    const data = await fetchJson(apiPath("/api", "/agent-chat/threads"), {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ domain, contextKey, title }),
    });
    return data.thread;
  },
  async listMessages(threadId) {
    const data = await fetchJson(apiPath("/api", `/agent-chat/threads/${threadId}/messages`), {
      headers: headers(),
    });
    return data?.messages ?? [];
  },
  async sendMessage(threadId, content) {
    return fetchJson(apiPath("/api", `/agent-chat/threads/${threadId}/messages`), {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({ content }),
    });
  },
  async clearThread(threadId) {
    return fetchJson(apiPath("/api", `/agent-chat/threads/${threadId}`), {
      method: "DELETE",
      headers: headers(),
    });
  },
};

const mockAdapter = {
  async listThreads() {
    if (typeof window === "undefined") return [];
    const threads = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (!key?.startsWith(STORAGE_PREFIX)) continue;
      try {
        const parsed = JSON.parse(window.localStorage.getItem(key) ?? "");
        if (parsed?.id) threads.push(parsed);
      } catch {
        /* ignore */
      }
    }
    return threads.sort(
      (a, b) => new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime()
    );
  },
  async getThread(domain, contextKey = "") {
    return readMockThread(domain, contextKey);
  },
  async ensureThread(domain, contextKey = "", title) {
    let thread = readMockThread(domain, contextKey);
    if (!thread) {
      thread = {
        id: `mock-thread-${domain}-${contextKey || "default"}`,
        agentDomain: domain,
        contextKey,
        title: title ?? null,
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      writeMockThread(domain, contextKey, thread);
    }
    return thread;
  },
  async listMessages(threadId) {
    return [];
  },
  async sendMessage(threadId, content) {
    const parts = threadId.replace("mock-thread-", "").split("-");
    const domain = parts[0] ?? "ananta";
    const contextKey = parts.slice(1).join("-").replace(/^default$/, "") || "";
    const thread =
      readMockThread(domain, contextKey) ?? {
        id: threadId,
        agentDomain: domain,
        contextKey,
        messages: [],
      };
    const userMessage = {
      id: `mock-u-${Date.now()}`,
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    };
    const assistantMessage = mockReply(domain, content);
    thread.messages = [...(thread.messages ?? []), userMessage, assistantMessage];
    thread.updatedAt = new Date().toISOString();
    writeMockThread(domain, contextKey, thread);
    return { userMessage, assistantMessage, toolCallLog: assistantMessage.metadata?.toolCallLog };
  },
  async clearThread(threadId) {
    const parts = threadId.replace("mock-thread-", "").split("-");
    const domain = parts[0] ?? "ananta";
    const contextKey = parts.slice(1).join("-").replace(/^default$/, "") || "";
    writeMockThread(domain, contextKey, null);
    return { ok: true };
  },
};

const adapter = DATA_MODE === DATA_MODES.REST ? restAdapter : mockAdapter;

export async function listAgentChatThreads() {
  return adapter.listThreads();
}

export async function ensureAgentChatThread(domain, contextKey = "", title) {
  return adapter.ensureThread(domain, contextKey, title);
}

export async function getAgentChatThread(domain, contextKey = "") {
  return adapter.getThread(domain, contextKey);
}

export async function sendAgentChatMessage(threadId, content) {
  return adapter.sendMessage(threadId, content);
}

export async function clearAgentChatThread(threadId) {
  return adapter.clearThread(threadId);
}
