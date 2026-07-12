import { useCallback, useEffect, useMemo, useState } from "react";
import {
  analyzeGitNexusGraph,
  fetchGitNexusGraph,
  fetchGitNexusStatus,
  gitNexusContext,
  gitNexusImpact,
  gitNexusQuery,
  fetchGitNexusResources,
} from "../../entities/codebase";
import { AppTabButton } from "../../shared/ui/AppChrome";
import { Panel, PanelHeader } from "../../shared/ui/Panel";
import { payloadToGraphology, useGnSigma } from "./useGnSigma";
import { colorForKind } from "./constants";

const TOOLS = [
  { id: "inspect", label: "Inspect" },
  { id: "query", label: "Query" },
  { id: "impact", label: "Impact" },
  { id: "context", label: "Context" },
  { id: "processes", label: "Processes" },
];

function EmptyState({ onAnalyze, analyzing, error }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="max-w-md rounded-app border border-app-border bg-app-surface px-8 py-10 shadow-app-card">
        <p className="type-kicker">Knowledge graph</p>
        <p className="mt-2 type-section-title">Not ready yet</p>
        <p className="mt-2 type-body">
          Analyze this repository to build clusters, symbols, processes, and call edges — then
          explore with Force / Tree / Circles layouts and query tools.
        </p>
        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
        <button
          type="button"
          disabled={analyzing}
          onClick={onAnalyze}
          className="app-btn-primary mt-5 inline-flex rounded-full px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] disabled:opacity-60"
        >
          {analyzing ? "Analyzing…" : "Analyze repository"}
        </button>
      </div>
    </div>
  );
}

