import { useCallback, useEffect, useRef, useState } from "react";
import Graph from "graphology";
import Sigma from "sigma";
import forceAtlas2 from "graphology-layout-forceatlas2";
import { colorForKind, sizeForKind, EDGE_COLORS } from "./constants";

function applyForceLayout(graph) {
  if (graph.order === 0) return;
  forceAtlas2.assign(graph, {
    iterations: Math.min(120, 40 + Math.floor(graph.order / 8)),
    settings: {
      gravity: graph.order < 200 ? 1 : 0.4,
      scalingRatio: 8,
      slowDown: 2,
      barnesHutOptimize: graph.order > 300,
    },
  });
}

function applyTreeLayout(graph) {
  const byParent = new Map();
  graph.forEachNode((id, attrs) => {
    const key = attrs.filePath || attrs.module || attrs.kind || "_";
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(id);
  });
  let groupIdx = 0;
  for (const ids of byParent.values()) {
    const cx = (groupIdx % 8) * 180 - 600;
    const cy = Math.floor(groupIdx / 8) * 160 - 400;
    ids.forEach((id, i) => {
      const angle = (i / Math.max(1, ids.length)) * Math.PI * 2;
      const r = 20 + ids.length * 2;
      graph.setNodeAttribute(id, "x", cx + Math.cos(angle) * r);
      graph.setNodeAttribute(id, "y", cy + Math.sin(angle) * r);
    });
    groupIdx += 1;
  }
}

function applyCirclesLayout(graph) {
  const kinds = new Map();
  graph.forEachNode((id, attrs) => {
    const k = attrs.kind || "CodeElement";
    if (!kinds.has(k)) kinds.set(k, []);
    kinds.get(k).push(id);
  });
  let ring = 0;
  for (const ids of kinds.values()) {
    const radius = 80 + ring * 90;
    ids.forEach((id, i) => {
      const angle = (i / Math.max(1, ids.length)) * Math.PI * 2;
      graph.setNodeAttribute(id, "x", Math.cos(angle) * radius);
      graph.setNodeAttribute(id, "y", Math.sin(angle) * radius);
    });
    ring += 1;
  }
}

export function payloadToGraphology(payload, layoutMode = "force") {
  const g = new Graph();
  for (const n of payload?.nodes || []) {
    if (g.hasNode(n.id)) continue;
    g.addNode(n.id, {
      label: n.label || n.id,
      kind: n.kind || "CodeElement",
      filePath: n.filePath || "",
      module: n.module || "",
      memberCount: n.memberCount,
      size: Math.max(3, n.size || sizeForKind(n.kind)),
      color: colorForKind(n.kind),
      x: Math.random() * 100,
      y: Math.random() * 100,
    });
  }
  for (const e of payload?.edges || []) {
    if (!g.hasNode(e.source) || !g.hasNode(e.target) || e.source === e.target) continue;
    const key = e.id || `${e.source}->${e.target}:${e.type}`;
    if (g.hasEdge(key)) continue;
    try {
      // Sigma uses `type` for render programs (line/arrow/…) — keep relation
      // semantics on `relationType` so values like CLUSTER_LINK don't crash.
      g.addEdgeWithKey(key, e.source, e.target, {
        type: "line",
        relationType: e.type || "RELATED",
        size: 1,
        color: EDGE_COLORS[e.type] || "rgba(148, 163, 184, 0.3)",
      });
    } catch {
      /* ignore */
    }
  }

  if (layoutMode === "tree") applyTreeLayout(g);
  else if (layoutMode === "circles") applyCirclesLayout(g);
  else applyForceLayout(g);

  return g;
}

/**
 * Sigma.js canvas for GitNexus-style graph exploration.
 */
