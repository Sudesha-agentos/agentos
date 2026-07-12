import fs from "node:fs/promises";
import path from "node:path";
import { logger } from "../../utils/logger";
import type { GnKnowledgeGraph } from "./types";
import { GITNEXUS_VENDOR_COMMIT } from "./types";

const ROOT = process.env.CODEBASE_GRAPH_DATA_DIR?.trim()
  || path.join(process.cwd(), "data", "graphs");

export function graphArtifactDir(
  organizationId: string,
  repoOwner: string,
  repoName: string,
  branchName: string
): string {
  const safe = (s: string) => s.replace(/[^a-zA-Z0-9._-]+/g, "_");
  return path.join(
    ROOT,
    safe(organizationId),
    safe(repoOwner),
    safe(repoName),
    safe(branchName)
  );
}

export function graphArtifactPath(
  organizationId: string,
  repoOwner: string,
  repoName: string,
  branchName: string
): string {
  return path.join(graphArtifactDir(organizationId, repoOwner, repoName, branchName), "graph.json");
}

export async function saveKnowledgeGraph(graph: GnKnowledgeGraph): Promise<string> {
  const dir = graphArtifactDir(
    graph.organizationId,
    graph.repoOwner,
    graph.repoName,
    graph.branchName
  );
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, "graph.json");
  const metaFile = path.join(dir, "meta.json");
  await fs.writeFile(file, JSON.stringify(graph), "utf8");
  await fs.writeFile(
    metaFile,
    JSON.stringify(
      {
        gitnexusCommit: graph.gitnexusCommit || GITNEXUS_VENDOR_COMMIT,
        analyzedAt: graph.analyzedAt,
        source: graph.source,
        ...graph.meta,
      },
      null,
      2
    ),
    "utf8"
  );
  logger.info(
    {
      file,
      symbols: graph.meta.symbolCount,
      edges: graph.meta.edgeCount,
      source: graph.source,
    },
    "gitnexus knowledge graph saved"
  );
  return file;
}

export async function loadKnowledgeGraph(
  organizationId: string,
  repoOwner: string,
  repoName: string,
  branchName: string
): Promise<GnKnowledgeGraph | null> {
  const file = graphArtifactPath(organizationId, repoOwner, repoName, branchName);
  try {
    const raw = await fs.readFile(file, "utf8");
    return JSON.parse(raw) as GnKnowledgeGraph;
  } catch {
    return null;
  }
}

export async function graphStatus(
  organizationId: string,
  repoOwner: string,
  repoName: string,
  branchName: string
): Promise<{
  ready: boolean;
  analyzedAt: string | null;
  symbolCount: number | null;
  edgeCount: number | null;
  clusterCount: number | null;
  processCount: number | null;
  source: string | null;
  gitnexusCommit: string | null;
}> {
  const g = await loadKnowledgeGraph(organizationId, repoOwner, repoName, branchName);
  if (!g) {
    return {
      ready: false,
      analyzedAt: null,
      symbolCount: null,
      edgeCount: null,
      clusterCount: null,
      processCount: null,
      source: null,
      gitnexusCommit: null,
    };
  }
  return {
    ready: true,
    analyzedAt: g.analyzedAt,
    symbolCount: g.meta.symbolCount,
    edgeCount: g.meta.edgeCount,
    clusterCount: g.meta.clusterCount,
    processCount: g.meta.processCount,
    source: g.source,
    gitnexusCommit: g.gitnexusCommit,
  };
}
