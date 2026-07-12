import { useEffect, useMemo, useRef, useState } from "react";
import Graph from "graphology";
import forceAtlas2 from "graphology-layout-forceatlas2";
import { fetchGitNexusGraph } from "../../entities/codebase";

/**
 * Interactive knowledge plot (Sigma-style WebGL via canvas + Graphology layout).
 * Ported interaction model from gitnexus-web graph explorer.
 *
 * Required Notice: Copyright Abhigyan Patwari (https://github.com/abhigyanpatwari/GitNexus)
 */
export default function KnowledgeGraphView({
  branch = "main",
  onSelectNode,
  highlightIds,
}) {
  const canvasRef = useRef(null);
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [collapse, setCollapse] = useState(true);
  const positionsRef = useRef(new Map());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetchGitNexusGraph(branch, { collapse })
      .then((data) => {
        if (!cancelled) setPayload(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || "Failed to load knowledge graph");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [branch, collapse]);

  const layout = useMemo(() => {
    if (!payload?.nodes?.length) return null;
    const g = new Graph();
    for (const n of payload.nodes) {
      if (!g.hasNode(n.id)) g.addNode(n.id, { ...n });
    }
    for (const e of payload.edges || []) {
      if (!g.hasNode(e.source) || !g.hasNode(e.target)) continue;
      if (e.source === e.target) continue;
      const id = e.id || `${e.source}->${e.target}`;
      if (!g.hasEdge(id) && !g.hasEdge(e.source, e.target)) {
        try {
          g.addEdgeWithKey(id, e.source, e.target, { type: e.type });
        } catch {
          /* ignore multi */
        }
      }
    }
    forceAtlas2.assign(g, {
      iterations: 80,
      settings: { gravity: 1, scalingRatio: 8, slowDown: 2 },
    });
    const positions = new Map();
    g.forEachNode((id, attrs) => {
      positions.set(id, { x: attrs.x ?? 0, y: attrs.y ?? 0, ...attrs });
    });
    positionsRef.current = positions;
    return { g, positions };
  }, [payload]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !layout) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth || 800;
    const height = canvas.clientHeight || 520;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of layout.positions.values()) {
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }
    const pad = 40;
    const sx = (width - pad * 2) / Math.max(1, maxX - minX);
    const sy = (height - pad * 2) / Math.max(1, maxY - minY);
    const scale = Math.min(sx, sy);
    const map = (p) => ({
      x: pad + (p.x - minX) * scale,
      y: pad + (p.y - minY) * scale,
    });

    const highlight = highlightIds instanceof Set ? highlightIds : null;

    ctx.strokeStyle = "rgba(139, 124, 246, 0.35)";
    ctx.lineWidth = 1;
    for (const e of payload.edges || []) {
      const a = layout.positions.get(e.source);
      const b = layout.positions.get(e.target);
      if (!a || !b) continue;
      const pa = map(a);
      const pb = map(b);
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.stroke();
    }

    for (const [id, p] of layout.positions) {
      const { x, y } = map(p);
      const r = Math.max(4, Math.min(18, (p.size || 6) / 2));
      const active = highlight?.has(id) || selected?.id === id;
      ctx.beginPath();
      ctx.fillStyle = active
        ? "#f59e0b"
        : p.kind === "Cluster"
          ? "rgba(99, 102, 241, 0.85)"
          : "rgba(34, 197, 94, 0.75)";
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      if (r >= 8 || active) {
        ctx.fillStyle = "#e2e8f0";
        ctx.font = "10px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(String(p.label || id).slice(0, 18), x, y + r + 10);
      }
    }

    const onClick = (ev) => {
      const rect = canvas.getBoundingClientRect();
      const cx = ev.clientX - rect.left;
      const cy = ev.clientY - rect.top;
      let best = null;
      let bestDist = 14;
      for (const [id, p] of layout.positions) {
        const { x, y } = map(p);
        const d = Math.hypot(x - cx, y - cy);
        if (d < bestDist) {
          bestDist = d;
          best = { id, ...p };
        }
      }
      if (best) {
        setSelected(best);
        onSelectNode?.(best);
      }
    };
    canvas.addEventListener("click", onClick);
    return () => canvas.removeEventListener("click", onClick);
  }, [layout, payload, selected, highlightIds, onSelectNode]);

  if (loading) {
    return (
      <div className="flex h-80 items-center justify-center text-sm text-app-ink-mute">
        Building knowledge plot…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-app border border-app-border bg-app-surface p-4 text-sm text-danger">
        {error}
        <p className="mt-2 text-app-ink-mute">
          Run a full index or POST /api/codebase/gn/analyze to build the graph.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={`rounded-full border px-3 py-1 text-xs ${
            collapse
              ? "border-indigo/40 bg-indigo/10 text-app-ink"
              : "border-app-border text-app-ink-dim"
          }`}
          onClick={() => setCollapse(true)}
        >
          Clusters
        </button>
        <button
          type="button"
          className={`rounded-full border px-3 py-1 text-xs ${
            !collapse
              ? "border-indigo/40 bg-indigo/10 text-app-ink"
              : "border-app-border text-app-ink-dim"
          }`}
          onClick={() => setCollapse(false)}
        >
          Symbols
        </button>
        {payload?.meta ? (
          <span className="text-[11px] text-app-ink-mute">
            {payload.meta.symbolCount} symbols · {payload.meta.edgeCount} edges ·{" "}
            {payload.meta.clusterCount} clusters · {payload.meta.processCount} processes
            {payload.source ? ` · ${payload.source}` : ""}
          </span>
        ) : null}
      </div>
      <div className="relative h-[520px] overflow-hidden rounded-app border border-app-border bg-[#0b0b12]">
        <canvas ref={canvasRef} className="h-full w-full" />
      </div>
      {selected ? (
        <div className="rounded-app border border-app-border bg-app-surface p-3 text-sm">
          <p className="font-medium text-app-ink">{selected.label}</p>
          <p className="text-app-ink-dim">
            {selected.kind}
            {selected.filePath ? ` · ${selected.filePath}` : ""}
            {selected.memberCount != null ? ` · ${selected.memberCount} members` : ""}
          </p>
        </div>
      ) : null}
    </div>
  );
}
