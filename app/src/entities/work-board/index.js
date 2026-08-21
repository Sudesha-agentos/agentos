import { apiPath } from "../../shared/config/apiBase";
import { authHeaders } from "../../shared/lib/authHeaders";
import { fetchJson, formatApiError } from "../../shared/lib/fetchJson";
import { useResource } from "../../shared/lib/useResource";

const root = (path = "") => apiPath("/api", `/work-board${path}`);

function headers(extra = {}) {
  return { ...authHeaders(), ...extra };
}

async function parseResponse(res) {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(formatApiError(text, res.status));
  }
  if (res.status === 204) return null;
  return res.json();
}

export function getWorkBoardStatus() {
  return fetchJson(root("/status"), { headers: headers() });
}

export function getWorkBoard() {
  return fetchJson(root("/"), { headers: headers() });
}

export function createWorkItem(body) {
  return fetchJson(root("/items"), {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });
}

export function updateWorkItem(itemId, body) {
  return fetchJson(root(`/items/${encodeURIComponent(itemId)}`), {
    method: "PATCH",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });
}

export function startWorkItemIntake(itemId) {
  return fetchJson(root(`/items/${encodeURIComponent(itemId)}/intake`), {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({}),
  });
}

export async function previewWorkBoardImport(file) {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(root("/import"), {
    method: "POST",
    headers: authHeaders(),
    body: form,
  });
  return parseResponse(res);
}

export async function confirmWorkBoardImport(file) {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(root("/import?confirm=1"), {
    method: "POST",
    headers: authHeaders(),
    body: form,
  });
  return parseResponse(res);
}

export async function downloadWorkBoardTemplate(kind = "xlsx") {
  const res = await fetch(root(`/template.${kind}`), { headers: authHeaders() });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(formatApiError(text, res.status));
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `agentox-work-board.${kind}`;
  a.click();
  URL.revokeObjectURL(url);
}

export function useWorkBoard(options = {}) {
  return useResource(() => getWorkBoard(), [], {
    pollMs: options.pollMs ?? 15000,
    skip: options.skip,
  });
}

export function useWorkBoardStatus(options = {}) {
  return useResource(() => getWorkBoardStatus(), [], {
    pollMs: options.pollMs ?? 12000,
    skip: options.skip,
  });
}
