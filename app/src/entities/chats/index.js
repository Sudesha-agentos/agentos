import { useEffect, useState } from "react";
import { listAgentChatThreads } from "../agent-chat";

const STORAGE_KEY = "agentos.chats";
export const CHATS_CHANGED_EVENT = "agentox-chats-changed";

function newId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function readStore() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStore(chats) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
  window.dispatchEvent(new CustomEvent(CHATS_CHANGED_EVENT));
}

export function listStoredChats() {
  return readStore().sort(
    (a, b) => new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime()
  );
}

export function getStoredChat(id) {
  return readStore().find((chat) => chat.id === id) ?? null;
}

export function upsertStoredChat(next) {
  const chats = readStore();
  const index = chats.findIndex((chat) => chat.id === next.id);
  const row = {
    ...chats[index],
    ...next,
    updatedAt: next.updatedAt ?? new Date().toISOString(),
  };
  if (index >= 0) chats[index] = row;
  else chats.unshift(row);
  writeStore(chats);
  return row;
}

export function createChatRecord({
  domain = "virin",
  title = "New chat",
  operation = null,
  starter = "",
} = {}) {
  const id = newId();
  const now = new Date().toISOString();
  return upsertStoredChat({
    id,
    domain,
    contextKey: `chat:${id}`,
    title,
    operation,
    starter,
    threadId: null,
    createdAt: now,
    updatedAt: now,
  });
}

export function touchChat(id, patch = {}) {
  const existing = getStoredChat(id);
  if (!existing) return null;
  return upsertStoredChat({ ...existing, ...patch });
}

function threadToChat(thread) {
  const contextKey = thread.contextKey || "";
  const id = contextKey.startsWith("chat:") ? contextKey.slice(5) : thread.id;
  return {
    id,
    domain: thread.agentDomain,
    contextKey,
    title: thread.title || "Chat",
    threadId: thread.id,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
  };
}

export async function hydrateChatsFromApi() {
  try {
    const threads = await listAgentChatThreads();
    if (!Array.isArray(threads) || threads.length === 0) return listStoredChats();
    const local = readStore();
    const byKey = new Map(local.map((chat) => [chat.contextKey || `chat:${chat.id}`, chat]));
    for (const thread of threads) {
      if (!thread.contextKey?.startsWith("chat:")) continue;
      const mapped = threadToChat(thread);
      const prev = byKey.get(mapped.contextKey);
      byKey.set(mapped.contextKey, { ...prev, ...mapped, operation: prev?.operation ?? null });
    }
    const merged = [...byKey.values()].sort(
      (a, b) => new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime()
    );
    writeStore(merged);
    return merged;
  } catch {
    return listStoredChats();
  }
}

export function useStoredChats() {
  const [chats, setChats] = useState(() => listStoredChats());

  useEffect(() => {
    function refresh() {
      setChats(listStoredChats());
    }
    window.addEventListener(CHATS_CHANGED_EVENT, refresh);
    window.addEventListener("storage", refresh);
    void hydrateChatsFromApi().then(setChats);
    return () => {
      window.removeEventListener(CHATS_CHANGED_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  return chats;
}
