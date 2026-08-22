import { validateImplementation } from "../../validators/implementationValidator";
import {
  checkAttribution,
  checkIntentDriftTicketToDiff,
  checkMinimality,
  checkRedundancy,
  parseDiffUnits,
} from "../diffQuality";
import { extractOriginalTicket } from "../originalTicket";
import { finalizeGateResult } from "../result";
import type { GateInput } from "../input";
import type { GateResult } from "../../types/pipeline";

export async function evaluateImplementationGate(input: GateInput): Promise<GateResult> {
  const implementation = input.implementation;
  const prd = input.prd;
  if (!implementation || !prd) {
    return finalizeGateResult({
      gateId: "implementation",
      issues: [
        {
          code: "MISSING_IMPLEMENTATION",
          severity: "error",
          message: "Implementation or PRD output is missing.",
        },
      ],
    });
  }

  const shape = validateImplementation(implementation, prd, {
    implementationMode: input.implementationMode,
    targetFiles: input.targetFiles,
  });

  const units =
    input.diffUnits ??
    parseDiffUnits({
      diffText: input.workspaceDiff,
      codeChanges: implementation.codeChanges,
      changedFiles: input.changedFiles,
    });

  const ticket = input.ticket ?? extractOriginalTicket(input.normalizedTicket, input.pmRecord);
  const attribution = checkAttribution({
    units,
    prd,
    ticket,
    implementation,
  });
  const minimality = checkMinimality({ units, prd });
  const redundancy = await checkRedundancy({
    units,
    pmRecord: input.pmRecord,
    searcher: input.duplicateSearcher,
  });
  const drift = checkIntentDriftTicketToDiff({
    ticket,
    prd,
    units,
    implementationSummary: implementation.summary ?? implementation.codingSummary,
  });

  return finalizeGateResult({
    gateId: "implementation",
    issues: [
      ...shape.issues,
      ...attribution.issues,
      ...minimality.issues,
      ...redundancy.issues,
      ...drift.issues,
    ],
    amberFlags: [
      ...shape.amberFlags,
      ...attribution.amberFlags,
      ...minimality.amberFlags,
      ...redundancy.amberFlags,
      ...drift.amberFlags,
    ],
    evidenceRefs: [
      "originalTicket",
      "prd",
      "workspaceDiff",
      implementation.codeChanges?.length ? "codeChanges" : "",
    ].filter(Boolean),
    findings: [
      ...attribution.findings,
      ...minimality.findings,
      ...redundancy.findings,
      ...drift.findings,
    ],
  });
}
