/**
 * GitNexus tool implementations (query, context, impact, detect_changes, rename, cypher, list_repos).
 * Response shapes mirror gitnexus MCP local-backend contracts.
 *
 * Required Notice: Copyright Abhigyan Patwari (https://github.com/abhigyanpatwari/GitNexus)
 */

import { requireRepoScope } from "../repoScope";
import { getOrBuildGraph, loadKnowledgeGraph } from "./analyzeBridge";
import type { GnKnowledgeGraph, GnRelation, GnSymbol } from "./types";
import { IMPACT_MAX_DEPTH } from "./toolConstants";

function scopeGraph(branchName?: string) {
  const scope = requireRepoScope();
  return {
    scope,
    branch: branchName || scope.defaultBranch || "main",
  };
}

async function requireGraph(branchName?: string): Promise<GnKnowledgeGraph> {
  const { scope, branch } = scopeGraph(branchName);
  const graph =
    (await loadKnowledgeGraph(
      scope.organizationId,
      scope.repoOwner,
      scope.repoName,
      branch
    )) || (await getOrBuildGraph(branch));
  if (!graph) {
    throw Object.assign(new Error("knowledge_graph_unavailable"), {
      status: 404,
      code: "knowledge_graph_unavailable",
    });
  }
  return graph;
}

function findSymbolsByName(graph: GnKnowledgeGraph, name: string): GnSymbol[] {
  const q = name.trim().toLowerCase();
  return graph.symbols.filter(
    (s) => s.name.toLowerCase() === q || s.uid.toLowerCase().includes(q)
  );
}

function scoreText(query: string, hay: string): number {
  const tokens = query.toLowerCase().split(/\W+/).filter((t) => t.length > 2);
  if (!tokens.length) return 0;
  const h = hay.toLowerCase();
  let hits = 0;
  for (const t of tokens) if (h.includes(t)) hits += 1;
  return hits / tokens.length;
}

export async function gnListRepos(input: { limit?: number; offset?: number } = {}) {
  const scope = requireRepoScope();
  const limit = Math.min(200, Math.max(1, input.limit ?? 50));
  const offset = Math.max(0, input.offset ?? 0);
  const graph = await loadKnowledgeGraph(
    scope.organizationId,
    scope.repoOwner,
    scope.repoName,
    scope.defaultBranch || "main"
  );
  const row = {
    name: `${scope.repoOwner}/${scope.repoName}`,
    path: `${scope.repoOwner}/${scope.repoName}`,
    indexedAt: graph?.analyzedAt ?? null,
    stats: graph?.meta ?? null,
    branch: scope.defaultBranch,
  };
  const all = [row];
  const page = all.slice(offset, offset + limit);
  return {
    repositories: page,
    pagination: {
      total: all.length,
      limit,
      offset,
      returned: page.length,
      hasMore: offset + page.length < all.length,
      nextOffset: offset + page.length < all.length ? offset + page.length : null,
    },
  };
}

