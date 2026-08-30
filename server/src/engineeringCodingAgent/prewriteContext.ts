import { getApiModelForRole, getModelIdForRole } from "../billing/consumeAgentCredits";
import { buildEnrichedCodebaseContext } from "../codebaseIntelligence/enrichedContextService";
import { getCodebaseLayerStatus } from "../codebaseIntelligence/layerStatus";
import { resolveRepoScope } from "../codebaseIntelligence/repoScope";
import { buildDatabaseCatalogPromptBlock } from "../customerDb/promptBlock";
import { listDatabases, resolveCustomerDbOrganizationId } from "../customerDb/store";
import { AGENT_MODELS } from "../llm/agentModels";
import {
  formatBugLogForPrompt,
  gatherBugLogContext,
} from "../agents/virin/bugLogContext";
import type { GeneratedPRD } from "../prd/prdGenerator";
import type { ImplementationOutput, PrdOutput } from "../types/agents";
import { logger } from "../utils/logger";
import { ticketNeedsDatabase } from "./databaseNeed";

export { ticketNeedsDatabase };

const INTEL_MAX_CHARS = 12_000;

export type TechPrewriteContext = {
  selectedModelLabel: string;
  codebaseIntelligenceBlock: string;
  databaseCatalogBlock: string;
  databaseConnected: boolean;
  mustAskForDatabase: boolean;
  logIntelligenceBlock: string;
  logsConnected: boolean;
};

export function formatSelectedTechModel(): string {
  const provider = getModelIdForRole("tech");
  const apiModel = getApiModelForRole("tech");
  const vendor = AGENT_MODELS[provider]?.label ?? provider;
  return `${vendor} · ${apiModel}`;
}

export async function gatherTechPrewriteContext(input: {
  pipelineId: string;
  jiraKey: string;
  prd: PrdOutput;
  implementation?: ImplementationOutput | null;
  generatedPrd?: GeneratedPRD | null;
  branchName: string;
  /** Skip ranked-file retrieval when the caller already loaded a snapshot. */
  skipCodebase?: boolean;
}): Promise<TechPrewriteContext> {
  const [codebaseIntelligenceBlock, db, logs] = await Promise.all([
    input.skipCodebase
      ? Promise.resolve("## 1. Codebase intelligence layer\nSee codebaseIntelligence snapshot in this payload.")
      : buildCodebaseIntelligenceBlock(input.prd, input.branchName),
    loadDatabaseContext(input.pipelineId),
    loadLogContext(input.jiraKey, input.prd),
  ]);

  const needsDb = ticketNeedsDatabase(input.prd, input.implementation, input.generatedPrd);
  const mustAskForDatabase = needsDb && !db.connected;

  return {
    selectedModelLabel: formatSelectedTechModel(),
    codebaseIntelligenceBlock,
    databaseCatalogBlock: mustAskForDatabase
      ? [
          db.block,
          "",
          "DATABASE REQUIRED BUT NOT CONNECTED.",
          "Do not invent tables, columns, or migrations.",
          "Ask in this turn (via codingSummary + confidenceReason blockers) that a human attach a customer database in Settings → Integrations, then resume.",
          "You may implement non-schema work only if it is independently valuable and does not depend on invented persistence.",
        ].join("\n")
      : db.block,
    databaseConnected: db.connected,
    mustAskForDatabase,
    logIntelligenceBlock: logs.block,
    logsConnected: logs.connected,
  };
}

async function buildCodebaseIntelligenceBlock(
  prd: PrdOutput,
  branchName: string
): Promise<string> {
  const scope = resolveRepoScope();
  const branch = branchName || scope?.defaultBranch || "main";
  const lines: string[] = ["## 1. Codebase intelligence layer"];

  try {
    const status = await getCodebaseLayerStatus(branch);
    lines.push(
      `Repo: ${status.repo?.fullName ?? "not connected"} · branch ${branch}`,
      `Index: ${status.index.status} (${status.counts.filesIndexed} files, embeddings ${status.counts.embeddings})`,
      `Graph: ${status.graph.ready ? "ready" : "not ready"}${status.graph.nodeCount != null ? ` · ${status.graph.nodeCount} nodes` : ""}`,
      status.ready
        ? "Layer is ready — treat the ranked files below as the starting map. Verify with read_file before editing."
        : `Layer not ready: ${(status.blockers ?? []).join("; ") || "index still building. Use list_dir/grep."}`
    );
  } catch (err) {
    logger.warn({ err }, "codebase layer status failed for tech prewrite");
    lines.push("Layer status unavailable — explore with list_dir/grep.");
  }

  try {
    const query = `${prd.title}\n${prd.problemStatement}\n${(prd.acceptanceCriteria ?? []).join("\n")}`;
    const bundle = await buildEnrichedCodebaseContext({
      query,
      branchName: branch,
      topN: 10,
      fetchFreshContent: false,
      forEngineering: true,
    });
    const formatted = (bundle.formatted || "").trim();
    lines.push("", formatted || "No ranked files for this PRD yet.");
  } catch (err) {
    logger.warn({ err, branch }, "codebase intelligence snapshot failed for tech prewrite");
    lines.push("", "Intelligence snapshot unavailable (lookup failed or index not ready).");
  }

  const block = lines.join("\n");
  if (block.length <= INTEL_MAX_CHARS) return block;
  return `${block.slice(0, INTEL_MAX_CHARS)}\n…codebase intelligence truncated`;
}

async function loadDatabaseContext(pipelineId: string): Promise<{
  connected: boolean;
  block: string;
}> {
  const block = await buildDatabaseCatalogPromptBlock(pipelineId).catch(
    () => "CUSTOMER DATABASES: catalog unavailable."
  );
  try {
    const organizationId = await resolveCustomerDbOrganizationId(pipelineId);
    if (!organizationId) {
      return { connected: false, block };
    }
    const databases = await listDatabases(organizationId);
    return { connected: databases.length > 0, block };
  } catch {
    return { connected: false, block };
  }
}

async function loadLogContext(
  jiraKey: string,
  prd: PrdOutput
): Promise<{ connected: boolean; block: string }> {
  try {
    const ctx = await gatherBugLogContext({
      jiraKey,
      ticketSummary: `${prd.title} ${prd.problemStatement}`,
    });
    const brief = formatBugLogForPrompt(ctx);
    return {
      connected: !ctx.needsLogSourceLink,
      block: [
        "## 3. Log intelligence",
        ctx.needsLogSourceLink
          ? "No log sources connected. If the PRD or ticket depends on production errors, ask the human to connect Logs → Sources (or paste stack traces) before guessing a root cause."
          : "Log sources are connected. Use the references below as diagnosis — do not invent a different failure mode.",
        brief,
      ].join("\n"),
    };
  } catch (err) {
    logger.warn({ err, jiraKey }, "log intelligence failed for tech prewrite");
    return {
      connected: false,
      block: [
        "## 3. Log intelligence",
        "Log Intelligence query failed. If this is a bug fix, ask the human for stack traces before changing production paths.",
      ].join("\n"),
    };
  }
}
