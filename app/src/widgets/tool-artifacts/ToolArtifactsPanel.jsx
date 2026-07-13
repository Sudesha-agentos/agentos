import { useEffect, useMemo, useState } from "react";
import { Panel, PanelHeader } from "../../shared/ui/Panel";
import { fetchJson } from "../../shared/lib/fetchJson";
import { authHeaders } from "../../shared/lib/authHeaders";
import { apiPath } from "../../shared/config/apiBase";

const LANE_SUBTITLE = {
  engineering: "Aider, Tree-sitter, and mini-SWE / ACI outputs for this ticket.",
  qa: "Semgrep, Playwright, Cover-Agent, and Hypothesis — run every ticket.",
  canary: "Playwright monitor, OWASP ZAP, and Locust — run every canary cycle.",
  codebase: "Codebase intelligence tool outputs.",
};

const EXPECTED_BY_LANE = {
  engineering: [
    { id: "aider", label: "Aider editblocks" },
    { id: "tree-sitter", label: "Tree-sitter symbols" },
    { id: "mini-swe-agent", label: "mini-SWE / ACI" },
  ],
  qa: [
    { id: "semgrep", label: "Semgrep" },
    { id: "playwright", label: "Playwright smoke" },
    { id: "playwright-monitor", label: "Playwright monitor" },
    { id: "cover-agent", label: "Cover-Agent" },
    { id: "hypothesis", label: "Hypothesis" },
  ],
  canary: [
    { id: "playwright-monitor", label: "Playwright monitor" },
    { id: "zap", label: "OWASP ZAP" },
    { id: "locust", label: "Locust" },
  ],
};

const STATUS_STYLE = {
  completed: "border-success/30 text-success",
  failed: "border-danger/30 text-danger",
  skipped: "border-warning/30 text-warning",
  running: "border-indigo/30 text-indigo",
  pending: "border-app-border text-app-ink-mute",
};

/**
 * Surfaces ToolArtifact rows for a pipeline (or canary run id used as scope key).
 * Always shows the expected tool checklist for the lane so nothing stays invisible.
 */
export default function ToolArtifactsPanel({
  pipelineId,
  lane = "engineering",
  pollMs = 8000,
  title = "OSS tool outputs",
}) {
  const [artifacts, setArtifacts] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!pipelineId) return;
    let cancelled = false;

    async function load() {
      const qs = lane ? `?lane=${encodeURIComponent(lane)}` : "";
      try {
        const data = await fetchJson(
          apiPath("/api", `/engineering/runs/${pipelineId}/tool-artifacts${qs}`),
          { headers: authHeaders() }
        );
        if (!cancelled) {
          setArtifacts(data.artifacts ?? []);
          setError("");
        }
      } catch (err) {
        if (!cancelled) setError(err?.message || "Failed to load tool artifacts");
      }
    }

    load();
    if (!pollMs) {
      return () => {
        cancelled = true;
      };
    }
    const id = setInterval(load, pollMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [pipelineId, lane, pollMs]);

  const expected = EXPECTED_BY_LANE[lane] ?? [];

  const byTool = useMemo(() => {
    const map = new Map();
    for (const a of artifacts) {
      const prev = map.get(a.toolId);
      if (!prev || (a.createdAt || "") > (prev.createdAt || "")) {
        map.set(a.toolId, a);
      }
    }
    return map;
  }, [artifacts]);

  if (!pipelineId) return null;

  return (
    <Panel>
      <PanelHeader
        kicker="Tool adapters"
        title={title}
        subtitle={LANE_SUBTITLE[lane] ?? LANE_SUBTITLE.engineering}
      />
      <div className="space-y-4 px-5 py-4 sm:px-6">
        {error ? <p className="text-sm text-danger">{error}</p> : null}

        {expected.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {expected.map((tool) => {
              const hit = byTool.get(tool.id);
              const status = hit?.status ?? "pending";
              return (
                <span
                  key={tool.id}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                    STATUS_STYLE[status] ?? STATUS_STYLE.pending
                  }`}
                  title={hit?.summary || "Waiting for ticket run"}
                >
                  {tool.label}
                  <span className="ml-1 opacity-70">· {status}</span>
                </span>
              );
            })}
          </div>
        ) : null}

        {!error && artifacts.length === 0 ? (
          <p className="text-sm text-app-ink-mute">
            Waiting for this ticket&apos;s {lane} adapters. Checklist above fills as each tool
            finishes (or soft-skips if the CLI is missing).
          </p>
        ) : null}

        {artifacts.map((a) => (
          <div
            key={a.runId}
            className="rounded-app-sm border border-app-border bg-app-surface-muted/40 px-3 py-3"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="type-kicker">{a.toolId}</span>
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${
                  STATUS_STYLE[a.status] ?? STATUS_STYLE.pending
                }`}
              >
                {a.status}
              </span>
              <span className="ml-auto text-[11px] text-app-ink-mute">
                {a.createdAt ? new Date(a.createdAt).toLocaleString() : ""}
              </span>
            </div>
            <p className="mt-1 text-[13px] text-app-ink">{a.summary}</p>
            {a.findings?.length ? (
              <ul className="mt-2 max-h-48 space-y-1 overflow-auto text-[12px] text-app-ink-dim">
                {a.findings.slice(0, 30).map((f) => (
                  <li key={f.id}>
                    <span className="font-medium text-app-ink">{f.title}</span>
                    {f.path ? <span className="text-app-ink-mute"> · {f.path}</span> : null}
                    {f.detail ? <span> — {String(f.detail).slice(0, 240)}</span> : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ))}
      </div>
    </Panel>
  );
}
