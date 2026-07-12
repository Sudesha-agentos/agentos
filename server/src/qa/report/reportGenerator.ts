import type { TestRunResult } from "../testing/testRunner";
import type { SecurityScanResult } from "../testing/securityScanner";
import type { TriagedFailure } from "../triage/failureTriage";
import type { ExplainableConfidence } from "../confidence/explainableConfidence";
import type { GapMapResult } from "../gap/gapMapper";
import type { HealProposal } from "../healing/locatorHeal";
import type { PlaywrightSmokeResult } from "../testing/playwrightSmoke";

export type QaRecommendation =
  | "approve"
  | "approve_with_conditions"
  | "request_changes"
  | "block";

export interface FailureAnalysisItem {
  testId: string;
  testName: string;
  severity: "critical" | "high" | "medium" | "low";
  likelyCause: "implementation" | "test" | "environment" | "unknown";
  violatedCriterion?: string;
  remediation: string;
  triageClass?: string;
  triageConfidence?: number;
  evidence?: string[];
  requiresHumanOverride?: boolean;
}

export interface QaExecutionReport {
  generatedAt: string;
  summary: string;
  overallRecommendation: QaRecommendation;
  testRun?: TestRunResult;
  failureAnalysis?: FailureAnalysisItem[];
  coverage?: TestRunResult["coverage"];
  criteriaCoverage: {
    total: number;
    covered: number;
    uncovered: string[];
  };
  securityScan?: SecurityScanResult;
  /** First-class: did sandbox actually execute tests? */
  executionStatus: "ran" | "skipped" | "unavailable" | "error";
  executionMessage?: string;
  explainableConfidence?: ExplainableConfidence;
  gapMap?: GapMapResult;
  playwrightSmoke?: PlaywrightSmokeResult;
  locatorHealProposals?: HealProposal[];
  /** True when any failure needs human override before approve */
  requiresHumanOverride?: boolean;
}

export function generateQaReport(input: {
  testResults: TestRunResult | Record<string, unknown>;
  failureAnalysis?: { items?: FailureAnalysisItem[] | TriagedFailure[] };
  coverageData?: TestRunResult["coverage"];
  overallRecommendation: QaRecommendation;
  summary: string;
  acceptanceCriteria: string[];
  securityScan?: SecurityScanResult;
  explainableConfidence?: ExplainableConfidence;
  gapMap?: GapMapResult;
  playwrightSmoke?: PlaywrightSmokeResult;
  locatorHealProposals?: HealProposal[];
}): QaExecutionReport {
  const testRun = normalizeTestRun(input.testResults);
  const failureItems = (input.failureAnalysis?.items ?? []) as FailureAnalysisItem[];

  const covered = input.acceptanceCriteria.filter((criterion) =>
    failureItems.every((item) => item.violatedCriterion !== criterion)
  );

  let executionStatus: QaExecutionReport["executionStatus"] = "unavailable";
  let executionMessage: string | undefined;
  if (!testRun) {
    executionStatus = "unavailable";
    executionMessage = "No test run attached to report.";
  } else if (testRun.sandboxAvailable === false) {
    executionStatus = "unavailable";
    executionMessage =
      testRun.message ??
      "Sandbox test execution skipped (e.g. GITHUB_TOKEN not configured).";
  } else if (testRun.status === "error") {
    executionStatus = "error";
    executionMessage = testRun.message ?? "Test run errored.";
  } else if ((testRun.totalTests ?? 0) === 0) {
    executionStatus = "skipped";
    executionMessage = "Sandbox available but zero tests executed.";
  } else {
    executionStatus = "ran";
  }

  const requiresHumanOverride =
    failureItems.some((f) => f.requiresHumanOverride) ||
    executionStatus !== "ran" ||
    (input.locatorHealProposals?.some((h) => h.requiresHumanReview) ?? false);

  let recommendation = input.overallRecommendation;
  if (executionStatus !== "ran" && recommendation === "approve") {
    recommendation = "request_changes";
  }
  if (requiresHumanOverride && recommendation === "approve") {
    recommendation = "approve_with_conditions";
  }

  return {
    generatedAt: new Date().toISOString(),
    summary: input.summary,
    overallRecommendation: recommendation,
    testRun,
    failureAnalysis: failureItems,
    coverage: input.coverageData ?? testRun?.coverage,
    criteriaCoverage: {
      total: input.acceptanceCriteria.length,
      covered: covered.length,
      uncovered: input.acceptanceCriteria.filter((c) => !covered.includes(c)),
    },
    securityScan: input.securityScan,
    executionStatus,
    executionMessage,
    explainableConfidence: input.explainableConfidence,
    gapMap: input.gapMap,
    playwrightSmoke: input.playwrightSmoke,
    locatorHealProposals: input.locatorHealProposals,
    requiresHumanOverride,
  };
}

function normalizeTestRun(
  value: TestRunResult | Record<string, unknown>
): TestRunResult | undefined {
  if (!value || typeof value !== "object") return undefined;
  if ("runId" in value && "testResults" in value) {
    return value as TestRunResult;
  }
  return undefined;
}