export async function gnQuery(input: {
  query?: string;
  q?: string;
  branchName?: string;
  limit?: number;
}) {
  const graph = await requireGraph(input.branchName);
  const q = (input.query || input.q || "").trim();
  if (!q) return { processes: [], process_symbols: [], definitions: [] };

  const scored = graph.processes
    .map((p) => {
      const hay = `${p.name} ${p.steps.map((s) => `${s.name} ${s.filePath}`).join(" ")}`;
      return { process: p, score: scoreText(q, hay) };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, input.limit ?? 12);

  const process_symbols = scored.flatMap(({ process }) =>
    process.steps.map((step) => {
      const sym = graph.symbols.find((s) => s.uid === step.symbolUid);
      return {
        name: step.name,
        type: sym?.kind ?? "Function",
        filePath: step.filePath,
        process_id: process.id,
        step_index: step.stepIndex,
        module: sym?.module,
      };
    })
  );

  const definitions = graph.symbols
    .filter((s) => ["Interface", "Type", "Class"].includes(s.kind))
    .filter((s) => scoreText(q, `${s.name} ${s.filePath}`) > 0)
    .slice(0, 20)
    .map((s) => ({
      name: s.name,
      type: s.kind,
      filePath: s.filePath,
    }));

  return {
    processes: scored.map(({ process, score }) => ({
      summary: process.name,
      priority: score,
      symbol_count: process.steps.length,
      process_type: process.processType,
      step_count: process.steps.length,
      process_id: process.id,
    })),
    process_symbols,
    definitions,
  };
}

export async function gnContext(input: {
  name?: string;
  uid?: string;
  branchName?: string;
}) {
  const graph = await requireGraph(input.branchName);
  let symbol: GnSymbol | undefined;
  if (input.uid) symbol = graph.symbols.find((s) => s.uid === input.uid);
  if (!symbol && input.name) symbol = findSymbolsByName(graph, input.name)[0];
  if (!symbol) {
    return { error: "symbol_not_found", name: input.name, uid: input.uid };
  }

  const incoming = { calls: [] as string[], imports: [] as string[] };
  const outgoing = { calls: [] as string[], imports: [] as string[] };
  const byUid = new Map(graph.symbols.map((s) => [s.uid, s]));

  for (const r of graph.relations) {
    if (r.toUid === symbol.uid) {
      const from = byUid.get(r.fromUid)?.name || r.fromUid;
      if (r.type === "CALLS") incoming.calls.push(from);
      if (r.type === "IMPORTS") incoming.imports.push(from);
    }
    if (r.fromUid === symbol.uid) {
      const to = byUid.get(r.toUid)?.name || r.toUid;
      if (r.type === "CALLS") outgoing.calls.push(to);
      if (r.type === "IMPORTS") outgoing.imports.push(to);
    }
  }

  const processes = graph.processes
    .map((p) => {
      const step = p.steps.find((s) => s.symbolUid === symbol!.uid);
      if (!step) return null;
      return { name: p.name, step: `${step.stepIndex + 1}/${p.steps.length}` };
    })
    .filter(Boolean);

  return {
    symbol: {
      uid: symbol.uid,
      kind: symbol.kind,
      filePath: symbol.filePath,
      startLine: symbol.startLine,
      name: symbol.name,
    },
    incoming,
    outgoing,
    processes,
  };
}

function walkImpact(
  graph: GnKnowledgeGraph,
  startUid: string,
  direction: "upstream" | "downstream",
  maxDepth: number,
  minConfidence: number,
  relationTypes: string[]
) {
  const edges =
    direction === "upstream"
      ? graph.relations.filter((r) => r.toUid === startUid || true)
      : graph.relations;

  const adj = new Map<string, Array<{ other: string; rel: GnRelation }>>();
  for (const r of graph.relations) {
    if (!relationTypes.includes(r.type)) continue;
    if (r.confidence < minConfidence) continue;
    if (direction === "upstream") {
      if (!adj.has(r.toUid)) adj.set(r.toUid, []);
      adj.get(r.toUid)!.push({ other: r.fromUid, rel: r });
    } else {
      if (!adj.has(r.fromUid)) adj.set(r.fromUid, []);
      adj.get(r.fromUid)!.push({ other: r.toUid, rel: r });
    }
  }

  const byDepth = new Map<number, Array<{ name: string; via: string; confidence: number; filePath: string }>>();
  const visited = new Set<string>([startUid]);
  let frontier = [startUid];
  const byUid = new Map(graph.symbols.map((s) => [s.uid, s]));

  for (let depth = 1; depth <= maxDepth; depth++) {
    const next: string[] = [];
    for (const uid of frontier) {
      for (const { other, rel } of adj.get(uid) || []) {
        if (visited.has(other)) continue;
        visited.add(other);
        next.push(other);
        const sym = byUid.get(other);
        if (!byDepth.has(depth)) byDepth.set(depth, []);
        byDepth.get(depth)!.push({
          name: sym?.name || other,
          via: rel.type,
          confidence: rel.confidence,
          filePath: sym?.filePath || "",
        });
      }
    }
    frontier = next;
    if (!frontier.length) break;
  }

  void edges;
  return byDepth;
}

export async function gnImpact(input: {
  target: string;
  direction?: "upstream" | "downstream";
  maxDepth?: number;
  minConfidence?: number;
  relationTypes?: string[];
  branchName?: string;
  includeTests?: boolean;
}) {
  const graph = await requireGraph(input.branchName);
  const matches = findSymbolsByName(graph, input.target);
  const target = matches[0];
  if (!target) {
    return { error: "target_not_found", target: input.target };
  }

  const direction = input.direction === "downstream" ? "downstream" : "upstream";
  const maxDepth = Math.min(IMPACT_MAX_DEPTH, Math.max(1, input.maxDepth ?? 3));
  const minConfidence = input.minConfidence ?? 0.5;
  const relationTypes = input.relationTypes?.length
    ? input.relationTypes
    : ["CALLS", "IMPORTS", "EXTENDS", "IMPLEMENTS"];

  const byDepth = walkImpact(
    graph,
    target.uid,
    direction,
    maxDepth,
    minConfidence,
    relationTypes
  );

  const depths: Record<string, unknown> = {};
  for (const [d, items] of byDepth) {
    const filtered = input.includeTests
      ? items
      : items.filter((i) => !/\.(test|spec)\.|__tests__|\/tests?\//i.test(i.filePath));
    depths[`depth_${d}`] = filtered;
  }

  return {
    target: {
      name: target.name,
      kind: target.kind,
      filePath: target.filePath,
      uid: target.uid,
    },
    direction,
    depths,
    clusters: graph.clusters
      .filter((c) => c.memberUids.includes(target.uid))
      .map((c) => ({ id: c.id, label: c.heuristicLabel })),
  };
}

export async function gnDetectChanges(input: {
  changedFiles?: string[];
  scope?: string;
  branchName?: string;
}) {
  const graph = await requireGraph(input.branchName);
  const files = (input.changedFiles || []).map((f) => f.replace(/\\/g, "/"));
  if (!files.length) {
    return {
      summary: {
        changed_count: 0,
        affected_count: 0,
        changed_files: 0,
        risk_level: "low",
      },
      changed_symbols: [],
      affected_processes: [],
    };
  }

  const changedSymbols = graph.symbols.filter((s) =>
    files.some((f) => s.filePath === f || s.filePath.endsWith(f))
  );
  const changedUids = new Set(changedSymbols.map((s) => s.uid));
  const affected = graph.processes.filter((p) =>
    p.steps.some((s) => changedUids.has(s.symbolUid))
  );

  const risk =
    affected.length > 5 ? "high" : affected.length > 1 ? "medium" : changedSymbols.length ? "low" : "low";

  return {
    summary: {
      changed_count: changedSymbols.length,
      affected_count: affected.length,
      changed_files: files.length,
      risk_level: risk,
      scope: input.scope || "custom",
    },
    changed_symbols: changedSymbols.slice(0, 100).map((s) => s.name),
    affected_processes: affected.map((p) => p.name),
    changed_files: files,
  };
}

export async function gnRename(input: {
  symbol_name: string;
  new_name: string;
  dry_run?: boolean;
  branchName?: string;
}) {
  const graph = await requireGraph(input.branchName);
  const dryRun = input.dry_run !== false;
  const matches = findSymbolsByName(graph, input.symbol_name);
  if (!matches.length) {
    return { status: "error", error: "symbol_not_found", dry_run: dryRun };
  }

  const files = new Set(matches.map((m) => m.filePath));
  const graphEdits = graph.relations.filter(
    (r) =>
      matches.some((m) => m.uid === r.fromUid || m.uid === r.toUid)
  ).length;

  return {
    status: dryRun ? "preview" : "blocked_saas_dry_run_only",
    dry_run: true,
    files_affected: files.size,
    total_edits: graphEdits + matches.length,
    graph_edits: graphEdits,
    text_search_edits: matches.length,
    changes: matches.map((m) => ({
      filePath: m.filePath,
      from: m.name,
      to: input.new_name,
      line: m.startLine,
      confidence: "high",
    })),
    message: "SaaS rename is dry-run only; apply edits in a PR workflow.",
  };
}

export async function gnCypher(input: { query: string; branchName?: string }) {
  const graph = await requireGraph(input.branchName);
  const q = input.query.trim();
  // Sandboxed subset: support simple MATCH patterns for CALLS / MEMBER_OF listing.
  if (/CALLS/i.test(q) && /RETURN/i.test(q)) {
    const rows = graph.relations
      .filter((r) => r.type === "CALLS" && r.confidence > 0.5)
      .slice(0, 100)
      .map((r) => {
        const from = graph.symbols.find((s) => s.uid === r.fromUid);
        const to = graph.symbols.find((s) => s.uid === r.toUid);
        return {
          caller: from?.name,
          callee: to?.name,
          confidence: r.confidence,
          callerFile: from?.filePath,
          calleeFile: to?.filePath,
        };
      });
    return { rows, note: "Sandboxed Cypher subset (CALLS listing)." };
  }
  if (/Community|MEMBER_OF|cluster/i.test(q)) {
    return {
      rows: graph.clusters.map((c) => ({
        id: c.id,
        label: c.heuristicLabel,
        members: c.memberUids.length,
        cohesion: c.cohesion,
      })),
      note: "Sandboxed Cypher subset (communities).",
    };
  }
  return {
    error: "unsupported_cypher",
    message:
      "Only a sandboxed Cypher subset is enabled in AgentOX (CALLS listing or communities). Full Ladybug Cypher requires CODEBASE_GITNEXUS_NATIVE=1.",
    schema_hint: graph.meta,
  };
}

export async function gnGraphPayload(input: {
  branchName?: string;
  limitNodes?: number;
  clusterCollapse?: boolean;
}) {
  const graph = await requireGraph(input.branchName);
  const limit = input.limitNodes ?? 800;

  if (input.clusterCollapse !== false && graph.clusters.length) {
    const nodes = graph.clusters.slice(0, 200).map((c) => ({
      id: c.id,
      label: c.heuristicLabel,
      kind: "Cluster",
      size: Math.min(40, 8 + c.memberUids.length),
      memberCount: c.memberUids.length,
    }));
    const edges: Array<{ id: string; source: string; target: string; type: string }> = [];
    const clusterOf = new Map<string, string>();
    for (const c of graph.clusters) {
      for (const uid of c.memberUids) clusterOf.set(uid, c.id);
    }
    const seen = new Set<string>();
    for (const r of graph.relations) {
      if (r.type === "MEMBER_OF") continue;
      const a = clusterOf.get(r.fromUid);
      const b = clusterOf.get(r.toUid);
      if (!a || !b || a === b) continue;
      const key = [a, b].sort().join("->");
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ id: key, source: a, target: b, type: "CLUSTER_LINK" });
    }
    return {
      view: "clusters",
      nodes,
      edges,
      meta: graph.meta,
      analyzedAt: graph.analyzedAt,
      source: graph.source,
    };
  }

  const symbols = graph.symbols
    .filter((s) => s.kind !== "File")
    .slice(0, limit);
  const uidSet = new Set(symbols.map((s) => s.uid));
  const nodes = symbols.map((s) => ({
    id: s.uid,
    label: s.name,
    kind: s.kind,
    filePath: s.filePath,
    module: s.module,
    size: 6,
  }));
  const edges = graph.relations
    .filter((r) => uidSet.has(r.fromUid) && uidSet.has(r.toUid) && r.type !== "MEMBER_OF")
    .slice(0, limit * 2)
    .map((r, i) => ({
      id: `e${i}`,
      source: r.fromUid,
      target: r.toUid,
      type: r.type,
      confidence: r.confidence,
    }));

  return {
    view: "symbols",
    nodes,
    edges,
    meta: graph.meta,
    analyzedAt: graph.analyzedAt,
    source: graph.source,
  };
}

