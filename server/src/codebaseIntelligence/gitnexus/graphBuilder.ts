/**
 * Build a GitNexus-shaped knowledge graph from indexed CodebaseFile rows.
 * Uses Tree-sitter (already in AgentOX) + Graphology Louvain (same family as GitNexus clustering).
 *
 * Required Notice: Copyright Abhigyan Patwari (https://github.com/abhigyanpatwari/GitNexus)
 */

import louvain from "graphology-communities-louvain";
import { prisma } from "../../db/client";
import { parseImports, resolveImportPath } from "../directoryService";
import { buildSemanticChunks } from "../astChunker";
import { logger } from "../../utils/logger";
import {
  GITNEXUS_VENDOR_COMMIT,
  type GnCluster,
  type GnKnowledgeGraph,
  type GnProcess,
  type GnRelation,
  type GnSymbol,
} from "./types";

// graphology CJS export is the Graph constructor (also .Graph).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Graph = require("graphology") as {
  new (options?: { multi?: boolean; type?: string }): {
    hasNode(id: string): boolean;
    addNode(id: string, attrs?: Record<string, unknown>): void;
    hasEdge(a: string, b: string): boolean;
    addEdge(a: string, b: string, attrs?: Record<string, unknown>): void;
    order: number;
  };
};

const prismaAny = prisma as any;

type FileRow = {
  filePath: string;
  content: string;
  language: string | null;
  imports: unknown;
  exports: unknown;
};

function moduleOf(filePath: string): string {
  const parts = filePath.replace(/\\/g, "/").split("/").filter(Boolean);
  if (parts.length === 0) return "root";
  if (parts.length === 1) return parts[0]!;
  const top = parts[0]!.toLowerCase();
  // Prefer src/features style labels over a flat "src" / "app" bucket.
  if (["src", "app", "lib", "packages", "server", "client", "web", "api"].includes(top)) {
    return parts.slice(0, Math.min(3, parts.length - (parts.length > 3 ? 1 : 0))).join("/");
  }
  return parts.slice(0, Math.min(2, parts.length)).join("/");
}

function symbolUid(kind: string, name: string, filePath: string, line: number): string {
  return `${kind}:${name}@${filePath}:${line}`;
}

