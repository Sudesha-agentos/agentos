import type { GateResult, ValidationIssue } from "../../types/pipeline";
import { finalizeGateResult } from "../result";
import type { GateInput } from "../input";

export function evaluateVirinDiscovery(input: GateInput): GateResult {
  const issues: ValidationIssue[] = [];
  const amberFlags: string[] = [];
  const question = input.pmRecord?.questionMode;
  const conversation = question?.conversation ?? [];
  const summary = question?.discoverySummary?.trim() ?? "";
  const maxTurns = question?.maxTurns ?? 0;
  const budgetExhausted =
    maxTurns > 0 && conversation.length >= maxTurns;

  if (conversation.length > 0 && !summary) {
    issues.push({
      code: "DISCOVERY_INCOMPLETE",
      severity: "error" as const,
      message:
        "Discovery asked questions but produced no summary — cannot proceed to solutioning.",
    });
  }

  if (
    input.virinMode === "interactive" &&
    conversation.some((turn) => !turn.answer?.trim()) &&
    !budgetExhausted
  ) {
    issues.push({
      code: "DISCOVERY_UNANSWERED",
      severity: "error" as const,
      message: "Interactive discovery still has unanswered questions.",
    });
  }

  if (conversation.length === 0 && !summary) {
    amberFlags.push("No discovery Q&A — proceeding on the raw ticket only.");
  }

  return finalizeGateResult({
    gateId: "virin_discovery",
    issues,
    amberFlags,
    evidenceRefs: [
      summary ? "discoverySummary" : "",
      conversation.length ? `discoveryTurns:${conversation.length}` : "",
    ].filter(Boolean),
  });
}
