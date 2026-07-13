import { runAgenticLoop } from "../agenticLoop/loop";
import { parseDiscoveryJson } from "../llm/discoveryCompletion";
import type { AgentOutput, ImplementationMode, ImplementationOutput, PrdOutput, QaOutput } from "../types/agents";
import type { RetrievedContext } from "../types/pipeline";
import { logger } from "../utils/logger";
import { executeQaToolCall } from "../tools/qaToolExecutor";
import { QA_TOOL_DEFINITIONS } from "../tools/qaToolDefinitions";
import {
  clearQaArtifacts,
  getQaArtifacts,
  setQaImplementationBranch,
} from "../qa/qaArtifactStore";
import type { QaExecutionReport } from "../qa/report/reportGenerator";
import { resolveImplementationBranchForQa } from "../qa/resolveImplementationBranch";
import { buildQaInitialUserMessage, resolveQaBranchName } from "./inputBuilder";
import { buildQaSystemPrompt } from "./systemPrompt";
import { enrichQaOutput } from "../qa/enrichQaOutput";

const INPUT_COST_PER_TOKEN = 0.000003;
const OUTPUT_COST_PER_TOKEN = 0.000015;
const MAX_QA_TOOL_CALLS = 20;

export interface QaAgentRunInput {
  pipelineId: string;
  jiraKey: string;
  prd: PrdOutput;
  implementation: ImplementationOutput;
  retrievedContext: RetrievedContext[];
  implementationMode?: ImplementationMode;
  /** Ananta push branch — when omitted, resolved from pipeline audit log. */
  implementationBranch?: string;
}

export interface QaAgentRunResult {
  agentOutput: AgentOutput<QaOutput>;
  executionReport?: QaExecutionReport;
  toolCallLog: Array<{
    tool: string;
    query: string;
    resultsFound: number;
  }>;
}

