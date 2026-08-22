import { logger } from "../utils/logger";
import { codebaseQueryService } from "../codebaseIntelligence/queryService";
import { resolveRepoScope } from "../codebaseIntelligence/repoScope";
import type { GateId, GateResult } from "../types/pipeline";
import type { DuplicateSearcher, GateInput } from "./input";
import { evaluateVirinDiscovery } from "./rules/virinDiscovery";
import { evaluateVirinPrd } from "./rules/virinPrd";
import { evaluatePrdGate } from "./rules/prd";
import { evaluateImplementationGate } from "./rules/implementation";
import { evaluateQaGate } from "./rules/qa";

export async function defaultDuplicateSearcher(
  query: string
): Promise<Array<{ filePath: string; similarity: number; snippet?: string }>> {
  try {
    const scope = resolveRepoScope();
    const branch = scope?.defaultBranch ?? "main";
    const rows = (await codebaseQueryService.searchCodebaseSemantically({
      query,
      branchName: branch,
      topK: 4,
      similarityThreshold: 0.75,
    })) as Array<{ file_path?: string; filePath?: string; similarity?: number; content?: string }>;
    return (rows ?? []).map((row) => ({
      filePath: row.file_path ?? row.filePath ?? "",
      similarity: row.similarity ?? 0,
      snippet: row.content?.slice(0, 200),
    }));
  } catch (err) {
    logger.warn({ err }, "duplicate codebase search skipped");
    return [];
  }
}

export async function runGate(id: GateId, input: GateInput): Promise<GateResult> {
  const withSearch: GateInput = {
    ...input,
    duplicateSearcher: input.duplicateSearcher ?? defaultDuplicateSearcher as DuplicateSearcher,
  };

  switch (id) {
    case "virin_discovery":
      return evaluateVirinDiscovery(withSearch);
    case "virin_prd":
      return evaluateVirinPrd(withSearch);
    case "prd":
      return evaluatePrdGate(withSearch);
    case "implementation":
      return evaluateImplementationGate(withSearch);
    case "qa":
      return evaluateQaGate(withSearch);
    default: {
      const exhaustive: never = id;
      throw new Error(`Unknown gate: ${exhaustive}`);
    }
  }
}
