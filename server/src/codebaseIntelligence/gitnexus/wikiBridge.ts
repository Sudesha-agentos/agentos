/**
 * Wiki generation from the knowledge graph (GitNexus wiki nuance).
 * Required Notice: Copyright Abhigyan Patwari (https://github.com/abhigyanpatwari/GitNexus)
 */

import { chatCompletionText } from "../../llm/openaiCompletion";
import { isOpenAIConfigured } from "../../llm/openaiClient";
import { requireRepoScope } from "../repoScope";
import { getOrBuildGraph } from "./analyzeBridge";
import type { GnKnowledgeGraph } from "./types";

export type GnWikiPage = {
  id: string;
  title: string;
  body: string;
  module: string;
  fileRefs: string[];
};

export type GnWiki = {
  generatedAt: string;
  source: "openai" | "heuristic";
  overview: string;
  pages: GnWikiPage[];
};

function heuristicWiki(graph: GnKnowledgeGraph): GnWiki {
  const pages: GnWikiPage[] = graph.clusters.slice(0, 24).map((c) => {
    const files = [
      ...new Set(
        c.memberUids
          .map((uid) => graph.symbols.find((s) => s.uid === uid)?.filePath)
          .filter(Boolean) as string[]
      ),
    ].slice(0, 12);
    return {
      id: c.id,
      title: c.heuristicLabel,
      module: c.heuristicLabel,
      fileRefs: files,
      body: `Cluster **${c.heuristicLabel}** groups ${c.memberUids.length} symbols (cohesion ${c.cohesion.toFixed(2)}).\n\nKey files:\n${files.map((f) => `- \`${f}\``).join("\n")}`,
    };
  });

  const processLines = graph.processes
    .slice(0, 15)
    .map((p) => `- **${p.name}** (${p.processType}, ${p.steps.length} steps)`)
    .join("\n");

  return {
    generatedAt: new Date().toISOString(),
    source: "heuristic",
    overview: `Knowledge graph wiki for ${graph.repoOwner}/${graph.repoName}@${graph.branchName}.\n\nSymbols: ${graph.meta.symbolCount}, edges: ${graph.meta.edgeCount}, clusters: ${graph.meta.clusterCount}, processes: ${graph.meta.processCount}.\n\n### Execution flows\n${processLines || "_No processes detected._"}`,
    pages,
  };
}

export async function generateGitNexusWiki(branchName?: string): Promise<GnWiki> {
  const scope = requireRepoScope();
  const graph = await getOrBuildGraph(branchName || scope.defaultBranch);
  if (!graph) {
    throw Object.assign(new Error("knowledge_graph_unavailable"), { status: 404 });
  }

  const base = heuristicWiki(graph);
  if (!isOpenAIConfigured() || graph.clusters.length === 0) return base;

  try {
    const prompt = `You are documenting a codebase knowledge graph.
Repo: ${graph.repoOwner}/${graph.repoName} branch ${graph.branchName}
Clusters: ${graph.clusters
      .slice(0, 20)
      .map((c) => `${c.heuristicLabel} (${c.memberUids.length} symbols)`)
      .join("; ")}
Processes: ${graph.processes
      .slice(0, 15)
      .map((p) => p.name)
      .join(", ")}

Write a concise markdown overview (max 400 words) of the architecture implied by these clusters and processes.`;
    const overview = await chatCompletionText({
      system:
        "You document codebase knowledge graphs. Be concise and architectural.",
      user: prompt,
      maxTokens: 800,
    });
    return {
      ...base,
      source: "openai",
      overview: overview.text.trim() || base.overview,
    };
  } catch {
    return base;
  }
}