export async function runQaAgentic(
  input: QaAgentRunInput
): Promise<QaAgentRunResult> {
  const branchName = resolveQaBranchName(
    input.implementationBranch ??
      (await resolveImplementationBranchForQa(input.pipelineId, input.jiraKey)),
    input.jiraKey
  );
  const mode = input.implementationMode ?? input.implementation.implementationMode ?? "code";
  clearQaArtifacts(input.pipelineId);
  setQaImplementationBranch(input.pipelineId, branchName);

  try {
    const loop = await runAgenticLoop({
      systemPrompt: buildQaSystemPrompt(mode),
      initialUserMessage: buildQaInitialUserMessage({
        ...input,
        branchName,
      }),
      pipelineId: input.pipelineId,
      jiraKey: input.jiraKey,
      maxToolCalls: MAX_QA_TOOL_CALLS,
      tools: QA_TOOL_DEFINITIONS,
      executeToolCall: executeQaToolCall,
      forcedWrapUpMessage: `You have used the maximum number of QA tool calls. Produce the final JSON test plan now using everything gathered. Do not call more tools.`,
    });

    const artifacts = getQaArtifacts(input.pipelineId);

    // Mandatory QA OSS suite for every ticket (Semgrep, Playwright, Cover-Agent, Hypothesis)
    try {
      const { runQaOssAdapters } = await import("../integrations/runQaOssAdapters");
      const { sandboxManager } = await import("../qa/testing/sandboxManager");
      const handle = sandboxManager.create(`qa-oss-${Date.now()}`);
      try {
        await sandboxManager.cloneBranch(handle.sandboxDir, branchName);
        const changed = [
          ...(input.implementation.targetFiles ?? []),
          ...(input.implementation.codeChanges ?? []).map((c) => c.filePath),
        ].filter((p): p is string => Boolean(p));
        await runQaOssAdapters({
          cwd: handle.sandboxDir,
          pipelineId: input.pipelineId,
          changedFiles: [...new Set(changed)],
        });
      } finally {
        sandboxManager.destroy(handle.sandboxDir);
      }
    } catch (ossErr) {
      logger.warn(
        { err: ossErr instanceof Error ? ossErr.message : String(ossErr) },
        "mandatory QA OSS suite failed"
      );
    }

    const qaOutput = enrichQaOutput({
      qa: parseDiscoveryJson<QaOutput>(loop.finalResponse, "qaAgent"),
      prd: input.prd,
      implementation: input.implementation,
      executionReport: artifacts.executionReport
        ? {
            ...artifacts.executionReport,
            securityScan:
              artifacts.securityScan ?? artifacts.executionReport.securityScan,
            playwrightSmoke:
              artifacts.playwrightSmoke ?? artifacts.executionReport.playwrightSmoke,
            locatorHealProposals:
              artifacts.locatorHealProposals ??
              artifacts.executionReport.locatorHealProposals,
          }
        : artifacts.securityScan
          ? {
              generatedAt: new Date().toISOString(),
              summary: "Security scan only",
              overallRecommendation: "request_changes" as const,
              criteriaCoverage: { total: 0, covered: 0, uncovered: [] },
              securityScan: artifacts.securityScan,
              executionStatus: "unavailable" as const,
              executionMessage: "No test run — security scan only.",
            }
          : undefined,
      ticketText: `${input.jiraKey} ${input.prd.title} ${input.prd.problemStatement}`,
    });

    // Keep artifact report aligned with explainable confidence
    if (artifacts.executionReport) {
      artifacts.executionReport = {
        ...artifacts.executionReport,
        explainableConfidence: qaOutput.confidenceBreakdown
          ? {
              score: qaOutput.confidenceBreakdown.score,
              scorePercent: qaOutput.confidenceBreakdown.scorePercent,
              weights: {
                criteriaCoverage: 0.35,
                moduleRisk: 0.15,
                executionReliability: 0.25,
                failRate: 0.15,
                securityClean: 0.1,
              },
              components: {
                criteriaCoverage:
                  qaOutput.confidenceBreakdown.components.criteriaCoverage ?? 0,
                moduleRisk: qaOutput.confidenceBreakdown.components.moduleRisk ?? 0,
                executionReliability:
                  qaOutput.confidenceBreakdown.components.executionReliability ?? 0,
                failRate: qaOutput.confidenceBreakdown.components.failRate ?? 0,
                securityClean:
                  qaOutput.confidenceBreakdown.components.securityClean ?? 0,
              },
              breakdown: qaOutput.confidenceBreakdown.breakdown,
              reason: qaOutput.confidenceReason,
              testsNotExecuted: qaOutput.confidenceBreakdown.testsNotExecuted,
            }
          : artifacts.executionReport.explainableConfidence,
        gapMap: qaOutput.coverageGaps
          ? {
              gaps: qaOutput.coverageGaps.map((g) => ({
                id: g.id,
                criterion: g.criterion,
                severity: g.severity as "blocking" | "high" | "medium" | "low",
                reason: g.reason,
                suggestedTestType: g.suggestedTestType as
                  | "unit"
                  | "integration"
                  | "e2e"
                  | "security",
                relatedFiles: g.relatedFiles,
              })),
              edges: (qaOutput.traceability ?? []).map((e) => ({
                requirement: e.requirement,
                codePaths: e.codePaths,
                testIds: e.testIds,
                testFiles: e.testFiles,
                lastRunStatus: e.lastRunStatus as
                  | "passed"
                  | "failed"
                  | "skipped"
                  | "not_run"
                  | undefined,
              })),
              changedFiles: [],
              summary: `${qaOutput.coverageGaps.length} gap(s)`,
            }
          : artifacts.executionReport.gapMap,
      };
    }

    logger.info(
      {
        pipelineId: input.pipelineId,
        jiraKey: input.jiraKey,
        implementationBranch: branchName,
        toolCalls: loop.toolCallCount,
        testCases: qaOutput.testCases?.length ?? 0,
        recommendation: artifacts.executionReport?.overallRecommendation,
        confidence: qaOutput.confidenceScore,
        testsNotExecuted: qaOutput.confidenceBreakdown?.testsNotExecuted,
      },
      "QA agent completed"
    );

    return {
      agentOutput: {
        raw: loop.finalResponse,
        parsed: qaOutput,
        metadata: {
          inputTokens: loop.totalInputTokens,
          outputTokens: loop.totalOutputTokens,
          costUsd:
            loop.totalInputTokens * INPUT_COST_PER_TOKEN +
            loop.totalOutputTokens * OUTPUT_COST_PER_TOKEN,
          durationMs: 0,
        },
      },
      executionReport: artifacts.executionReport
        ? {
            ...artifacts.executionReport,
            securityScan:
              artifacts.securityScan ?? artifacts.executionReport.securityScan,
          }
        : artifacts.securityScan
          ? {
              generatedAt: new Date().toISOString(),
              summary: "Security scan only",
              overallRecommendation: "request_changes" as const,
              criteriaCoverage: { total: 0, covered: 0, uncovered: [] },
              securityScan: artifacts.securityScan,
              executionStatus: "unavailable" as const,
              executionMessage: "No test run — security scan only.",
            }
          : undefined,
      toolCallLog: loop.toolCallLog,
    };
  } finally {
    clearQaArtifacts(input.pipelineId);
  }
}
