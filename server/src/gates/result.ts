import type {
  GateFinding,
  GateId,
  GateResult,
  ValidationIssue,
  ValidationResult,
} from "../types/pipeline";

export function scoreFromIssues(
  issues: ValidationIssue[],
  amberFlags: string[]
): number {
  const errorCount = issues.filter((i) => i.severity === "error").length;
  return Number(
    Math.max(0, 1 - errorCount * 0.2 - amberFlags.length * 0.04).toFixed(2)
  );
}

export function finalizeGateResult(input: {
  gateId: GateId;
  issues: ValidationIssue[];
  amberFlags?: string[];
  evidenceRefs?: string[];
  findings?: GateFinding[];
  checkedAt?: string;
}): GateResult {
  const issues = input.issues;
  const amberFlags = input.amberFlags ?? [];
  const blockingIssueCodes = [
    ...new Set(issues.filter((i) => i.severity === "error").map((i) => i.code)),
  ];
  return {
    gateId: input.gateId,
    passed: blockingIssueCodes.length === 0,
    score: scoreFromIssues(issues, amberFlags),
    issues,
    amberFlags,
    checkedAt: input.checkedAt ?? new Date().toISOString(),
    evidenceRefs: input.evidenceRefs ?? [],
    blockingIssueCodes,
    findings: input.findings,
  };
}

export function asGateResult(
  gateId: GateId,
  validation: ValidationResult,
  extras?: Partial<Pick<GateResult, "evidenceRefs" | "findings">>
): GateResult {
  const stored = validation as GateResult;
  const blockingIssueCodes = [
    ...new Set(
      validation.issues
        .filter((i) => i.severity === "error")
        .map((i) => i.code)
    ),
  ];
  return {
    ...validation,
    passed: blockingIssueCodes.length === 0,
    gateId: stored.gateId ?? gateId,
    evidenceRefs: extras?.evidenceRefs ?? stored.evidenceRefs ?? [],
    blockingIssueCodes: stored.blockingIssueCodes?.length
      ? stored.blockingIssueCodes
      : blockingIssueCodes,
    findings: extras?.findings ?? stored.findings,
  };
}

export function mergeValidation(
  base: ValidationResult,
  extra: Partial<ValidationResult> & { issues?: ValidationIssue[] }
): ValidationResult {
  const issues = [...base.issues, ...(extra.issues ?? [])];
  const amberFlags = [...base.amberFlags, ...(extra.amberFlags ?? [])];
  const errorCount = issues.filter((i) => i.severity === "error").length;
  return {
    passed: errorCount === 0,
    score: scoreFromIssues(issues, amberFlags),
    issues,
    amberFlags,
    checkedAt: extra.checkedAt ?? new Date().toISOString(),
  };
}
