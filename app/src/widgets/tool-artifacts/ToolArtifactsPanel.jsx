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
    { id: "semgrep", label: "Semgrep", hostId: "semgrep" },
    { id: "playwright", label: "Playwright smoke", hostId: "playwright" },
    { id: "playwright-monitor", label: "Playwright monitor", hostId: "playwright" },
    { id: "cover-agent", label: "Cover-Agent", hostId: "cover-agent" },
    { id: "hypothesis", label: "Hypothesis", hostId: "hypothesis" },
  ],
  canary: [
    { id: "playwright-monitor", label: "Playwright monitor", hostId: "playwright" },
    { id: "zap", label: "OWASP ZAP", hostId: "zap" },
    { id: "locust", label: "Locust", hostId: "locust" },
  ],
};

const STATUS_STYLE = {
  completed: "border-success/30 text-success",
  failed: "border-danger/30 text-danger",
  skipped: "border-warning/30 text-warning",
  running: "border-indigo/30 text-indigo",
  pending: "border-app-border text-app-ink-mute",
};

const FINDING_SEVERITY = {
  critical: "border-danger/40 text-danger bg-danger/5",
  high: "border-danger/30 text-danger",
  medium: "border-warning/30 text-warning",
  low: "border-app-border text-app-ink-dim",
  info: "border-app-border text-app-ink-mute",
};

function FindingRow({ finding }) {
  const sev = finding.severity || "info";
  const lines =
    finding.startLine != null
      ? finding.endLine != null && finding.endLine !== finding.startLine
        ? `L${finding.startLine}–${finding.endLine}`
        : `L${finding.startLine}`
      : null;

  return (
    <li
      className={`rounded-app-sm border px-2.5 py-2 text-[12px] ${
        FINDING_SEVERITY[sev] ?? FINDING_SEVERITY.info
      }`}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wide">{sev}</span>
        {finding.ruleId ? (
          <span className="font-mono text-[10px] opacity-70">{finding.ruleId}</span>
        ) : null}
      </div>
      <p className="mt-0.5 font-medium text-app-ink">{finding.title}</p>
      {finding.path ? (
        <p className="mt-0.5 font-mono text-[11px] text-app-ink-mute">
          {finding.path}
          {lines ? ` · ${lines}` : ""}
        </p>
      ) : null}
      {finding.detail ? (
        <p className="mt-1 text-app-ink-dim">{String(finding.detail).slice(0, 500)}</p>
      ) : null}
    </li>
  );
}

