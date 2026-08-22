import { validateQa } from "../../validators/qaValidator";
import {
  evaluateSecurityGate,
  mergeSecurityGateIntoValidation,
} from "../../validators/securityGate";
import { finalizeGateResult, mergeValidation } from "../result";
import type { GateInput } from "../input";
import type { GateResult } from "../../types/pipeline";

export function evaluateQaGate(input: GateInput): GateResult {
  const qa = input.qa;
  const prd = input.prd;
  if (!qa || !prd) {
    return finalizeGateResult({
      gateId: "qa",
      issues: [
        {
          code: "MISSING_QA",
          severity: "error",
          message: "QA output or PRD is missing.",
        },
      ],
    });
  }

  let result = validateQa(qa, prd, {
    executionReport: input.qaExecutionReport,
  });

  const report = input.qaExecutionReport;
  const executionStatus = report?.executionStatus ?? null;
  if (
    executionStatus !== "ran" &&
    !result.issues.some((i) => i.code === "TESTS_NOT_EXECUTED")
  ) {
    result = mergeValidation(result, {
      issues: [
        {
          code: "TESTS_NOT_EXECUTED",
          severity: "error",
          message: executionStatus
            ? `Sandbox tests were not executed (status: ${executionStatus}) — cannot approve on plan-only confidence.`
            : "QA execution report missing — cannot verify tests ran; human review required.",
        },
      ],
    });
  }

  const failed = report?.testRun?.failed ?? 0;
  if (
    failed > 0 &&
    !result.issues.some((i) => i.code === "TESTS_FAILED")
  ) {
    result = mergeValidation(result, {
      issues: [
        {
          code: "TESTS_FAILED",
          severity: "error",
          message: `${failed} sandbox test(s) failed — QA gate cannot pass.`,
        },
      ],
    });
  }

  const recommendation = report?.overallRecommendation;
  if (
    (recommendation === "block" || recommendation === "request_changes") &&
    !result.issues.some((i) => i.code === "QA_RECOMMENDATION")
  ) {
    result = mergeValidation(result, {
      issues: [
        {
          code: "QA_RECOMMENDATION",
          severity: "error",
          message: `QA recommendation is "${recommendation}" — human review required.`,
        },
      ],
    });
  }

  const security = evaluateSecurityGate({
    securityScan: report?.securityScan ?? null,
    canaryCriticals: input.canaryCriticals,
    canarySkipped: input.canarySkipped,
    canarySkipReason: input.canarySkipReason,
    qaOutput: qa,
    ticketText: input.ticketText,
  });
  result = mergeSecurityGateIntoValidation(result, security);

  return finalizeGateResult({
    gateId: "qa",
    issues: result.issues,
    amberFlags: result.amberFlags,
    evidenceRefs: [
      "prd",
      "qaOutput",
      report ? "qaExecutionReport" : "",
      input.canaryCriticals?.length ? "canary" : "",
    ].filter(Boolean),
  });
}
