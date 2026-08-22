import { validateGeneratedPrd } from "../../prd/prdQualityGate";
import { generatedPrdToPrdOutput } from "../../prd/toPrdOutput";
import { validatePrd } from "../../validators/prdValidator";
import { isAlreadyShipped } from "../../agents/virin/alreadyBuiltAssessment";
import { checkIntentDriftTicketToPrd } from "../diffQuality/intentDrift";
import { extractOriginalTicket } from "../originalTicket";
import { finalizeGateResult, mergeValidation } from "../result";
import type { GateInput } from "../input";
import type { GateResult, GateFinding, ValidationIssue } from "../../types/pipeline";

export function evaluateVirinPrd(input: GateInput): GateResult {
  const generated = input.generatedPrd ?? input.pmRecord?.generatedPrd;
  const ticket = input.ticket ?? extractOriginalTicket(input.normalizedTicket, input.pmRecord);
  const issues: ValidationIssue[] = [];
  const amberFlags: string[] = [];
  const findings: GateFinding[] = [];
  const evidenceRefs = ["originalTicket", "generatedPrd"];

  if (!generated) {
    return finalizeGateResult({
      gateId: "virin_prd",
      issues: [
        {
          code: "MISSING_PRD",
          severity: "error",
          message: "Virin PRD is missing — cannot hand off to engineering.",
        },
      ],
      evidenceRefs,
    });
  }

  const quality = validateGeneratedPrd(generated, {
    relevantModuleCount: input.pmRecord?.codebaseAnalysis?.relevantModules?.length ?? 0,
  });
  for (const message of quality.issues) {
    issues.push({
      code: "PRD_QUALITY",
      severity: "error" as const,
      message,
    });
  }

  const prdOutput = input.prd ?? generatedPrdToPrdOutput(generated);
  const shape = validatePrd(prdOutput, { source: "pm_agents" });
  const merged = mergeValidation(shape, { issues, amberFlags });

  const drift = checkIntentDriftTicketToPrd({
    ticket,
    prd: prdOutput,
    generatedPrd: generated,
  });

  if (isAlreadyShipped(input.pmRecord?.codebaseAnalysis)) {
    merged.issues.push({
      code: "ALREADY_SHIPPED",
      severity: "error",
      message:
        input.pmRecord?.codebaseAnalysis?.alreadyShippedNote?.trim() ||
        "Codebase analysis says this capability already exists. Override required to hand off a thin delta.",
    });
  }

  findings.push(...drift.findings);
  return finalizeGateResult({
    gateId: "virin_prd",
    issues: [...merged.issues, ...drift.issues],
    amberFlags: [...merged.amberFlags, ...drift.amberFlags],
    evidenceRefs,
    findings,
  });
}
