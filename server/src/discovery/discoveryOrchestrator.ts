import { auditRepo } from "../db/repositories/auditRepo";
import { mergeUsage, type LlmUsage } from "../llm/discoveryCompletion";
import { attachPRDToJira } from "../prd/prdAttacher";
import { generatePRD, type GeneratedPRD } from "../prd/prdGenerator";
import { generatedPrdToPrdOutput } from "../prd/toPrdOutput";
import { embedder } from "../rag/embedder";
import { unifiedRetriever } from "../rag/unifiedRetriever";
import type { PrdOutput } from "../types/agents";
import type { RetrievedContext } from "../types/pipeline";
import type { NormalizedTicket } from "../types/ticket";
import { logger } from "../utils/logger";
import { stateManager } from "../pipeline/stateManager";
import { scoreComplexity, type ComplexityAssessment } from "./complexityScorer";
import { analyseGaps, type GapAnalysis } from "./gapAnalyser";
import {
  extractHistoricalIntelligence,
  type HistoricalIntelligence,
} from "./historicalIntelligence";
import { analyseTicket, type TicketAnalysis } from "./ticketAnalyser";
import {
  applyComputedScores,
  runProductValidation,
  type ComputedDiscoveryScores,
} from "./scoring";
import {
  buildPersistedRetrievalContext,
  answersCoverAllQuestions,
  formatHumanAnswersJson,
  type DiscoveryPauseSnapshot,
  type DiscoveryQuestion,
  type HumanDiscoveryAnswer,
  type PersistedContextItem,
} from "./persistedContext";

const BLOCKING_GAP_THRESHOLD = Number(
  process.env.DISCOVERY_BLOCKING_GAP_THRESHOLD ?? "2"
);
const PAUSE_ON_AMBIGUITIES =
  process.env.DISCOVERY_PAUSE_ON_AMBIGUITIES !== "false";

export interface DiscoveryResult {
  ticketAnalysis: TicketAnalysis;
  historicalIntelligence: HistoricalIntelligence;
  gapAnalysis: GapAnalysis;
  complexityAssessment: ComplexityAssessment;
  prd: GeneratedPRD;
  prdOutput: PrdOutput;
  scores: ComputedDiscoveryScores;
  toolCallLog: Array<{
    tool: string;
    query: string;
    resultsFound: number;
  }>;
  retrievalContext: PersistedContextItem[];
  totalTokensUsed: number;
  inputTokens: number;
  outputTokens: number;
  totalCostUsd: number;
  durationMs: number;
}

export class DiscoveryPausedError extends Error {
  constructor(
    message: string,
    public readonly blockingGaps: number,
    public readonly snapshot?: DiscoveryPauseSnapshot
  ) {
    super(message);
    this.name = "DiscoveryPausedError";
  }
}

function buildDiscoveryQuestions(
  ticketAnalysis: TicketAnalysis
): DiscoveryQuestion[] {
  return (ticketAnalysis.ambiguities ?? [])
    .filter((a) => a.impact === "blocking" || a.impact === "high")
    .map((a) => ({
      question: a.question,
      description: a.description,
      impact: a.impact,
    }));
}

async function emitDiscoveryLog(pipelineId: string, label: string, detail?: string): Promise<void> {
  const { isSimPipelineId, emitSimEvent } = await import("../simTesting/hub");
  if (!isSimPipelineId(pipelineId)) return;
  emitSimEvent(pipelineId, { agent: "virin", kind: "log", label, detail });
}

async function pauseDiscovery(
  pipelineId: string,
  message: string,
  blockingGaps: number,
  snapshot: DiscoveryPauseSnapshot,
  usages: LlmUsage[]
): Promise<never> {
  const { isSimPipelineId } = await import("../simTesting/hub");
  if (!isSimPipelineId(pipelineId)) {
    await stateManager.pauseForHuman(pipelineId, "PRODUCT_AGENT", message);
  }
  throw new DiscoveryPausedError(message, blockingGaps, {
    ...snapshot,
    usageSoFar: mergeUsage(usages),
  });
}

