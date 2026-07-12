/**
 * GitNexus-shaped knowledge graph types for AgentOX.
 * Tool response contracts mirror gitnexus/src/mcp/tools.ts + local-backend.
 *
 * Required Notice: Copyright Abhigyan Patwari (https://github.com/abhigyanpatwari/GitNexus)
 * Vendored under PolyForm Noncommercial — see server/vendor/NOTICE.
 */

export type GnRelationType =
  | "IMPORTS"
  | "CALLS"
  | "EXTENDS"
  | "IMPLEMENTS"
  | "MEMBER_OF"
  | "CONTAINS";

export type GnSymbolKind =
  | "File"
  | "Folder"
  | "Function"
  | "Class"
  | "Method"
  | "Interface"
  | "Type"
  | "Variable"
  | "Module";

export type GnSymbol = {
  uid: string;
  kind: GnSymbolKind;
  name: string;
  filePath: string;
  startLine: number;
  endLine: number;
  module?: string;
};

export type GnRelation = {
  fromUid: string;
  toUid: string;
  type: GnRelationType;
  confidence: number;
};

export type GnCluster = {
  id: string;
  heuristicLabel: string;
  memberUids: string[];
  cohesion: number;
};

export type GnProcessStep = {
  stepIndex: number;
  symbolUid: string;
  name: string;
  filePath: string;
};

export type GnProcess = {
  id: string;
  name: string;
  processType: "intra_community" | "cross_community";
  priority: number;
  steps: GnProcessStep[];
};

export type GnKnowledgeGraph = {
  version: 1;
  source: "agentox-bridge" | "gitnexus-native";
  gitnexusCommit: string;
  organizationId: string;
  repoOwner: string;
  repoName: string;
  branchName: string;
  analyzedAt: string;
  symbols: GnSymbol[];
  relations: GnRelation[];
  clusters: GnCluster[];
  processes: GnProcess[];
  meta: {
    symbolCount: number;
    edgeCount: number;
    clusterCount: number;
    processCount: number;
  };
};

export const GITNEXUS_VENDOR_COMMIT = "c6445096eb3fdfa70bc1d13995918e0cbd783a38";

export function isGitNexusGraphEnabled(): boolean {
  const v = process.env.CODEBASE_GITNEXUS_GRAPH?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === undefined || v === "";
}
