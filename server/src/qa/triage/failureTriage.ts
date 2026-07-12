import type { FailureAnalysisItem } from "../report/reportGenerator";

export type FailureTriageClass =
  | "real_bug"
  | "flake"
  | "environment"
  | "stale_test"
  | "unknown";

export interface TriagedFailure extends FailureAnalysisItem {
  triageClass: FailureTriageClass;
  triageConfidence: number;
  evidence: string[];
  requiresHumanOverride: boolean;
}

const FLAKE_PATTERNS =
  /flaky|intermittent|occasionally|race condition|timing|retry|order.?dependent/i;
const ENV_PATTERNS =
  /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|sandbox|GITHUB_TOKEN|ENOENT|EPERM|connection refused|network/i;
const STALE_TEST_PATTERNS =
  /locator|selector|getByRole|getByText|querySelector|element not found|strict mode violation|waiting for/i;
const ASSERT_PATTERNS = /expect|assert|toBe|toEqual|toThrow|AssertionError/i;
const IMPL_PATTERNS =
  /TypeError|ReferenceError|Cannot read|undefined is not|null is not|500|Internal Server/i;

/**
 * Classify a single test failure for human review.
 * Low-confidence triage always requires human override.
 */
export function triageFailure(
  failure: Record<string, unknown>,
  criteria: string[],
  index: number
): TriagedFailure {
  const message = String(failure.error_message ?? failure.message ?? "");
  const testName = String(failure.test_name ?? failure.name ?? `failure-${index + 1}`);
  const testId = String(failure.test_id ?? failure.id ?? `TC-FAIL-${index + 1}`);
  const retries = Number(failure.retries ?? failure.retryCount ?? 0);
  const evidence: string[] = [];

  let triageClass: FailureTriageClass = "unknown";
  let triageConfidence = 0.4;

  if (STALE_TEST_PATTERNS.test(message) && !IMPL_PATTERNS.test(message)) {
    triageClass = "stale_test";
    triageConfidence = 0.75;
    evidence.push("Locator / UI drift pattern — test may be stale");
  } else if (ENV_PATTERNS.test(message) || /sandbox unavailable|GITHUB_TOKEN/i.test(message)) {
    triageClass = "environment";
    triageConfidence = 0.85;
    evidence.push("Environment / connectivity pattern in error");
  } else if (retries >= 2 || FLAKE_PATTERNS.test(message)) {
    triageClass = "flake";
    triageConfidence = retries >= 2 ? 0.8 : 0.65;
    evidence.push(retries >= 2 ? `Failed after ${retries} retries` : "Flake language in error");
  } else if (IMPL_PATTERNS.test(message) && !ASSERT_PATTERNS.test(message)) {
    triageClass = "real_bug";
    triageConfidence = 0.8;
    evidence.push("Runtime error suggests implementation defect");
  } else if (ASSERT_PATTERNS.test(message)) {
    // Assertion failures are ambiguous — lean bug but lower confidence
    triageClass = "real_bug";
    triageConfidence = 0.55;
    evidence.push("Assertion failure — could be bug or wrong expectation");
  } else if (!message) {
    triageClass = "unknown";
    triageConfidence = 0.3;
    evidence.push("No error message provided");
  } else {
    triageClass = "real_bug";
    triageConfidence = 0.5;
    evidence.push("Defaulted to real_bug pending human review");
  }

  const severity: FailureAnalysisItem["severity"] =
    /auth|security|permission|injection|xss|csrf/i.test(message)
      ? "critical"
      : triageClass === "real_bug"
        ? "high"
        : triageClass === "environment"
          ? "medium"
          : "low";

  const likelyCause: FailureAnalysisItem["likelyCause"] =
    triageClass === "environment"
      ? "environment"
      : triageClass === "stale_test" || triageClass === "flake"
        ? "test"
        : triageClass === "real_bug"
          ? "implementation"
          : "unknown";

  const violatedCriterion =
    criteria.find((criterion) =>
      message.toLowerCase().includes(criterion.toLowerCase().slice(0, 24))
    ) ?? criteria[0];

  const remediation =
    triageClass === "flake"
      ? "Stabilize timing/waits or quarantine as flake; do not merge on flake alone without override."
      : triageClass === "environment"
        ? "Verify GITHUB_TOKEN, sandbox, services, and env vars — re-run after fix."
        : triageClass === "stale_test"
          ? "Update selectors/fixtures (or apply locator heal) to match current UI."
          : triageClass === "real_bug"
            ? "Fix implementation against the linked acceptance criterion."
            : "Needs human triage — insufficient signal to auto-classify.";

  return {
    testId,
    testName,
    severity,
    likelyCause,
    violatedCriterion,
    remediation,
    triageClass,
    triageConfidence,
    evidence,
    requiresHumanOverride: triageConfidence < 0.7 || triageClass === "unknown",
  };
}

export function analyseFailuresBatch(
  failures: Array<Record<string, unknown>>,
  criteria: string[]
): TriagedFailure[] {
  return failures.map((f, i) => triageFailure(f, criteria, i));
}
