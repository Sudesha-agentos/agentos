import { useCallback, useEffect, useState } from "react";
import { apiPath } from "../../shared/config/apiBase";
import { authHeaders } from "../../shared/lib/authHeaders";
import { fetchJson } from "../../shared/lib/fetchJson";

function li(path) {
  return apiPath("/api", `/log-intelligence${path}`);
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
  return fetchJson(li("/sources"), { headers: authHeaders() });
}

export async function fetchLogSourceCatalog() {
  return fetchJson(li("/source-types"), { headers: authHeaders() });
}

export async function createLogSource(body) {
  return fetchJson(li("/sources"), {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
}

export async function validateLogSource(body) {
  return fetchJson(li("/sources/validate"), {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
}

export async function testLogSource(id) {
  return fetchJson(li(`/sources/${encodeURIComponent(id)}/test`), {
    method: "POST",
    headers: authHeaders(),
  });
}

export async function pullLogSource(id) {
  return fetchJson(li(`/sources/${encodeURIComponent(id)}/pull`), {
    method: "POST",
    headers: authHeaders(),
  });
}

export async function deleteLogSource(id) {
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