function ArtifactCard({ artifact }) {
  const [showRaw, setShowRaw] = useState(false);
  const [showAllFindings, setShowAllFindings] = useState(false);
  const findings = artifact.findings ?? [];
  const visible = showAllFindings ? findings.slice(0, 40) : findings.slice(0, 8);
  const raw =
    (typeof artifact.meta?.output === "string" && artifact.meta.output) ||
    (typeof artifact.meta?.error === "string" && artifact.meta.error) ||
    "";

  return (
    <div className="rounded-app-sm border border-app-border bg-app-surface-muted/40 px-3 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="type-kicker">{artifact.toolId}</span>
        <span
          className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${
            STATUS_STYLE[artifact.status] ?? STATUS_STYLE.pending
          }`}
        >
          {artifact.status}
        </span>
        {findings.length > 0 ? (
          <span className="text-[11px] text-app-ink-mute">{findings.length} finding(s)</span>
        ) : null}
        <span className="ml-auto text-[11px] text-app-ink-mute">
          {artifact.createdAt ? new Date(artifact.createdAt).toLocaleString() : ""}
        </span>
      </div>
      <p className="mt-1 text-[13px] text-app-ink">{artifact.summary}</p>
      {artifact.meta?.installHint ? (
        <p className="mt-1 font-mono text-[11px] text-app-ink-mute">{artifact.meta.installHint}</p>
      ) : null}

      {findings.length > 0 ? (
        <ul className="mt-2 max-h-64 space-y-1.5 overflow-auto">
          {visible.map((f) => (
            <FindingRow key={f.id} finding={f} />
          ))}
        </ul>
      ) : null}
      {findings.length > 8 ? (
        <button
          type="button"
          onClick={() => setShowAllFindings((v) => !v)}
          className="mt-1.5 text-[11px] font-medium text-indigo"
        >
          {showAllFindings ? "Show fewer findings" : `Show more findings (${findings.length - 8})`}
        </button>
      ) : null}

      {raw ? (
        <>
          <button
            type="button"
            onClick={() => setShowRaw((v) => !v)}
            className="mt-2 text-[11px] font-medium text-indigo"
          >
            {showRaw ? "Hide raw output" : "Show raw output"}
          </button>
          {showRaw ? (
            <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-app-sm border border-app-border bg-app-surface/60 p-2.5 font-mono text-[11px] text-app-ink-dim">
              {raw.slice(0, 6000)}
            </pre>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

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
  const [hostStatus, setHostStatus] = useState(null);
  const [filterTool, setFilterTool] = useState("all");

  useEffect(() => {
    let cancelled = false;
    fetchJson(apiPath("/api", "/integrations/oss-status"), { headers: authHeaders() })
      .then((data) => {
        if (!cancelled) setHostStatus(data);
      })
      .catch(() => {
        if (!cancelled) setHostStatus(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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

  const hostById = useMemo(() => {
    const map = new Map();
    for (const t of hostStatus?.tools ?? []) {
      map.set(t.id, t);
    }
    return map;
  }, [hostStatus]);

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

  const toolIds = useMemo(() => {
    const ids = [...new Set(artifacts.map((a) => a.toolId))];
    return ids.sort();
  }, [artifacts]);

  const filtered = useMemo(() => {
    if (filterTool === "all") return artifacts;
    return artifacts.filter((a) => a.toolId === filterTool);
  }, [artifacts, filterTool]);

  const missingHostTools = useMemo(() => {
    if (!hostStatus?.tools) return [];
    return expected
      .filter((t) => t.hostId)
      .map((t) => hostById.get(t.hostId))
      .filter((t) => t && !t.installed);
  }, [expected, hostById, hostStatus]);

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

        {hostStatus && !hostStatus.ready ? (
          <div className="rounded-app-sm border border-warning/40 bg-warning/10 px-3 py-2.5 text-[13px] text-app-ink">
            <p className="font-medium text-warning">Host not ready for OSS tools</p>
            <p className="mt-1 text-app-ink-dim">
              Semgrep and/or Playwright are missing on the API host
              {hostStatus.required
                ? " (OSS_TOOLS_REQUIRED — missing CLIs fail tickets instead of quiet skip)."
                : "."}{" "}
              Install via <code className="font-mono text-[12px]">scripts/install-oss-tools.sh</code>{" "}
              on Render (need ≥1GB RAM). Do not vendor full upstream repos.
            </p>
            {missingHostTools.length > 0 ? (
              <ul className="mt-2 list-inside list-disc text-[12px] text-app-ink-dim">
                {missingHostTools.map((t) => (
                  <li key={t.id}>
                    {t.label}: {t.installHint}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {hostStatus?.ready ? (
          <p className="text-[12px] text-success">
            Host CLIs ready (Semgrep + Playwright detected)
            {hostStatus.required ? " · required mode on" : ""}.
          </p>
        ) : null}

        {expected.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {expected.map((tool) => {
              const hit = byTool.get(tool.id);
              const host = tool.hostId ? hostById.get(tool.hostId) : null;
              const status = hit?.status ?? (host && !host.installed ? "failed" : "pending");
              return (
                <button
                  key={tool.id}
                  type="button"
                  onClick={() =>
                    setFilterTool((prev) => (prev === tool.id ? "all" : tool.id))
                  }
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                    STATUS_STYLE[status] ?? STATUS_STYLE.pending
                  } ${filterTool === tool.id ? "ring-1 ring-indigo/40" : ""}`}
                  title={
                    hit?.summary ||
                    (host && !host.installed
                      ? `Host missing: ${host.installHint}`
                      : "Waiting for ticket run — click to filter")
                  }
                >
                  {tool.label}
                  <span className="ml-1 opacity-70">· {status}</span>
                </button>
              );
            })}
          </div>
        ) : null}

        {toolIds.length > 1 ? (
          <div className="flex flex-wrap items-center gap-2 text-[12px]">
            <span className="text-app-ink-mute">Filter:</span>
            <button
              type="button"
              onClick={() => setFilterTool("all")}
              className={`rounded-full border px-2 py-0.5 ${
                filterTool === "all"
                  ? "border-indigo/40 text-indigo"
                  : "border-app-border text-app-ink-dim"
              }`}
            >
              All
            </button>
            {toolIds.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setFilterTool(id)}
                className={`rounded-full border px-2 py-0.5 font-mono text-[11px] ${
                  filterTool === id
                    ? "border-indigo/40 text-indigo"
                    : "border-app-border text-app-ink-dim"
                }`}
              >
                {id}
              </button>
            ))}
          </div>
        ) : null}

        {!error && artifacts.length === 0 ? (
          <p className="text-sm text-app-ink-mute">
            Waiting for this ticket&apos;s {lane} adapters. Checklist above fills as each tool
            finishes
            {hostStatus?.required
              ? " (missing host CLIs show as failed)."
              : " (or soft-skips if the CLI is missing)."}
          </p>
        ) : null}

        {filtered.map((a) => (
          <ArtifactCard key={a.runId} artifact={a} />
        ))}
      </div>
    </Panel>
  );
}
