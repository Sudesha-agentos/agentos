import { prisma } from "../../db/client";
import { completionJson } from "../../llm/openaiCompletion";
import { logger } from "../../utils/logger";
import { loadPipelineCorrelationContext } from "../correlation/pipelineCorrelator";

type RootCauseResult = {
  rootCause: {
    category: string;
    description: string;
    specificLocation: string;
    confidenceScore: number;
  };
  evidence: string[];
  isSpecificationGap: boolean;
  isQaGap: boolean;
  remediationSteps: string[];
  immediateAction: string;
  preventionSteps: string[];
  estimatedFixTime: string;
  deploymentRisk: string;
};

const SYSTEM_PROMPT = `You are a senior site reliability engineer and software architect.
Analyse production errors and trace them back to root cause with precision.
Return ONLY valid JSON matching the schema provided.`;

export async function analyseErrorPattern(
  patternId: string
): Promise<RootCauseResult | null> {
  if (process.env.LOG_AI_ANALYSIS_ENABLED === "0") return null;

  const pattern = await prisma.errorPattern.findUnique({
    where: { id: patternId },
  });
  if (!pattern) return null;

  const sample = await prisma.logEntry.findFirst({
    where: {
      patternHash: pattern.patternHash,
      source: { organizationId: pattern.organizationId },
    },
    orderBy: { timestamp: "desc" },
  });

  const ctx = pattern.pipelineId
    ? await loadPipelineCorrelationContext(pattern.pipelineId)
    : null;

  const similar = await prisma.errorPattern.findMany({
    where: {
      organizationId: pattern.organizationId,
      errorType: pattern.errorType,
      id: { not: pattern.id },
      remediationSteps: { not: null },
    },
    take: 5,
    orderBy: { lastSeen: "desc" },
  });

  const userPrompt = `Analyse this production error and identify the root cause.

ERROR PATTERN:
Type: ${pattern.errorType}
Message template: ${pattern.messageTemplate}
First seen: ${pattern.firstSeen.toISOString()}
Occurrences: ${pattern.occurrenceCount}
Affected services: ${JSON.stringify(pattern.affectedServices)}
Affected endpoints: ${JSON.stringify(pattern.affectedEndpoints)}

STACK TRACE SAMPLE:
${sample?.stackTrace ?? "Not available"}

RECENT CODE CHANGES (from correlation):
Deployment: ${pattern.deploymentId ?? "Unknown"}
Created by pipeline: ${pattern.pipelineId ?? "Not from AgentOX pipeline"}
Jira ticket: ${pattern.jiraKey ?? "Unknown"}
Files changed: ${(ctx?.changedFiles ?? []).join(", ") || "Unknown"}

PRD ACCEPTANCE CRITERIA (if AgentOX pipeline):
${(ctx?.acceptanceCriteria ?? []).map((ac) => `- ${ac}`).join("\n") || "Not available"}

QA COVERAGE FOR THIS ERROR TYPE:
${ctx?.qaCoverageSummary ?? "Not tested"}
Is this a QA gap: ${pattern.isQaGap}

SIMILAR HISTORICAL PATTERNS:
${
  similar
    .map(
      (p) =>
        `- ${p.errorType}: ${(p.remediationSteps ?? "").slice(0, 100)}`
    )
    .join("\n") || "None found"
}

Return this JSON:
{
  "rootCause": {
    "category": "specification_gap | implementation_bug | qa_gap | infrastructure | dependency | unknown",
    "description": "Precise description of what caused this error",
    "specificLocation": "File path and function name if identifiable",
    "confidenceScore": 0.0
  },
  "evidence": ["Specific evidence item supporting this hypothesis"],
  "isSpecificationGap": false,
  "isQaGap": false,
  "remediationSteps": ["Specific, ordered step to fix this error"],
  "immediateAction": "What to do right now if this is critical",
  "preventionSteps": ["How to prevent this class of error in future pipeline runs"],
  "estimatedFixTime": "X hours | X days",
  "deploymentRisk": "low | medium | high"
}`;

  try {
    const { parsed } = await completionJson<RootCauseResult>({
      source: "logIntelligence.rootCause",
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
      maxTokens: 3000,
    });

    const remediation = [
      ...(parsed.remediationSteps ?? []),
      parsed.immediateAction
        ? `Immediate: ${parsed.immediateAction}`
        : null,
    ]
      .filter(Boolean)
      .join("\n");

    await prisma.errorPattern.update({
      where: { id: patternId },
      data: {
        rootCauseHypothesis: [
          parsed.rootCause?.description ?? "",
          parsed.rootCause?.specificLocation
            ? `Location: ${parsed.rootCause.specificLocation}`
            : "",
          parsed.rootCause?.category
            ? `Category: ${parsed.rootCause.category}`
            : "",
        ]
          .filter(Boolean)
          .join("\n"),
        confidenceScore: Number(parsed.rootCause?.confidenceScore ?? 0),
        remediationSteps: remediation,
        analysedAt: new Date(),
        isQaGap: pattern.isQaGap || Boolean(parsed.isQaGap),
        qaGapReason: parsed.isQaGap
          ? parsed.rootCause?.description?.slice(0, 500)
          : pattern.qaGapReason,
      },
    });

    return parsed;
  } catch (err) {
    logger.warn({ err, patternId }, "root cause analysis failed");
    return null;
  }
}

export async function runPendingRootCauseAnalysis(
  organizationId?: string
): Promise<number> {
  const pending = await prisma.errorPattern.findMany({
    where: {
      ...(organizationId ? { organizationId } : {}),
      analysedAt: null,
      status: "open",
      OR: [{ isQaGap: true }, { occurrenceCount: { gte: 3 } }],
    },
    orderBy: { lastSeen: "desc" },
    take: 10,
  });

  let n = 0;
  for (const p of pending) {
    const result = await analyseErrorPattern(p.id);
    if (result) n += 1;
  }
  return n;
}
