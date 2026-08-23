import { useCallback, useEffect, useState } from "react";
import { DATA_MODE, DATA_MODES } from "../../shared/config/app";
import { apiPath } from "../../shared/config/apiBase";
import { authHeaders } from "../../shared/lib/authHeaders";
import { fetchJson } from "../../shared/lib/fetchJson";

function li(path) {
  return apiPath("/api", `/log-intelligence${path}`);
}

const MOCK_SOURCES_KEY = "agentos.mockLogSources";

function readMockSources() {
  try {
    const parsed = JSON.parse(localStorage.getItem(MOCK_SOURCES_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeMockSources(sources) {
  localStorage.setItem(MOCK_SOURCES_KEY, JSON.stringify(sources));
}

function isMock() {
  return DATA_MODE !== DATA_MODES.REST;
}

export async function fetchLogSummary() {
  return fetchJson(li("/summary"), { headers: authHeaders() });
}

export async function fetchLogPatterns(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return fetchJson(li(`/patterns${qs ? `?${qs}` : ""}`), {
    headers: authHeaders(),
  });
}

export async function fetchLogPattern(id) {
  return fetchJson(li(`/patterns/${encodeURIComponent(id)}`), {
    headers: authHeaders(),
  });
}

export async function fetchLogAnomalies(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return fetchJson(li(`/anomalies${qs ? `?${qs}` : ""}`), {
    headers: authHeaders(),
  });
}

export async function fetchLogSources() {
  if (isMock()) return { sources: readMockSources() };
  return fetchJson(li("/sources"), { headers: authHeaders() });
}

export async function fetchLogSourceCatalog() {
  if (isMock()) return { catalog: [], ingestDocs: null };
  return fetchJson(li("/source-types"), { headers: authHeaders() });
}

export async function createLogSource(body) {
  if (isMock()) {
    const source = {
      id: `mock_log_${Date.now()}`,
      sourceType: body.sourceType,
      displayName: body.displayName || body.sourceType,
      isActive: true,
      lastPulledAt: new Date().toISOString(),
      lastPullStatus: "ok",
      lastError: null,
      createdAt: new Date().toISOString(),
      catalog: { id: body.sourceType, mode: "pull" },
      endpoints: {},
    };
    writeMockSources([source, ...readMockSources()]);
    return { source, pull: { processed: 0 } };
  }
  return fetchJson(li("/sources"), {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
}

export async function validateLogSource(body) {
  if (isMock()) {
    return { valid: true, message: "Mock: credentials accepted." };
  }
  return fetchJson(li("/sources/validate"), {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
}

export async function testLogSource(id) {
  if (isMock()) return { mode: "mock", message: "Mock: source is healthy." };
  return fetchJson(li(`/sources/${encodeURIComponent(id)}/test`), {
    method: "POST",
    headers: authHeaders(),
  });
}

export async function pullLogSource(id) {
  if (isMock()) return { processed: 0 };
  return fetchJson(li(`/sources/${encodeURIComponent(id)}/pull`), {
    method: "POST",
    headers: authHeaders(),
  });
}

export async function deleteLogSource(id) {
  if (isMock()) {
    writeMockSources(readMockSources().filter((source) => source.id !== id));
    return { deleted: true };
  }
  return fetchJson(li(`/sources/${encodeURIComponent(id)}`), {
    method: "DELETE",
    headers: authHeaders(),
  });
}

export async function acknowledgePattern(id) {
  return fetchJson(li(`/patterns/${encodeURIComponent(id)}/acknowledge`), {
    method: "POST",
    headers: authHeaders(),
  });
}

export async function resolvePattern(id, bugJiraKey) {
  return fetchJson(li(`/patterns/${encodeURIComponent(id)}/resolve`), {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ bugJiraKey }),
  });
}

export async function analysePattern(id) {
  return fetchJson(li(`/patterns/${encodeURIComponent(id)}/analyse`), {
    method: "POST",
    headers: authHeaders(),
  });
}

export function useLogIntelligenceDashboard(pollMs = 30_000) {
  const [summary, setSummary] = useState(null);
  const [patterns, setPatterns] = useState([]);
  const [anomalies, setAnomalies] = useState([]);
  const [sources, setSources] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [ingestDocs, setIngestDocs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const [s, p, a, src, types] = await Promise.all([
        fetchLogSummary(),
        fetchLogPatterns({ status: "open", limit: "30" }),
        fetchLogAnomalies({ acknowledged: "false" }),
        fetchLogSources(),
        fetchLogSourceCatalog().catch(() => ({ catalog: [], ingestDocs: null })),
      ]);
      setSummary(s);
      setPatterns(p.patterns ?? []);
      setAnomalies(a.anomalies ?? []);
      setSources(src.sources ?? []);
      setCatalog(types.catalog ?? []);
      setIngestDocs(types.ingestDocs ?? null);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    if (!pollMs) return undefined;
    const t = setInterval(() => void refresh(), pollMs);
    return () => clearInterval(t);
  }, [refresh, pollMs]);

  return {
    summary,
    patterns,
    anomalies,
    sources,
    catalog,
    ingestDocs,
    loading,
    error,
    refresh,
  };
}