function inferNameFromText(text: string): string | null {
  const head = text.trim().slice(0, 400);
  const patterns = [
    /(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s+([A-Za-z_$][\w$]*)/,
    /(?:export\s+)?(?:default\s+)?class\s+([A-Za-z_$][\w$]*)/,
    /(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/,
    /(?:export\s+)?(?:type|interface|enum)\s+([A-Za-z_$][\w$]*)/,
    /(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/,
    /(?:async\s+)?([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/,
    /(?:async\s+)?([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\(/,
  ];
  for (const re of patterns) {
    const m = head.match(re);
    if (m?.[1] && m[1] !== "async" && m[1] !== "function") return m[1];
  }
  return null;
}

const SKIP_SPAN_TYPES = new Set([
  "import_statement",
  "module_fragment",
  "line_block",
  "merged_block",
  "comment",
  "expression_statement",
]);

function extractSymbols(file: FileRow): GnSymbol[] {
  const fileName = file.filePath.split("/").pop() || file.filePath;
  const symbols: GnSymbol[] = [
    {
      uid: symbolUid("File", file.filePath, file.filePath, 1),
      kind: "File",
      name: fileName,
      filePath: file.filePath,
      startLine: 1,
      endLine: Math.max(1, file.content.split("\n").length),
      module: moduleOf(file.filePath),
    },
  ];

  const seenNames = new Set<string>();

  try {
    const chunks = buildSemanticChunks(file.filePath, file.content);
    for (const chunk of chunks) {
      if (chunk.chunkStrategy !== "ast") continue;
      const spanType = (chunk.spanType || "").toLowerCase();
      if (SKIP_SPAN_TYPES.has(spanType)) continue;

      const name =
        (chunk.symbolName && chunk.symbolName.trim()) ||
        inferNameFromText(chunk.text) ||
        null;
      // Skip unnamed noise (imports/gaps previously became every node "anonymous").
      if (!name || name === "anonymous") continue;
      if (seenNames.has(`${name}:${chunk.startLine}`)) continue;
      seenNames.add(`${name}:${chunk.startLine}`);

      const kindRaw = spanType;
      let kind: GnSymbol["kind"] = "Function";
      if (kindRaw.includes("class")) kind = "Class";
      else if (kindRaw.includes("method")) kind = "Method";
      else if (kindRaw.includes("interface")) kind = "Interface";
      else if (kindRaw.includes("type") || kindRaw.includes("enum")) kind = "Type";
      else if (
        kindRaw.includes("variable") ||
        kindRaw.includes("lexical") ||
        kindRaw.includes("const") ||
        kindRaw.includes("export")
      ) {
        kind = "Variable";
        // Prefer Function when the lexical decl looks like a function/arrow.
        if (/\([^)]*\)\s*=>|\bfunction\b/.test(chunk.text.slice(0, 200))) {
          kind = "Function";
        } else if (/^[A-Z]/.test(name) && /\bclass\b|\binterface\b/.test(chunk.text.slice(0, 120))) {
          kind = kindRaw.includes("interface") ? "Interface" : "Class";
        }
      }

      const startLine = chunk.startLine ?? 1;
      symbols.push({
        uid: symbolUid(kind, name, file.filePath, startLine),
        kind,
        name,
        filePath: file.filePath,
        startLine,
        endLine: chunk.endLine ?? startLine,
        module: moduleOf(file.filePath),
      });
    }
  } catch (err) {
    logger.debug({ err, path: file.filePath }, "gitnexus symbol extract skipped file");
  }

  return symbols;
}

function buildCallEdges(files: FileRow[], symbols: GnSymbol[]): GnRelation[] {
  const byFile = new Map<string, GnSymbol[]>();
  for (const s of symbols) {
    if (s.kind === "File") continue;
    if (!byFile.has(s.filePath)) byFile.set(s.filePath, []);
    byFile.get(s.filePath)!.push(s);
  }

  const nameIndex = new Map<string, GnSymbol[]>();
  for (const s of symbols) {
    if (s.kind === "File" || s.kind === "Folder") continue;
    if (!nameIndex.has(s.name)) nameIndex.set(s.name, []);
    nameIndex.get(s.name)!.push(s);
  }

  const relations: GnRelation[] = [];
  const seen = new Set<string>();

  for (const file of files) {
    const locals = byFile.get(file.filePath) ?? [];
    for (const caller of locals) {
      // Rough CALLS: identifier mentions of other symbol names in the caller span.
      const lines = file.content.split("\n");
      const slice = lines.slice(Math.max(0, caller.startLine - 1), caller.endLine).join("\n");
      for (const [name, targets] of nameIndex) {
        if (name === caller.name || name.length < 3) continue;
        if (!new RegExp(`\\b${escapeRegExp(name)}\\s*\\(`).test(slice)) continue;
        const target =
          targets.find((t) => t.filePath === file.filePath && t.uid !== caller.uid) ||
          targets.find((t) => t.uid !== caller.uid);
        if (!target) continue;
        const key = `${caller.uid}->${target.uid}:CALLS`;
        if (seen.has(key)) continue;
        seen.add(key);
        const sameFile = target.filePath === caller.filePath;
        relations.push({
          fromUid: caller.uid,
          toUid: target.uid,
          type: "CALLS",
          confidence: sameFile ? 0.75 : 0.55,
        });
      }
    }
  }

  return relations;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildImportEdges(files: FileRow[], pathSet: Set<string>): GnRelation[] {
  const relations: GnRelation[] = [];
  for (const file of files) {
    const fromUid = symbolUid("File", file.filePath, file.filePath, 1);
    for (const imp of parseImports(file.imports)) {
      const resolved = resolveImportPath(file.filePath, imp.from, pathSet);
      if (!resolved) continue;
      relations.push({
        fromUid,
        toUid: symbolUid("File", resolved, resolved, 1),
        type: "IMPORTS",
        confidence: 0.95,
      });
    }
  }
  return relations;
}

function buildClusters(symbols: GnSymbol[], relations: GnRelation[]): GnCluster[] {
  const g = new Graph({ multi: false, type: "undirected" });
  for (const s of symbols) {
    if (!g.hasNode(s.uid)) g.addNode(s.uid, { module: s.module });
  }
  for (const r of relations) {
    if (!g.hasNode(r.fromUid) || !g.hasNode(r.toUid)) continue;
    if (r.fromUid === r.toUid) continue;
    if (!g.hasEdge(r.fromUid, r.toUid)) {
      g.addEdge(r.fromUid, r.toUid, { weight: r.confidence });
    }
  }

  if (g.order === 0) return [];

  let communities: Record<string, number> = {};
  try {
    communities = louvain(g) as Record<string, number>;
  } catch {
    // Fallback: cluster by top-level module folder.
    const byMod = new Map<string, number>();
    let i = 0;
    for (const s of symbols) {
      const mod = s.module || "root";
      if (!byMod.has(mod)) byMod.set(mod, i++);
      communities[s.uid] = byMod.get(mod)!;
    }
  }

  const buckets = new Map<number, string[]>();
  for (const [uid, cid] of Object.entries(communities)) {
    if (!buckets.has(cid)) buckets.set(cid, []);
    buckets.get(cid)!.push(uid);
  }

  const symbolMap = new Map(symbols.map((s) => [s.uid, s]));
  const clusters: GnCluster[] = [];
  for (const [cid, members] of buckets) {
    if (members.length < 2) continue;

    const mods = new Map<string, number>();
    const nameVotes = new Map<string, number>();
    for (const uid of members) {
      const sym = symbolMap.get(uid);
      if (!sym) continue;
      const mod = sym.module || "root";
      mods.set(mod, (mods.get(mod) || 0) + 1);
      if (sym.kind !== "File" && sym.name && sym.name !== "anonymous") {
        nameVotes.set(sym.name, (nameVotes.get(sym.name) || 0) + 1);
      }
    }

    const topMod =
      [...mods.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || `community_${cid}`;
    const topNames = [...nameVotes.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 2)
      .map(([n]) => n);
    // Prefer readable module path; fall back to dominant symbol names.
    const label =
      topMod !== "root" && topMod !== "anonymous"
        ? topMod
        : topNames.length
          ? topNames.join(" · ")
          : `community_${cid}`;

    clusters.push({
      id: `cluster_${cid}`,
      heuristicLabel: label,
      memberUids: members,
      cohesion: Math.min(1, members.length / 20),
    });
  }
  return clusters;
}

function buildProcesses(
  symbols: GnSymbol[],
  relations: GnRelation[],
  clusters: GnCluster[]
): GnProcess[] {
  const calls = relations.filter((r) => r.type === "CALLS");
  const outgoing = new Map<string, string[]>();
  for (const r of calls) {
    if (!outgoing.has(r.fromUid)) outgoing.set(r.fromUid, []);
    outgoing.get(r.fromUid)!.push(r.toUid);
  }

  const clusterOf = new Map<string, string>();
  for (const c of clusters) {
    for (const uid of c.memberUids) clusterOf.set(uid, c.id);
  }

  const symbolMap = new Map(symbols.map((s) => [s.uid, s]));
  const entryCandidates = symbols.filter(
    (s) =>
      s.kind === "Function" ||
      s.kind === "Method"
  ).filter((s) => {
    const n = s.name.toLowerCase();
    return (
      /^(handle|get|post|put|delete|create|run|main|execute|process)/.test(n) ||
      n.includes("handler") ||
      n.includes("controller") ||
      n.includes("route")
    );
  });

  const processes: GnProcess[] = [];
  let idx = 0;
  for (const entry of entryCandidates.slice(0, 80)) {
    const steps: GnProcess["steps"] = [];
    const visited = new Set<string>();
    let current = entry.uid;
    for (let depth = 0; depth < 8; depth++) {
      if (visited.has(current)) break;
      visited.add(current);
      const sym = symbolMap.get(current);
      if (!sym) break;
      steps.push({
        stepIndex: depth,
        symbolUid: sym.uid,
        name: sym.name,
        filePath: sym.filePath,
      });
      const next = (outgoing.get(current) || [])[0];
      if (!next) break;
      current = next;
    }
    if (steps.length < 2) continue;
    const clusterIds = new Set(
      steps.map((s) => clusterOf.get(s.symbolUid)).filter(Boolean)
    );
    processes.push({
      id: `proc_${idx++}`,
      name: `${entry.name}Flow`,
      processType: clusterIds.size > 1 ? "cross_community" : "intra_community",
      priority: 1 / (1 + idx),
      steps,
    });
  }
  return processes;
}

export async function buildKnowledgeGraphFromIndexedFiles(input: {
  organizationId: string;
  repoOwner: string;
  repoName: string;
  branchName: string;
}): Promise<GnKnowledgeGraph> {
  const files: FileRow[] = await prismaAny.codebaseFile.findMany({
    where: {
      organizationId: input.organizationId,
      repoOwner: input.repoOwner,
      repoName: input.repoName,
      branchName: input.branchName,
      isDeleted: false,
    },
    select: {
      filePath: true,
      content: true,
      language: true,
      imports: true,
      exports: true,
    },
    take: 2500,
  });

  const pathSet = new Set(files.map((f) => f.filePath));
  const symbols: GnSymbol[] = [];
  for (const file of files) {
    symbols.push(...extractSymbols(file));
  }

  const importEdges = buildImportEdges(files, pathSet);
  const callEdges = buildCallEdges(files, symbols);
  const memberEdges: GnRelation[] = [];
  const clusters = buildClusters(symbols, [...importEdges, ...callEdges]);
  for (const c of clusters) {
    for (const uid of c.memberUids) {
      memberEdges.push({
        fromUid: uid,
        toUid: `Community:${c.id}`,
        type: "MEMBER_OF",
        confidence: 0.9,
      });
    }
  }

  const relations = [...importEdges, ...callEdges, ...memberEdges];
  const processes = buildProcesses(symbols, relations, clusters);

  return {
    version: 1,
    source: "agentox-bridge",
    gitnexusCommit: GITNEXUS_VENDOR_COMMIT,
    organizationId: input.organizationId,
    repoOwner: input.repoOwner,
    repoName: input.repoName,
    branchName: input.branchName,
    analyzedAt: new Date().toISOString(),
    symbols,
    relations,
    clusters,
    processes,
    meta: {
      symbolCount: symbols.length,
      edgeCount: relations.length,
      clusterCount: clusters.length,
      processCount: processes.length,
    },
  };
}
