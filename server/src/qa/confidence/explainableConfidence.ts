/**
 * Explainable QA / release-confidence score for AgentOX ticket pipelines.
 * Components are shown in the UI — not a black-box LLM number.
 *
 * confidence = w1·criteriaCoverage
 *            + w2·(1 − riskOfTouched)
 *            + w3·executionReliability  (0 if tests never ran)
 *            + w4·(1 − flakeOrFailRate)
 *            + w5·securityClean
 */

export interface ConfidenceComponents {
  /** 0–1 share of PRD acceptance criteria with linked tests */
  criteriaCoverage: number;
  /** 0–1 risk of touched modules (higher = worse) */
  moduleRisk: number;
  /** 0–1: 1 if sandbox ran successfully, 0 if skipped/unavailable */
  executionReliability: number;
  /** 0–1 fail/flake rate among executed tests */
  failRate: number;
  /** 0–1: 1 if no critical/high security findings */
  securityClean: number;
}

export interface ExplainableConfidence {
  /** Composite 0–1 */
  score: number;
  /** 0–100 for display */
  scorePercent: number;
  weights: {
    criteriaCoverage: number;
    moduleRisk: number;
    executionReliability: number;
    failRate: number;
    securityClean: number;
  };
  components: ConfidenceComponents;
  /** Human-readable why this score */
  breakdown: Array<{ id: string; label: string; value: number; weight: number; contribution: number }>;
  reason: string;
  /** Hard gate: tests were not executed in sandbox */
  testsNotExecuted: boolean;
}

const DEFAULT_WEIGHTS = {
  criteriaCoverage: 0.35,
  moduleRisk: 0.15,
  executionReliability: 0.25,
  failRate: 0.15,
  securityClean: 0.1,
} as const;

export interface ExplainableConfidenceInput {
  criteriaCoveragePercent: number;
  /** 0–1 estimated risk from strategic/security tags or history */
  moduleRisk?: number;
  sandboxAvailable: boolean;
  testRunStatus?: "completed" | "timeout" | "error" | "skipped";
  totalTests?: number;
  failedTests?: number;
  securityCriticalCount?: number;
  securityHighCount?: number;
  weights?: Partial<typeof DEFAULT_WEIGHTS>;
}

export function computeExplainableConfidence(
  input: ExplainableConfidenceInput
): ExplainableConfidence {
  const weights = { ...DEFAULT_WEIGHTS, ...input.weights };

  const criteriaCoverage = clamp01((input.criteriaCoveragePercent ?? 0) / 100);
  const moduleRisk = clamp01(input.moduleRisk ?? 0.35);

  const ran =
    input.sandboxAvailable &&
    input.testRunStatus === "completed" &&
    (input.totalTests ?? 0) > 0;
  const testsNotExecuted = !ran;
  const executionReliability = ran ? 1 : 0;

  const total = Math.max(0, input.totalTests ?? 0);
  const failed = Math.max(0, input.failedTests ?? 0);
  const failRate = total > 0 ? clamp01(failed / total) : ran ? 0 : 1;

  const critical = input.securityCriticalCount ?? 0;
  const high = input.securityHighCount ?? 0;
  const securityClean = critical + high > 0 ? 0 : 1;

  const components: ConfidenceComponents = {
    criteriaCoverage,
    moduleRisk,
    executionReliability,
    failRate,
    securityClean,
  };

  const contrib = {
    criteriaCoverage: weights.criteriaCoverage * criteriaCoverage,
    moduleRisk: weights.moduleRisk * (1 - moduleRisk),
    executionReliability: weights.executionReliability * executionReliability,
    failRate: weights.failRate * (1 - failRate),
    securityClean: weights.securityClean * securityClean,
  };

  let score =
    contrib.criteriaCoverage +
    contrib.moduleRisk +
    contrib.executionReliability +
    contrib.failRate +
    contrib.securityClean;

  // Hard floor when tests never ran — cannot claim ship confidence.
  if (testsNotExecuted) {
    score = Math.min(score, 0.45);
  }

  score = clamp01(score);

  const breakdown = [
    {
      id: "criteriaCoverage",
      label: "Acceptance criteria coverage",
      value: criteriaCoverage,
      weight: weights.criteriaCoverage,
      contribution: contrib.criteriaCoverage,
    },
    {
      id: "moduleRisk",
      label: "Touched-module risk (inverted)",
      value: 1 - moduleRisk,
      weight: weights.moduleRisk,
      contribution: contrib.moduleRisk,
    },
    {
      id: "executionReliability",
      label: "Sandbox test execution",
      value: executionReliability,
      weight: weights.executionReliability,
      contribution: contrib.executionReliability,
    },
    {
      id: "failRate",
      label: "Pass rate of executed tests",
      value: 1 - failRate,
      weight: weights.failRate,
      contribution: contrib.failRate,
    },
    {
      id: "securityClean",
      label: "Security scan clean",
      value: securityClean,
      weight: weights.securityClean,
      contribution: contrib.securityClean,
    },
  ];

  const reasonParts = [
    `Criteria ${(criteriaCoverage * 100).toFixed(0)}%`,
    testsNotExecuted
      ? "tests not executed in sandbox"
      : `pass rate ${((1 - failRate) * 100).toFixed(0)}%`,
    securityClean ? "security clean" : "security findings present",
    `module risk ${(moduleRisk * 100).toFixed(0)}%`,
  ];

  return {
    score: Number(score.toFixed(3)),
    scorePercent: Math.round(score * 100),
    weights,
    components,
    breakdown,
    reason: `Explainable confidence ${Math.round(score * 100)}/100 — ${reasonParts.join("; ")}.`,
    testsNotExecuted,
  };
}

/** Heuristic module risk from ticket/PRD text (strategic / auth / billing). */
export function estimateModuleRiskFromText(text: string): number {
  const t = text.toLowerCase();
  let risk = 0.25;
  if (/auth|sso|oauth|permission|rbac|security|crypto/.test(t)) risk += 0.25;
  if (/billing|payment|invoice|stripe|revenue/.test(t)) risk += 0.2;
  if (/migrat|schema|database|postgres|prisma/.test(t)) risk += 0.15;
  if (/public.?api|webhook|tenant/.test(t)) risk += 0.1;
  return clamp01(risk);
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}
