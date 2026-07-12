import {
  computeExplainableConfidence,
  estimateModuleRiskFromText,
} from "./confidence/explainableConfidence";
import {
  extractChangedFilesFromImplementation,
  mapCoverageGaps,
} from "./gap/gapMapper";
import type { ImplementationOutput, PrdOutput, QaOutput } from "../types/agents";
import type { QaExecutionReport } from "./report/reportGenerator";

/**
 * Post-process Neel JSON + execution artifacts into explainable confidence,
 * gap map, and traceability. Overwrites LLM confidenceScore when we have run data.
 */
export function enrichQaOutput(input: {
  qa: QaOutput;
  prd: PrdOutput;
  implementation: ImplementationOutput;
  executionReport?: QaExecutionReport;
  ticketText?: string;
}): QaOutput {
  const { qa, prd, implementation, executionReport } = input;
  const riskText = [
    input.ticketText ?? "",
    prd.title,
    prd.problemStatement,
    ...(prd.acceptanceCriteria ?? []),
    ...(qa.riskAreas ?? []),
  ].join("\n");

  const changedFiles = extractChangedFilesFromImplementation(implementation);
  const gapMap = mapCoverageGaps({
    acceptanceCriteria: prd.acceptanceCriteria,
    changedFiles,
    testCases: qa.testCases.map((tc) => ({
      id: tc.id,
      linkedCriterion: tc.linkedCriterion,
      type: tc.type,
      title: tc.title,
    })),
    riskHints: qa.riskAreas,
  });

  const testRun = executionReport?.testRun;
  const explainable = computeExplainableConfidence({
    criteriaCoveragePercent: qa.coverageReport.coveragePercent,
    moduleRisk: estimateModuleRiskFromText(riskText),
    sandboxAvailable: testRun?.sandboxAvailable ?? false,
    testRunStatus: testRun
      ? testRun.sandboxAvailable === false
        ? "error"
        : testRun.status
      : "skipped",
    totalTests: testRun?.totalTests ?? 0,
    failedTests: testRun?.failed ?? 0,
    securityCriticalCount: executionReport?.securityScan?.criticalCount ?? 0,
    securityHighCount: executionReport?.securityScan?.highCount ?? 0,
  });

  return {
    ...qa,
    confidenceScore: explainable.score,
    confidenceReason: explainable.reason,
    confidenceBreakdown: {
      score: explainable.score,
      scorePercent: explainable.scorePercent,
      components: {
        criteriaCoverage: explainable.components.criteriaCoverage,
        moduleRisk: explainable.components.moduleRisk,
        executionReliability: explainable.components.executionReliability,
        failRate: explainable.components.failRate,
        securityClean: explainable.components.securityClean,
      },
      breakdown: explainable.breakdown,
      testsNotExecuted: explainable.testsNotExecuted,
    },
    coverageGaps: gapMap.gaps,
    traceability: gapMap.edges,
    playwrightSmoke: executionReport?.playwrightSmoke
      ? {
          attempted: executionReport.playwrightSmoke.attempted,
          skipped: executionReport.playwrightSmoke.skipped,
          skipReason: executionReport.playwrightSmoke.skipReason,
          passed: executionReport.playwrightSmoke.passed,
        }
      : qa.playwrightSmoke,
    locatorHealProposals:
      executionReport?.locatorHealProposals?.map((h) => ({
        testFile: h.testFile,
        testName: h.testName,
        oldPrimary: h.oldPrimary,
        proposedPrimary: h.proposedPrimary,
        confidence: h.confidence,
        requiresHumanReview: h.requiresHumanReview,
        rationale: h.rationale,
      })) ?? qa.locatorHealProposals,
  };
}