function LeftPanel({
  nodes,
  processes,
  selectedId,
  search,
  onSearch,
  onSelect,
  collapse,
}) {
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return nodes;
    return nodes.filter(
      (n) =>
        String(n.label || "").toLowerCase().includes(q) ||
        String(n.filePath || "").toLowerCase().includes(q) ||
        String(n.kind || "").toLowerCase().includes(q)
    );
  }, [nodes, search]);

  const byFile = useMemo(() => {
    if (collapse) return null;
    const map = new Map();
    for (const n of filtered) {
      const key = n.filePath || "(no file)";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(n);
    }
    return [...map.entries()].slice(0, 80);
  }, [filtered, collapse]);

  return (
    <aside className="flex w-[240px] shrink-0 flex-col border-r border-app-border bg-app-surface-muted/60">
      <div className="border-b border-app-border px-3 py-2.5">
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Filter nodes…"
          className="w-full rounded-app border border-app-border bg-app-surface px-2.5 py-1.5 text-[12px] text-app-ink outline-none placeholder:text-app-ink-mute focus:border-app-ink/20"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-2 py-2">
        <p className="mb-1.5 px-1 type-kicker">{collapse ? "Clusters" : "Symbols"}</p>
        {collapse ? (
          <ul className="space-y-0.5">
            {filtered.slice(0, 200).map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => onSelect(n.id)}
                  className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] transition-colors ${
                    selectedId === n.id
                      ? "bg-app-lavender/80 text-app-ink"
                      : "text-app-ink-dim hover:bg-app-surface hover:text-app-ink"
                  }`}
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: colorForKind(n.kind) }}
                  />
                  <span className="min-w-0 truncate">{n.label}</span>
                  {n.memberCount != null ? (
                    <span className="ml-auto shrink-0 text-[10px] text-app-ink-mute">
                      {n.memberCount}
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="space-y-2">
            {(byFile || []).map(([file, items]) => (
              <div key={file}>
                <p
                  className="truncate px-1 font-mono text-[10px] text-app-ink-mute"
                  title={file}
                >
                  {file}
                </p>
                <ul className="mt-0.5 space-y-0.5">
                  {items.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => onSelect(n.id)}
                      className={`flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left text-[11px] ${
                        selectedId === n.id
                          ? "bg-app-lavender/80 text-app-ink"
                          : "text-app-ink-dim hover:bg-app-surface"
                      }`}
                    >
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ background: colorForKind(n.kind) }}
                      />
                      <span className="truncate">{n.label}</span>
                      <span className="ml-auto text-[9px] text-app-ink-mute">{n.kind}</span>
                    </button>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        {processes?.length ? (
          <div className="mt-4 border-t border-app-border pt-3">
            <p className="mb-1.5 px-1 type-kicker">Processes</p>
            <ul className="space-y-0.5">
              {processes.slice(0, 40).map((p) => (
                <li
                  key={p.id}
                  className="rounded-lg px-2 py-1.5 text-[11px] text-app-ink-dim"
                  title={p.name}
                >
                  <span className="text-app-ink">▸</span> {p.name}
                  <span className="ml-1 text-[9px] text-app-ink-mute">
                    {p.steps} steps · {p.type}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </aside>
  );
}

function RightPanel({
  tool,
  setTool,
  selected,
  toolResult,
  toolLoading,
  toolError,
  queryText,
  setQueryText,
  onRunQuery,
  onRunImpact,
  onRunContext,
}) {
  return (
    <aside className="flex w-[300px] shrink-0 flex-col border-l border-app-border bg-app-surface-muted/60">
      <div className="flex flex-wrap gap-1.5 border-b border-app-border p-2.5">
        {TOOLS.map((t) => (
          <AppTabButton key={t.id} active={tool === t.id} onClick={() => setTool(t.id)}>
            {t.label}
          </AppTabButton>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-4 text-[13px]">
        {tool === "inspect" ? (
          selected ? (
            <div className="space-y-2">
              <p className="type-section-title text-[1.15rem]">{selected.label}</p>
              <p className="type-kicker">{selected.kind}</p>
              {selected.filePath ? (
                <p className="break-all font-mono text-[11px] text-app-ink-dim">{selected.filePath}</p>
              ) : null}
              {selected.memberCount != null ? (
                <p className="text-app-ink-dim">{selected.memberCount} members</p>
              ) : null}
              {selected.module ? (
                <p className="text-app-ink-dim">Module: {selected.module}</p>
              ) : null}
            </div>
          ) : (
            <p className="text-app-ink-mute">Select a node on the graph or from the tree.</p>
          )
        ) : null}

        {tool === "query" ? (
          <div className="space-y-3">
            <p className="type-body text-[12px]">
              Search processes and definitions related to a concept.
            </p>
            <textarea
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              rows={3}
              placeholder="e.g. authentication flow"
              className="w-full rounded-app border border-app-border bg-app-surface px-2.5 py-2 text-[12px] text-app-ink outline-none focus:border-app-ink/20"
            />
            <button
              type="button"
              disabled={toolLoading || !queryText.trim()}
              onClick={onRunQuery}
              className="app-btn-primary rounded-full px-4 py-1.5 text-[12px] disabled:opacity-50"
            >
              {toolLoading ? "Running…" : "Run query"}
            </button>
          </div>
        ) : null}

        {tool === "impact" ? (
          <div className="space-y-3">
            <p className="type-body text-[12px]">
              Blast radius for the selected symbol (CALLS / IMPORTS).
            </p>
            <button
              type="button"
              disabled={toolLoading || !selected?.label}
              onClick={onRunImpact}
              className="app-btn-primary rounded-full px-4 py-1.5 text-[12px] disabled:opacity-50"
            >
              {toolLoading ? "Computing…" : "Compute impact"}
            </button>
            {!selected?.label ? (
              <p className="text-[11px] text-app-ink-mute">Select a symbol first.</p>
            ) : null}
          </div>
        ) : null}

        {tool === "context" ? (
          <div className="space-y-3">
            <p className="type-body text-[12px]">
              360° context: callers, callees, and process membership.
            </p>
            <button
              type="button"
              disabled={toolLoading || !selected?.label}
              onClick={onRunContext}
              className="app-btn-primary rounded-full px-4 py-1.5 text-[12px] disabled:opacity-50"
            >
              {toolLoading ? "Loading…" : "Load context"}
            </button>
          </div>
        ) : null}

        {tool === "processes" ? (
          <p className="type-body text-[12px]">
            Execution flows are listed in the left panel. Use Query to find processes by concept.
          </p>
        ) : null}

        {toolError ? <p className="mt-3 text-sm text-danger">{toolError}</p> : null}

        {toolResult ? (
          <pre className="mt-3 max-h-[50vh] overflow-auto rounded-app border border-app-border bg-app-surface p-2.5 font-mono text-[10px] leading-relaxed text-app-ink-dim">
            {typeof toolResult === "string"
              ? toolResult
              : JSON.stringify(toolResult, null, 2)}
          </pre>
        ) : null}
      </div>
    </aside>
  );
}

/**
 * GitNexus explorer styled for AgentOS app chrome.
 * Required Notice: Copyright Abhigyan Patwari (https://github.com/abhigyanpatwari/GitNexus)
 */
export default function GitNexusExplorer({ branch = "main" }) {
  const [collapse, setCollapse] = useState(true);
  const [layoutMode, setLayoutMode] = useState("force");
  const [payload, setPayload] = useState(null);
  const [status, setStatus] = useState(null);
  const [processes, setProcesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [hoverLabel, setHoverLabel] = useState(null);
  const [selected, setSelected] = useState(null);
  const [highlights, setHighlights] = useState(null);
  const [tool, setTool] = useState("inspect");
  const [queryText, setQueryText] = useState("");
  const [toolResult, setToolResult] = useState(null);
  const [toolLoading, setToolLoading] = useState(false);
  const [toolError, setToolError] = useState("");
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);

  const {
    containerRef,
    setGraph,
    zoomIn,
    zoomOut,
    resetZoom,
    focusNode,
    rerunLayout,
    selectedId,
    setSelectedId,
    setHighlightedIds,
  } = useGnSigma({
    onNodeClick: (_id, attrs) => {
      setSelected({ id: _id, ...attrs });
      setTool("inspect");
    },
    onNodeHover: (_id, attrs) => setHoverLabel(attrs?.label || null),
    onStageClick: () => setSelected(null),
  });

  useEffect(() => {
    setHighlightedIds(highlights);
  }, [highlights, setHighlightedIds]);

  const loadGraph = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [st, data, res] = await Promise.all([
        fetchGitNexusStatus(branch).catch(() => null),
        fetchGitNexusGraph(branch, { collapse }),
        fetchGitNexusResources("processes", { branch }).catch(() => null),
      ]);
      setStatus(st);
      setPayload(data);
      setProcesses(res?.processes || []);
      if (!data?.nodes?.length) {
        setError(data ? "Graph is empty — try analyzing again." : "No graph payload.");
      }
    } catch (err) {
      setPayload(null);
      setError(err?.message || "Failed to load knowledge graph");
    } finally {
      setLoading(false);
    }
  }, [branch, collapse]);

  useEffect(() => {
    loadGraph();
  }, [loadGraph]);

  useEffect(() => {
    if (!payload?.nodes?.length) {
      setGraph(null);
      return;
    }
    const g = payloadToGraphology(payload, layoutMode);
    setGraph(g);
  }, [payload, layoutMode, setGraph]);

  async function handleAnalyze() {
    setAnalyzing(true);
    setError("");
    try {
      await analyzeGitNexusGraph(branch);
      await loadGraph();
    } catch (err) {
      setError(err?.message || "Analyze failed");
    } finally {
      setAnalyzing(false);
    }
  }

  function handleSelectFromTree(id) {
    const node = payload?.nodes?.find((n) => n.id === id);
    if (node) {
      setSelected(node);
      setSelectedId(id);
      focusNode(id);
      setTool("inspect");
    }
  }

  const meta = payload?.meta || status;
  const hasGraph = Boolean(payload?.nodes?.length);
  const graphUnavailable =
    !loading &&
    (!hasGraph ||
      error?.includes("knowledge_graph") ||
      error?.includes("unavailable") ||
      status?.ready === false);

  return (
    <Panel className="overflow-hidden">
      <PanelHeader
        kicker="Knowledge graph"
        title="GitNexus"
        subtitle={`Explore clusters, symbols, and processes on ${branch}.`}
        right={
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={analyzing}
              className="app-btn-primary rounded-full px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] disabled:opacity-50"
            >
              {analyzing ? "Analyzing…" : "Analyze"}
            </button>
            <button
              type="button"
              onClick={loadGraph}
              className="rounded-full border border-app-border bg-app-surface px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-app-ink-dim hover:text-app-ink"
            >
              Reload
            </button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-2 border-b border-app-border px-4 py-2.5 sm:px-5">
        <div className="flex flex-wrap gap-1.5">
          <AppTabButton active={collapse} onClick={() => setCollapse(true)}>
            Clusters
          </AppTabButton>
          <AppTabButton active={!collapse} onClick={() => setCollapse(false)}>
            Symbols
          </AppTabButton>
        </div>
        <div className="h-4 w-px bg-app-border" />
        <div className="flex flex-wrap gap-1.5">
          <AppTabButton active={layoutMode === "force"} onClick={() => setLayoutMode("force")}>
            Force
          </AppTabButton>
          <AppTabButton active={layoutMode === "tree"} onClick={() => setLayoutMode("tree")}>
            Tree
          </AppTabButton>
          <AppTabButton active={layoutMode === "circles"} onClick={() => setLayoutMode("circles")}>
            Circles
          </AppTabButton>
        </div>
        <div className="h-4 w-px bg-app-border" />
        <div className="flex flex-wrap gap-1.5">
          <AppTabButton onClick={zoomIn}>+</AppTabButton>
          <AppTabButton onClick={zoomOut}>−</AppTabButton>
          <AppTabButton onClick={resetZoom}>Reset</AppTabButton>
          <AppTabButton onClick={() => rerunLayout(layoutMode)}>Relayout</AppTabButton>
        </div>
        <div className="ml-auto flex flex-wrap gap-1.5">
          <AppTabButton active={leftOpen} onClick={() => setLeftOpen((v) => !v)}>
            Tree
          </AppTabButton>
          <AppTabButton active={rightOpen} onClick={() => setRightOpen((v) => !v)}>
            Tools
          </AppTabButton>
          {highlights?.length ? (
            <AppTabButton onClick={() => setHighlights(null)}>Clear highlights</AppTabButton>
          ) : null}
        </div>
      </div>

      <div className="relative flex h-[min(72vh,820px)] min-h-[420px]">
        {leftOpen ? (
          <LeftPanel
            nodes={payload?.nodes || []}
            processes={processes}
            selectedId={selected?.id || selectedId}
            search={search}
            onSearch={setSearch}
            onSelect={handleSelectFromTree}
            collapse={collapse}
          />
        ) : null}

        <div className="relative min-w-0 flex-1 bg-app-canvas">
          {loading ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center text-sm text-app-ink-mute">
              Loading knowledge graph…
            </div>
          ) : null}

          {!loading && (graphUnavailable || !hasGraph) ? (
            <div className="absolute inset-0 z-10">
              <EmptyState onAnalyze={handleAnalyze} analyzing={analyzing} error={error} />
            </div>
          ) : null}

          <div
            ref={containerRef}
            className="sigma-container absolute inset-0 cursor-grab active:cursor-grabbing"
          />

          {hoverLabel ? (
            <div className="pointer-events-none absolute bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-full border border-app-border bg-app-surface px-3 py-1 text-[12px] text-app-ink shadow-app-card">
              {hoverLabel}
            </div>
          ) : null}
        </div>

        {rightOpen ? (
          <RightPanel
            tool={tool}
            setTool={setTool}
            selected={selected}
            toolResult={toolResult}
            toolLoading={toolLoading}
            toolError={toolError}
            queryText={queryText}
            setQueryText={setQueryText}
            onRunQuery={async () => {
              setToolLoading(true);
              setToolError("");
              setToolResult(null);
              try {
                const result = await gitNexusQuery({ query: queryText, branchName: branch });
                setToolResult(result);
                const ids = [];
                for (const p of result?.processes || []) {
                  for (const s of p.steps || []) if (s.symbolUid) ids.push(s.symbolUid);
                }
                for (const d of result?.definitions || []) if (d.uid) ids.push(d.uid);
                if (ids.length) setHighlights(ids);
              } catch (err) {
                setToolError(err?.message || "Query failed");
              } finally {
                setToolLoading(false);
              }
            }}
            onRunImpact={async () => {
              if (!selected?.label) return;
              setToolLoading(true);
              setToolError("");
              setToolResult(null);
              try {
                const result = await gitNexusImpact({
                  target: selected.label,
                  branchName: branch,
                  direction: "upstream",
                });
                setToolResult(result);
                const ids = [];
                const depths = result?.impacted_symbols || result?.symbols || result?.depths;
                if (Array.isArray(depths)) {
                  for (const s of depths) if (s.uid || s.id) ids.push(s.uid || s.id);
                } else if (depths && typeof depths === "object") {
                  for (const list of Object.values(depths)) {
                    if (Array.isArray(list)) {
                      for (const s of list) {
                        if (s.uid || s.id || typeof s === "string") ids.push(s.uid || s.id || s);
                      }
                    }
                  }
                }
                if (ids.length) setHighlights(ids);
              } catch (err) {
                setToolError(err?.message || "Impact failed");
              } finally {
                setToolLoading(false);
              }
            }}
            onRunContext={async () => {
              if (!selected?.label) return;
              setToolLoading(true);
              setToolError("");
              setToolResult(null);
              try {
                const result = await gitNexusContext({
                  name: selected.label,
                  branchName: branch,
                });
                setToolResult(result);
              } catch (err) {
                setToolError(err?.message || "Context failed");
              } finally {
                setToolLoading(false);
              }
            }}
          />
        ) : null}
      </div>

      <footer className="flex flex-wrap items-center gap-3 border-t border-app-border bg-app-surface-muted/40 px-5 py-2 font-mono text-[10px] uppercase tracking-[0.08em] text-app-ink-mute">
        <span>
          {meta?.symbolCount ?? "—"} symbols · {meta?.edgeCount ?? "—"} edges ·{" "}
          {meta?.clusterCount ?? "—"} clusters · {meta?.processCount ?? processes.length}{" "}
          processes
        </span>
        {payload?.source ? <span>· {payload.source}</span> : null}
        {payload?.analyzedAt ? (
          <span>· analyzed {new Date(payload.analyzedAt).toLocaleString()}</span>
        ) : null}
        <span className="ml-auto normal-case tracking-normal">
          {payload?.view || (collapse ? "clusters" : "symbols")} · {layoutMode}
        </span>
      </footer>
    </Panel>
  );
}
