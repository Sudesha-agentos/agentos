import { validateGeneratedPrd } from "../../prd/prdQualityGate";
import { validatePrd } from "../../validators/prdValidator";
import { checkIntentDriftTicketToPrd } from "../diffQuality/intentDrift";
import { extractOriginalTicket } from "../originalTicket";
import { finalizeGateResult, mergeValidation } from "../result";
import type { GateInput } from "../input";
import type { GateResult } from "../../types/pipeline";

export function evaluatePrdGate(input: GateInput): GateResult {
  const prd = input.prd;
  if (!prd) {
    return finalizeGateResult({
      gateId: "prd",
      issues: [
        {
          code: "MISSING_PRD",
          severity: "error",
          message: "PRD output is missing.",
        },
      ],
    });
  }

  const shape = validatePrd(prd, { source: input.prdSource });
  let merged = shape;

  if (input.generatedPrd) {
    const quality = validateGeneratedPrd(input.generatedPrd, {
      relevantModuleCount:
        input.pmRecord?.codebaseAnalysis?.relevantModules?.length ?? 0,
    });
    merged = mergeValidation(shape, {
      issues: quality.issues.map((message) => ({
        code: "PRD_QUALITY",
        severity: "error" as const,
        message,
      })),
    });
  }

  const ticket = input.ticket ?? extractOriginalTicket(input.normalizedTicket, input.pmRecord);
  const hasTicket = Boolean(ticket.summary || ticket.description);
  const drift = hasTicket
    ? checkIntentDriftTicketToPrd({
        ticket,
        prd,
        generatedPrd: input.generatedPrd,
      })
    : { issues: [], findings: [], amberFlags: [] };

  return finalizeGateResult({
    gateId: "prd",
    issues: [...merged.issues, ...drift.issues],
    amberFlags: [...merged.amberFlags, ...drift.amberFlags],
    evidenceRefs: [
      "prd",
      ticket.summary ? "originalTicket" : "",
      input.generatedPrd ? "generatedPrd" : "",
    ].filter(Boolean),
    findings: drift.findings,
  });
}
