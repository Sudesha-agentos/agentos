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
import { payloadToGraphology, useGnSigma } from "./useGnSigma";
import { colorForKind } from "./constants";

const TOOLS = [
  { id: "inspect", label: "Inspect" },
  { id: "query", label: "Query" },
  { id: "impact", label: "Impact" },
  { id: "context", label: "Context" },
  { id: "processes", label: "Processes" },
];

function IconBtn({ title, onClick, children, active }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
        active
          ? "bg-indigo text-white"
          : "border border-hairline bg-surface/60 text-ink-dim hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function EmptyState({ onAnalyze, analyzing, error }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="rounded-2xl border border-hairline bg-surface/50 px-8 py-10">
        <p className="font-display text-xl text-ink">Knowledge graph not ready</p>
        <p className="mt-2 max-w-md text-sm text-ink-dim">
          Run GitNexus analyze to build clusters, symbols, processes, and call edges for this
          repo — then explore with Force / Tree / Circles layouts and query tools.
        </p>
        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
        <button
          type="button"
          disabled={analyzing}
          onClick={onAnalyze}
          className="mt-5 rounded-full bg-indigo px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-white disabled:opacity-60"
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
    <aside className="flex w-[240px] shrink-0 flex-col border-r border-hairline bg-[#0a0a12]">
      <div className="border-b border-hairline px-3 py-2">
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Filter nodes…"
          className="w-full rounded-lg border border-hairline bg-canvas/80 px-2.5 py-1.5 text-[12px] text-ink outline-none placeholder:text-ink-mute focus:border-indigo/50"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-2 py-2">
        <p className="mb-1.5 px-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute">
          {collapse ? "Clusters" : "Symbols"}
        </p>
        {collapse ? (
          <ul className="space-y-0.5">
            {filtered.slice(0, 200).map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => onSelect(n.id)}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] ${
                    selectedId === n.id
                      ? "bg-indigo/20 text-ink"
                      : "text-ink-dim hover:bg-surface/60 hover:text-ink"
                  }`}
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: colorForKind(n.kind) }}
                  />
                  <span className="min-w-0 truncate">{n.label}</span>
                  {n.memberCount != null ? (
                    <span className="ml-auto shrink-0 text-[10px] text-ink-mute">
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
                <p className="truncate px-1 font-mono text-[10px] text-indigo/80" title={file}>
                  {file}
                </p>
                <ul className="mt-0.5 space-y-0.5">
                  {items.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => onSelect(n.id)}
                      className={`flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-[11px] ${
                        selectedId === n.id
                          ? "bg-indigo/20 text-ink"
                          : "text-ink-dim hover:bg-surface/60"
                      }`}
                    >
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ background: colorForKind(n.kind) }}
                      />
                      <span className="truncate">{n.label}</span>
                      <span className="ml-auto text-[9px] text-ink-mute">{n.kind}</span>
                    </button>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        {processes?.length ? (
          <div className="mt-4 border-t border-hairline pt-3">
            <p className="mb-1.5 px-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute">
              Processes
            </p>
            <ul className="space-y-0.5">
              {processes.slice(0, 40).map((p) => (
                <li
                  key={p.id}
                  className="rounded-md px-2 py-1.5 text-[11px] text-ink-dim"
                  title={p.name}
                >
                  <span className="text-rose-400">▸</span> {p.name}
                  <span className="ml-1 text-[9px] text-ink-mute">
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
    <aside className="flex w-[300px] shrink-0 flex-col border-l border-hairline bg-[#0a0a12]">
      <div className="flex flex-wrap gap-1 border-b border-hairline p-2">
        {TOOLS.map((t) => (
          <IconBtn key={t.id} active={tool === t.id} onClick={() => setTool(t.id)} title={t.label}>
            {t.label}
          </IconBtn>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3 text-[13px]">
        {tool === "inspect" ? (
          selected ? (
            <div className="space-y-2">
              <p className="font-display text-lg text-ink">{selected.label}</p>
              <p className="font-mono text-[11px] text-ink-mute">{selected.kind}</p>
              {selected.filePath ? (
                <p className="break-all font-mono text-[11px] text-indigo">{selected.filePath}</p>
              ) : null}
              {selected.memberCount != null ? (
                <p className="text-ink-dim">{selected.memberCount} members</p>
              ) : null}
              {selected.module ? (
                <p className="text-ink-dim">Module: {selected.module}</p>
              ) : null}
            </div>
          ) : (
            <p className="text-ink-mute">Select a node on the graph or from the tree.</p>
          )
        ) : null}

        {tool === "query" ? (
          <div className="space-y-3">
            <p className="text-[12px] text-ink-dim">
              Search processes and definitions related to a concept (GitNexus query).
            </p>
            <textarea
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              rows={3}
              placeholder="e.g. authentication flow"
              className="w-full rounded-lg border border-hairline bg-canvas/80 px-2.5 py-2 text-[12px] text-ink outline-none focus:border-indigo/50"
            />
            <button
              type="button"
              disabled={toolLoading || !queryText.trim()}
              onClick={onRunQuery}
              className="rounded-full bg-indigo px-4 py-1.5 text-[12px] text-white disabled:opacity-50"
            >
              {toolLoading ? "Running…" : "Run query"}
            </button>
          </div>
        ) : null}

        {tool === "impact" ? (
          <div className="space-y-3">
            <p className="text-[12px] text-ink-dim">
              Blast radius for the selected symbol (CALLS / IMPORTS).
            </p>
            <button
              type="button"
              disabled={toolLoading || !selected?.label}
              onClick={onRunImpact}
              className="rounded-full bg-indigo px-4 py-1.5 text-[12px] text-white disabled:opacity-50"
            >
              {toolLoading ? "Computing…" : "Compute impact"}
            </button>
            {!selected?.label ? (
              <p className="text-[11px] text-ink-mute">Select a symbol first.</p>
            ) : null}
          </div>
        ) : null}

        {tool === "context" ? (
          <div className="space-y-3">
            <p className="text-[12px] text-ink-dim">
              360° context: callers, callees, and process membership.
            </p>
            <button
              type="button"
              disabled={toolLoading || !selected?.label}
              onClick={onRunContext}
              className="rounded-full bg-indigo px-4 py-1.5 text-[12px] text-white disabled:opacity-50"
            >
              {toolLoading ? "Loading…" : "Load context"}
            </button>
          </div>
        ) : null}

        {tool === "processes" ? (
          <p className="text-[12px] text-ink-dim">
            Execution flows are listed in the left panel. Use Query to find processes by concept.
          </p>
        ) : null}

        {toolError ? <p className="mt-3 text-sm text-danger">{toolError}</p> : null}

        {toolResult ? (
          <pre className="mt-3 max-h-[50vh] overflow-auto rounded-lg border border-hairline bg-canvas/70 p-2 font-mono text-[10px] leading-relaxed text-ink-dim">
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
 * Full GitNexus-style explorer: tree, Sigma graph, tools, status bar.
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

  function handleLayoutChange(mode) {
    setLayoutMode(mode);
  }

  async function onRunQuery() {
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
  }

  async function onRunImpact() {
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
            for (const s of list) if (s.uid || s.id || typeof s === "string") ids.push(s.uid || s.id || s);
          }
        }
      }
      if (ids.length) setHighlights(ids);
    } catch (err) {
      setToolError(err?.message || "Impact failed");
    } finally {
      setToolLoading(false);
    }
  }

  async function onRunContext() {
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
    <div className="flex h-[min(82vh,900px)] flex-col overflow-hidden rounded-[1.25rem] border border-hairline bg-[#06060a] text-ink shadow-xl">
      {/* Header */}
      <header className="flex flex-wrap items-center gap-2 border-b border-hairline bg-[#0a0a12]/90 px-3 py-2">
        <span className="font-display text-sm text-ink">GitNexus</span>
        <span className="font-mono text-[10px] text-ink-mute">{branch}</span>

        <div className="ml-2 flex gap-1 rounded-lg border border-hairline p-0.5">
          <IconBtn active={collapse} onClick={() => setCollapse(true)} title="Cluster view">
            Clusters
          </IconBtn>
          <IconBtn active={!collapse} onClick={() => setCollapse(false)} title="Symbol view">
            Symbols
          </IconBtn>
        </div>

        <div className="flex gap-1 rounded-lg border border-hairline p-0.5">
          <IconBtn active={layoutMode === "force"} onClick={() => handleLayoutChange("force")}>
            Force
          </IconBtn>
          <IconBtn active={layoutMode === "tree"} onClick={() => handleLayoutChange("tree")}>
            Tree
          </IconBtn>
          <IconBtn active={layoutMode === "circles"} onClick={() => handleLayoutChange("circles")}>
            Circles
          </IconBtn>
        </div>

        <div className="flex gap-1">
          <IconBtn title="Zoom in" onClick={zoomIn}>
            +
          </IconBtn>
          <IconBtn title="Zoom out" onClick={zoomOut}>
            −
          </IconBtn>
          <IconBtn title="Reset camera" onClick={resetZoom}>
            Reset
          </IconBtn>
          <IconBtn title="Re-run layout" onClick={() => rerunLayout(layoutMode)}>
            Relayout
          </IconBtn>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-1">
          <IconBtn active={leftOpen} onClick={() => setLeftOpen((v) => !v)}>
            Tree
          </IconBtn>
          <IconBtn active={rightOpen} onClick={() => setRightOpen((v) => !v)}>
            Tools
          </IconBtn>
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={analyzing}
            className="rounded-full border border-indigo/40 bg-indigo/15 px-3 py-1.5 text-[11px] text-indigo hover:bg-indigo/25 disabled:opacity-50"
          >
            {analyzing ? "Analyzing…" : "Analyze"}
          </button>
          <button
            type="button"
            onClick={loadGraph}
            className="rounded-full border border-hairline px-3 py-1.5 text-[11px] text-ink-dim hover:text-ink"
          >
            Reload
          </button>
          {highlights?.length ? (
            <button
              type="button"
              onClick={() => setHighlights(null)}
              className="rounded-full border border-amber-500/40 px-3 py-1.5 text-[11px] text-amber-200"
            >
              Clear highlights
            </button>
          ) : null}
        </div>
      </header>

      {/* Body */}
      <div className="relative flex min-h-0 flex-1">
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

        <div className="relative min-w-0 flex-1 bg-[#06060a]">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at 50% 45%, rgba(99,102,241,0.06) 0%, transparent 65%), linear-gradient(to bottom, #06060a, #0a0a12)",
            }}
          />

          {loading ? (
            <div className="absolute inset-0 z-10 flex items-center justify-center text-sm text-ink-mute">
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
            <div className="pointer-events-none absolute bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-full border border-hairline bg-surface/95 px-3 py-1 text-[12px] text-ink backdrop-blur">
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
            onRunQuery={onRunQuery}
            onRunImpact={onRunImpact}
            onRunContext={onRunContext}
          />
        ) : null}
      </div>

      {/* Status bar */}
      <footer className="flex flex-wrap items-center gap-3 border-t border-hairline bg-[#0a0a12] px-3 py-1.5 font-mono text-[10px] text-ink-mute">
        <span>
          {meta?.symbolCount ?? "—"} symbols · {meta?.edgeCount ?? "—"} edges ·{" "}
          {meta?.clusterCount ?? "—"} clusters · {meta?.processCount ?? processes.length}{" "}
          processes
        </span>
        {payload?.source ? <span>· {payload.source}</span> : null}
        {payload?.analyzedAt ? (
          <span>· analyzed {new Date(payload.analyzedAt).toLocaleString()}</span>
        ) : null}
        <span className="ml-auto">
          {payload?.view || (collapse ? "clusters" : "symbols")} · {layoutMode}
        </span>
      </footer>
    </div>
  );
}
