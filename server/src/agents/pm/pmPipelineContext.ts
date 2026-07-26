import type { GeneratedPRD } from "../../prd/prdGenerator";
import { generatedPrdToPrdOutput } from "../../prd/toPrdOutput";
import type { PrdOutput } from "../../types/agents";
import {
  attachCodeSnapshots,
  buildTechAgentHandoffFromRecord,
  fetchRecentCommitHistory,
} from "./handoff";
import type { PmAnalysisRecord } from "./types";
import { logger } from "../../utils/logger";

export interface PmPipelineContext {
  source: "pm_agents";
  jiraKey: string;
  generatedPrd: GeneratedPRD;
  prdOutput: PrdOutput;
  enrichedPrdDocument: Record<string, unknown>;
}

/**
 * Build PM → engineering pipeline context.
 * Attaches primary-file code snapshots and recent commit history when GitHub is available
 * (same enrichment the UI handoff path used to get exclusively).
 */
export async function buildPmPipelineContext(
  record: PmAnalysisRecord
): Promise<PmPipelineContext> {
  if (!record.generatedPrd) {
    throw new Error(`PM PRD not generated for ${record.jiraKey}`);
  }

  const prdOutput = generatedPrdToPrdOutput(record.generatedPrd);

  let pmHandoff = buildTechAgentHandoffFromRecord(record);
  try {
    const paths = pmHandoff.affectedFiles.map((f) => f.path);
    const [withSnapshots, recentCommitHistory] = await Promise.all([
      attachCodeSnapshots(pmHandoff),
      fetchRecentCommitHistory(paths, pmHandoff.branchName),
    ]);
    pmHandoff = {
      ...withSnapshots,
      recentCommitHistory,
    };
  } catch (err) {
    logger.warn(
      {
        jiraKey: record.jiraKey,
        err: err instanceof Error ? err.message : String(err),
      },
      "PM pipeline handoff enrichment (snapshots/commits) failed — continuing without"
    );
  }

  return {
    source: "pm_agents",
    jiraKey: record.jiraKey,
    generatedPrd: record.generatedPrd,
    prdOutput,
    enrichedPrdDocument: {
      source: "pm_agents",
      prdOutput,
      generatedPrd: record.generatedPrd,
      pmEnrichment: record.enrichment,
      pmClassification: record.classification,
      pmCodebaseImpact: record.codebaseImpact,
      pmCodebaseAnalysis: record.codebaseAnalysis ?? null,
      pmEffort: record.effortEstimate,
      pmImplementation: record.implementation,
      pmAcceptanceCriteria: record.acceptanceCriteria,
      pmPrioritization: record.prioritization,
      pmHandoff,
      pmSystemDesign: record.systemDesign ?? null,
      pmTaskBreakdown: record.taskBreakdown ?? null,
      synthesisSummary: record.synthesisSummary ?? {
        historicalCoverage: 0,
        reusedPatterns: [],
        knownFailures: [],
        impliedRequirements: [],
        blockingGaps: 0,
      },
      scores: { prdQualityScore: record.generatedPrd.prdConfidence },
    },
  };
}