async function retrieveDiscoveryContext(
  ticket: NormalizedTicket,
  humanAnswers?: HumanDiscoveryAnswer[]
) {
  const scope = await import("../codebaseIntelligence/repoScope").then((m) =>
    m.resolveRepoScope()
  );
  const answersJson = formatHumanAnswersJson(humanAnswers);
  const unifiedQuery = [ticket.summary, ticket.description, answersJson].filter(Boolean).join("\n");
  const unified = await unifiedRetriever.retrieveUnified(unifiedQuery, {
    ticketTypes: ["ticket", "prd", "implementation", "qa_report", "canary_finding"],
    codebase: { branchName: scope?.defaultBranch ?? "main", topK: 8 },
    includeCodebase: Boolean(scope),
    topKTotal: 12,
    currentJiraKey: ticket.jiraKey,
    queryComponents: ticket.components ?? [],
    similarityThreshold: 0.7,
  });
  return {
    historicalContext: unified.retrievedContext ?? [],
    fusedBlock: unified.fusedBlock,
    retrievalContext: buildPersistedRetrievalContext(unified),
    codebaseHits: (unified.items ?? []).filter((i) => i.kind === "codebase").length,
  };
}

export async function runDiscovery(
  ticket: NormalizedTicket,
  pipelineId: string,
  options?: {
    skipHumanPause?: boolean;
    resume?: DiscoveryPauseSnapshot;
    humanAnswers?: HumanDiscoveryAnswer[];
  }
): Promise<DiscoveryResult> {
  const startTime = Date.now();
  const usages: LlmUsage[] = [];
  if (options?.resume?.usageSoFar) usages.push(options.resume.usageSoFar);
  const humanAnswers = options?.humanAnswers ?? ticket.humanAnswers ?? [];

  logger.info({ jiraKey: ticket.jiraKey, pipelineId }, "discovery started");
  await auditRepo.log(pipelineId, "PRODUCT_AGENT_STARTED", { jiraKey: ticket.jiraKey });

  let ticketAnalysis = options?.resume?.ticketAnalysis;
  let historicalIntelligence = options?.resume?.historicalIntelligence;
  let gapAnalysis = options?.resume?.gapAnalysis;
  let retrievalContext = options?.resume?.retrievalContext ?? [];
  let historicalContext: RetrievedContext[] = [];
  let fusedBlock: string | undefined;

  if (!ticketAnalysis) {
    await auditRepo.log(pipelineId, "DISCOVERY_STEP_STARTED", {
      step: "context_retrieval",
      label: "Retrieving similar tickets and codebase context",
    });
    await emitDiscoveryLog(pipelineId, "Retrieving context");
    const retrieved = await retrieveDiscoveryContext(ticket, humanAnswers);
    historicalContext = retrieved.historicalContext;
    fusedBlock = retrieved.fusedBlock;
    retrievalContext = retrieved.retrievalContext;
    await auditRepo.log(pipelineId, "CONTEXT_RETRIEVED", {
      chunksFound: historicalContext.length,
      codebaseHits: retrieved.codebaseHits,
      topSimilarity: historicalContext[0]?.similarity ?? 0,
    });

    await auditRepo.log(pipelineId, "DISCOVERY_STEP_STARTED", {
      step: "ticket_analysis",
      label: "Analyzing ticket requirements",
    });
    await emitDiscoveryLog(pipelineId, "Analyzing ticket — this generates the questions");
    const { analysis, usage: u1 } = await analyseTicket(ticket, pipelineId);
    ticketAnalysis = analysis;
    usages.push(u1);
    await auditRepo.log(pipelineId, "TICKET_ANALYSED", {
      requirementsFound: ticketAnalysis.atomicRequirements.length,
      ambiguities: ticketAnalysis.ambiguities.length,
    });
  }

  const discoveryQuestions =
    options?.resume?.discoveryQuestions ?? buildDiscoveryQuestions(ticketAnalysis);
  const answersReady = answersCoverAllQuestions(discoveryQuestions, humanAnswers);

  if (ticketAnalysis && options?.resume && answersReady && humanAnswers.length) {
    await emitDiscoveryLog(
      pipelineId,
      "Resuming — sending answers JSON into codebase analysis",
      formatHumanAnswersJson(humanAnswers)
    );
    await auditRepo.log(pipelineId, "DISCOVERY_STEP_STARTED", {
      step: "context_retrieval",
      label: "Re-retrieving codebase context with human answers",
    });
    const retrieved = await retrieveDiscoveryContext(ticket, humanAnswers);
    historicalContext = retrieved.historicalContext;
    fusedBlock = retrieved.fusedBlock;
    retrievalContext = retrieved.retrievalContext;
    historicalIntelligence = undefined;
    gapAnalysis = undefined;
  } else if (ticketAnalysis && options?.resume && !answersReady) {
    await emitDiscoveryLog(pipelineId, "Waiting — not all questions are answered yet");
  }

  if (PAUSE_ON_AMBIGUITIES && discoveryQuestions.length > 0 && !answersReady) {
    await pauseDiscovery(
      pipelineId,
      `Discovery needs clarification (${discoveryQuestions.length} question${discoveryQuestions.length === 1 ? "" : "s"}).`,
      discoveryQuestions.length,
      {
        ticketAnalysis,
        retrievalContext,
        discoveryQuestions,
        pauseReason: "ambiguities",
      },
      usages
    );
  }

  if (!historicalIntelligence) {
    await auditRepo.log(pipelineId, "DISCOVERY_STEP_STARTED", {
      step: "historical_intelligence",
      label: "Extracting historical patterns and precedents",
    });
    await emitDiscoveryLog(
      pipelineId,
      humanAnswers.length ? "Codebase analysis with answers JSON" : "Extracting historical patterns"
    );
    const { intelligence, usage: u2 } = await extractHistoricalIntelligence(
      ticketAnalysis,
      historicalContext,
      pipelineId,
      fusedBlock,
      humanAnswers
    );
    historicalIntelligence = intelligence;
    usages.push(u2);
    await auditRepo.log(pipelineId, "INTELLIGENCE_EXTRACTED", {
      patterns: historicalIntelligence.successPatterns.length,
      failures: historicalIntelligence.knownFailures.length,
      implied: historicalIntelligence.impliedRequirements.length,
    });
  }

  if (!gapAnalysis) {
    await auditRepo.log(pipelineId, "DISCOVERY_STEP_STARTED", {
      step: "gap_analysis",
      label: "Identifying requirement gaps",
    });
    await emitDiscoveryLog(pipelineId, "Identifying requirement gaps");
    const { analysis, usage: u3 } = await analyseGaps(
      ticketAnalysis,
      historicalIntelligence,
      pipelineId,
      humanAnswers
    );
    gapAnalysis = analysis;
    usages.push(u3);
    await auditRepo.log(pipelineId, "GAPS_ANALYSED", {
      totalGaps: gapAnalysis.totalGaps,
      blockingGaps: gapAnalysis.blockingGaps,
      readiness: gapAnalysis.readinessForPRD,
    });
  }

  if (
    !options?.skipHumanPause &&
    gapAnalysis.readinessForPRD === "needs-clarification" &&
    gapAnalysis.blockingGaps > 0
  ) {
    await pauseDiscovery(
      pipelineId,
      `PRD needs clarification (${gapAnalysis.blockingGaps} blocking gap${gapAnalysis.blockingGaps === 1 ? "" : "s"}).`,
      gapAnalysis.blockingGaps,
      {
        ticketAnalysis,
        historicalIntelligence,
        gapAnalysis,
        retrievalContext,
        pauseReason: "needs_clarification",
      },
      usages
    );
  }

  if (!options?.skipHumanPause && gapAnalysis.blockingGaps > BLOCKING_GAP_THRESHOLD) {
    await pauseDiscovery(
      pipelineId,
      `Too many blocking gaps (${gapAnalysis.blockingGaps}). Human clarification required.`,
      gapAnalysis.blockingGaps,
      {
        ticketAnalysis,
        historicalIntelligence,
        gapAnalysis,
        retrievalContext,
        pauseReason: "blocking_gaps",
      },
      usages
    );
  }

  if (!ticketAnalysis || !historicalIntelligence || !gapAnalysis) {
    throw new Error("Discovery is missing ticket analysis, history, or gaps");
  }

  await auditRepo.log(pipelineId, "DISCOVERY_STEP_STARTED", {
    step: "complexity_scoring",
    label: "Scoring implementation complexity",
  });
  await emitDiscoveryLog(pipelineId, "Scoring complexity");
  const { assessment: complexityAssessment, usage: u4 } = await scoreComplexity(
    ticketAnalysis,
    historicalIntelligence,
    gapAnalysis,
    pipelineId,
    humanAnswers
  );
  usages.push(u4);
  await auditRepo.log(pipelineId, "COMPLEXITY_SCORED", {
    score: complexityAssessment.overallScore,
    realisticHours: complexityAssessment.effortEstimate.realistic,
    priority: complexityAssessment.priorityAssessment.recommendedPriority,
  });

  await auditRepo.log(pipelineId, "DISCOVERY_STEP_STARTED", {
    step: "prd_generation",
    label: "Virin is drafting the PRD",
  });
  await emitDiscoveryLog(pipelineId, "Drafting the PRD");
  const { prd, usage: u5, toolCallLog } = await generatePRD(
    ticket,
    ticketAnalysis,
    historicalIntelligence,
    gapAnalysis,
    complexityAssessment,
    pipelineId,
    humanAnswers
  );
  usages.push(u5);

  const scores = runProductValidation({
    ticketAnalysis,
    historicalIntelligence,
    gapAnalysis,
    complexityAssessment,
    prd,
    retrievedContext: historicalContext,
  });
  applyComputedScores(scores, {
    ticketAnalysis,
    historicalIntelligence,
    gapAnalysis,
    complexityAssessment,
    prd,
  });

  await auditRepo.log(pipelineId, "PRD_GENERATED", {
    userStories: prd.userStories?.length ?? 0,
    endpoints: prd.technicalRequirements?.endpoints?.length ?? 0,
    toolCalls: toolCallLog.length,
  });
  await auditRepo.log(pipelineId, "SCORES_COMPUTED", {
    understandingScore: scores.understandingScore,
    prdQualityScore: scores.prdQualityScore,
    prdQualityBand: `${scores.bands.prdQuality.low}-${scores.bands.prdQuality.high}`,
    historicalSignalScore: scores.historicalSignalScore,
    complexityScore: scores.complexityScore,
    passesGate: scores.passesGate,
    recommendation: scores.recommendation,
    gateFailureReasons: scores.gateFailureReasons,
  });

  try {
    await attachPRDToJira(ticket.jiraKey, prd);
  } catch (err) {
    logger.warn({ err, jiraKey: ticket.jiraKey }, "PRD Jira attach failed — continuing pipeline");
  }

  const prdOutput = generatedPrdToPrdOutput(prd, scores);
  try {
    await embedder.embedPRD(ticket.jiraTicketId, ticket.jiraKey, prdOutput);
  } catch (err) {
    logger.warn({ err, jiraKey: ticket.jiraKey }, "PRD embed failed — continuing pipeline");
  }

  const merged = mergeUsage(usages);
  const durationMs = Date.now() - startTime;

  await auditRepo.log(pipelineId, "DISCOVERY_COMPLETE", {
    jiraKey: ticket.jiraKey,
    durationMs,
    totalTokens: merged.inputTokens + merged.outputTokens,
    totalCost: merged.costUsd,
  });

  logger.info(
    {
      jiraKey: ticket.jiraKey,
      pipelineId,
      durationMs,
      prdQualityScore: scores.prdQualityScore,
      understandingScore: scores.understandingScore,
    },
    "discovery complete"
  );

  return {
    ticketAnalysis,
    historicalIntelligence,
    gapAnalysis,
    complexityAssessment,
    prd,
    prdOutput,
    scores,
    toolCallLog,
    retrievalContext,
    totalTokensUsed: merged.inputTokens + merged.outputTokens,
    inputTokens: merged.inputTokens,
    outputTokens: merged.outputTokens,
    totalCostUsd: merged.costUsd,
    durationMs,
  };
}
