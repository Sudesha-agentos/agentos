import { logger } from "../../utils/logger";
import { requireRepoScope } from "../repoScope";
import { buildKnowledgeGraphFromIndexedFiles } from "./graphBuilder";
import { saveKnowledgeGraph, loadKnowledgeGraph, graphStatus } from "./graphStore";
import { isGitNexusGraphEnabled, type GnKnowledgeGraph } from "./types";
import { getActiveOrganizationId } from "../../organization/context";

/**
 * After AgentOX file/embedding index completes, rebuild the GitNexus-shaped graph.
 * Native Ladybug analyze (vendored run-analyze) can be opted in later via
 * CODEBASE_GITNEXUS_NATIVE=1 once commercial rights + native deps are ready.
 */
export async function runGitNexusAnalyzeForScope(input?: {
  organizationId?: string;
  repoOwner?: string;
  repoName?: string;
  branchName?: string;
}): Promise<GnKnowledgeGraph | null> {
  if (!isGitNexusGraphEnabled()) {
    logger.info("CODEBASE_GITNEXUS_GRAPH disabled — skipping graph analyze");
    return null;
  }

  const scope = input?.repoOwner
    ? {
        organizationId: input.organizationId || getActiveOrganizationId() || "",
        repoOwner: input.repoOwner,
        repoName: input.repoName || "",
        defaultBranch: input.branchName || "main",
      }
    : requireRepoScope();

  const organizationId = input?.organizationId || scope.organizationId;
  const repoOwner = input?.repoOwner || scope.repoOwner;
  const repoName = input?.repoName || scope.repoName;
  const branchName = input?.branchName || scope.defaultBranch || "main";

  if (!organizationId || !repoOwner || !repoName) {
    logger.warn("gitnexus analyze skipped — missing org/repo scope");
    return null;
  }

  const started = Date.now();
  try {
    // Prefer AgentOX bridge graph (works without Ladybug native). Vendored
    // GitNexus pipeline remains available under server/vendor/gitnexus for
    // native mode once CODEBASE_GITNEXUS_NATIVE=1 is supported in this env.
    const graph = await buildKnowledgeGraphFromIndexedFiles({
      organizationId,
      repoOwner,
      repoName,
      branchName,
    });
    await saveKnowledgeGraph(graph);
    logger.info(
      {
        branchName,
        durationMs: Date.now() - started,
        ...graph.meta,
        source: graph.source,
      },
      "gitnexus analyze bridge completed"
    );
    return graph;
  } catch (err) {
    logger.error({ err, branchName }, "gitnexus analyze bridge failed");
    throw err;
  }
}

export async function getOrBuildGraph(branchName?: string): Promise<GnKnowledgeGraph | null> {
  const scope = requireRepoScope();
  const branch = branchName || scope.defaultBranch || "main";
  const existing = await loadKnowledgeGraph(
    scope.organizationId,
    scope.repoOwner,
    scope.repoName,
    branch
  );
  if (existing) return existing;
  return runGitNexusAnalyzeForScope({
    organizationId: scope.organizationId,
    repoOwner: scope.repoOwner,
    repoName: scope.repoName,
    branchName: branch,
  });
}

export { graphStatus, loadKnowledgeGraph };