export async function gnResources(resource: string, name?: string, branchName?: string) {
  const graph = await requireGraph(branchName);
  switch (resource) {
    case "context":
      return {
        stats: graph.meta,
        analyzedAt: graph.analyzedAt,
        source: graph.source,
        gitnexusCommit: graph.gitnexusCommit,
        tools: [
          "list_repos",
          "query",
          "context",
          "impact",
          "detect_changes",
          "rename",
          "cypher",
        ],
      };
    case "clusters":
      return {
        clusters: graph.clusters.map((c) => ({
          name: c.heuristicLabel,
          id: c.id,
          cohesion: c.cohesion,
          members: c.memberUids.length,
        })),
      };
    case "cluster": {
      const c = graph.clusters.find(
        (x) => x.id === name || x.heuristicLabel === name
      );
      if (!c) return { error: "cluster_not_found" };
      return {
        ...c,
        members: c.memberUids
          .map((uid) => graph.symbols.find((s) => s.uid === uid))
          .filter(Boolean),
      };
    }
    case "processes":
      return {
        processes: graph.processes.map((p) => ({
          id: p.id,
          name: p.name,
          type: p.processType,
          steps: p.steps.length,
          priority: p.priority,
        })),
      };
    case "process": {
      const p = graph.processes.find((x) => x.id === name || x.name === name);
      return p || { error: "process_not_found" };
    }
    case "schema":
      return {
        nodes: ["File", "Function", "Class", "Method", "Interface", "Community"],
        relationships: ["IMPORTS", "CALLS", "EXTENDS", "IMPLEMENTS", "MEMBER_OF"],
      };
    default:
      return { error: "unknown_resource" };
  }
}