export function useGnSigma({ onNodeClick, onNodeHover, onStageClick }) {
  const containerRef = useRef(null);
  const sigmaRef = useRef(null);
  const graphRef = useRef(null);
  const resizeObsRef = useRef(null);
  const selectedRef = useRef(null);
  const highlightRef = useRef(null);
  const callbacksRef = useRef({ onNodeClick, onNodeHover, onStageClick });
  const [selectedId, setSelectedIdState] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    callbacksRef.current = { onNodeClick, onNodeHover, onStageClick };
  }, [onNodeClick, onNodeHover, onStageClick]);

  const setSelectedId = useCallback((id) => {
    selectedRef.current = id;
    setSelectedIdState(id);
    sigmaRef.current?.refresh();
  }, []);

  const setHighlightedIds = useCallback((ids) => {
    highlightRef.current = ids instanceof Set ? ids : ids?.length ? new Set(ids) : null;
    sigmaRef.current?.refresh();
  }, []);

  const destroy = useCallback(() => {
    if (resizeObsRef.current) {
      resizeObsRef.current.disconnect();
      resizeObsRef.current = null;
    }
    if (sigmaRef.current) {
      sigmaRef.current.kill();
      sigmaRef.current = null;
    }
    graphRef.current = null;
    setReady(false);
  }, []);

  const setGraph = useCallback(
    (graph) => {
      const el = containerRef.current;
      if (!el) return;
      destroy();
      if (!graph || graph.order === 0) return;

      graphRef.current = graph;
      const isDark = document.documentElement.classList.contains("app-theme-dark");
      const labelColor = isDark ? "#e2e8f0" : "#1a1a1a";
      const edgeColor = isDark ? "rgba(148, 163, 184, 0.35)" : "rgba(26, 26, 26, 0.18)";

      const sigma = new Sigma(graph, el, {
        allowInvalidContainer: true,
        renderLabels: true,
        labelFont: "Inter, ui-sans-serif, system-ui, sans-serif",
        labelSize: 11,
        labelWeight: "500",
        labelColor: { color: labelColor },
        defaultEdgeColor: edgeColor,
        defaultNodeColor: "#64748b",
        minCameraRatio: 0.05,
        maxCameraRatio: 12,
        stagePadding: 40,
      });

      sigma.on("clickNode", ({ node }) => {
        selectedRef.current = node;
        setSelectedIdState(node);
        callbacksRef.current.onNodeClick?.(node, graph.getNodeAttributes(node));
        sigma.refresh();
      });
      sigma.on("enterNode", ({ node }) => {
        callbacksRef.current.onNodeHover?.(node, graph.getNodeAttributes(node));
      });
      sigma.on("leaveNode", () => callbacksRef.current.onNodeHover?.(null));
      sigma.on("clickStage", () => {
        selectedRef.current = null;
        setSelectedIdState(null);
        callbacksRef.current.onStageClick?.();
        sigma.refresh();
      });

      sigma.setSetting("nodeReducer", (node, data) => {
        const res = { ...data };
        const hl = highlightRef.current;
        const sel = selectedRef.current;
        if (hl && hl.size > 0) {
          if (hl.has(node) || node === sel) {
            res.highlighted = true;
            res.zIndex = 2;
            res.size = (data.size || 6) * 1.35;
          } else {
            res.color = "rgba(148, 163, 184, 0.35)";
            res.label = "";
          }
        } else if (node === sel) {
          res.highlighted = true;
          res.size = (data.size || 6) * 1.4;
          res.zIndex = 2;
        }
        return res;
      });

      sigmaRef.current = sigma;
      setReady(true);

      const ro = new ResizeObserver(() => {
        try {
          sigma.resize();
          sigma.refresh();
        } catch {
          /* ignore */
        }
      });
      ro.observe(el);
      resizeObsRef.current = ro;

      requestAnimationFrame(() => {
        try {
          sigma.resize();
          sigma.getCamera().animatedReset({ duration: 250 });
        } catch {
          /* ignore */
        }
      });
    },
    [destroy]
  );

  useEffect(() => () => destroy(), [destroy]);

  const zoomIn = useCallback(() => {
    sigmaRef.current?.getCamera().animatedZoom({ duration: 200 });
  }, []);

  const zoomOut = useCallback(() => {
    sigmaRef.current?.getCamera().animatedUnzoom({ duration: 200 });
  }, []);

  const resetZoom = useCallback(() => {
    sigmaRef.current?.getCamera().animatedReset({ duration: 250 });
  }, []);

  const focusNode = useCallback((nodeId) => {
    const sigma = sigmaRef.current;
    const graph = graphRef.current;
    if (!sigma || !graph?.hasNode(nodeId)) return;
    selectedRef.current = nodeId;
    setSelectedIdState(nodeId);
    const attrs = graph.getNodeAttributes(nodeId);
    sigma.getCamera().animate({ x: attrs.x, y: attrs.y, ratio: 0.35 }, { duration: 350 });
    sigma.refresh();
  }, []);

  const rerunLayout = useCallback(
    (mode = "force") => {
      const graph = graphRef.current;
      const sigma = sigmaRef.current;
      if (!graph || !sigma) return;
      if (mode === "tree") applyTreeLayout(graph);
      else if (mode === "circles") applyCirclesLayout(graph);
      else applyForceLayout(graph);
      sigma.refresh();
      resetZoom();
    },
    [resetZoom]
  );

  return {
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
    ready,
    destroy,
  };
}
