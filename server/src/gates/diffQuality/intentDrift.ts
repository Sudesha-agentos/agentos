import type { ValidationIssue, GateFinding } from "../../types/pipeline";
import type { GeneratedPRD } from "../../prd/prdGenerator";
import type { PrdOutput } from "../../types/agents";
import type { OriginalTicketEvidence } from "../originalTicket";
import type { DiffUnit } from "./parseDiff";
import { significantTokens, splitUnits, tokenOverlap } from "./tokens";

const ORPHAN_THRESHOLD = 0.08;
const ASK_THRESHOLD = 0.08;
const ASK_VERBS =
  /\b(add|implement|fix|support|allow|display|export|import|create|enable|prevent|validate|send|store|show|hide|update|remove|delete|rename)\b/i;

export function checkIntentDriftTicketToPrd(input: {
  ticket: OriginalTicketEvidence;
  prd?: PrdOutput;
  generatedPrd?: GeneratedPRD;
}): { issues: ValidationIssue[]; findings: GateFinding[]; amberFlags: string[] } {
  const issues: ValidationIssue[] = [];
  const findings: GateFinding[] = [];
  const amberFlags: string[] = [];

  const ticketUnits = ticketUnitsFrom(input.ticket);
  const prdUnits = prdUnitsFrom(input.prd, input.generatedPrd);

  for (const prdUnit of prdUnits) {
    const best = bestOverlap(prdUnit.tokens, ticketUnits);
    if (prdUnit.tokens.size >= 4 && best < ORPHAN_THRESHOLD) {
      const finding: GateFinding = {
        code: "INTENT_DRIFT",
        message: `PRD requirement has no grounding in the original ticket: "${prdUnit.text.slice(0, 100)}"`,
        severity: "error",
        requirement: prdUnit.text,
      };
      findings.push(finding);
      issues.push({
        code: "INTENT_DRIFT",
        severity: "error",
        message: finding.message,
      });
    } else if (prdUnit.tokens.size >= 4 && best < 0.16) {
      amberFlags.push(
        `Soft wording mismatch between PRD and ticket: "${prdUnit.text.slice(0, 80)}"`
      );
    }
  }

  for (const ask of ticketUnits) {
    if (ask.tokens.size < 5 || !ASK_VERBS.test(ask.text)) continue;
    const best = bestOverlap(ask.tokens, prdUnits);
    if (best < ASK_THRESHOLD) {
      issues.push({
        code: "INTENT_DRIFT",
        severity: "error",
        message: `Original ticket ask is not covered by the PRD: "${ask.text.slice(0, 100)}"`,
      });
    }
  }

  return { issues, findings, amberFlags };
}

export function checkIntentDriftTicketToDiff(input: {
  ticket: OriginalTicketEvidence;
  prd?: PrdOutput;
  units: DiffUnit[];
  implementationSummary?: string;
}): { issues: ValidationIssue[]; findings: GateFinding[]; amberFlags: string[] } {
  const issues: ValidationIssue[] = [];
  const findings: GateFinding[] = [];
  const amberFlags: string[] = [];

  const ticketUnits = ticketUnitsFrom(input.ticket);
  const diffBlob = [
    input.implementationSummary ?? "",
    ...input.units.map(
      (u) => `${u.path} ${u.symbols.join(" ")} ${u.hunkPreview}`
    ),
    ...(input.prd?.acceptanceCriteria ?? []),
  ].join("\n");
  const diffTokens = significantTokens(diffBlob);

  for (const ask of ticketUnits) {
    if (ask.tokens.size < 5 || !ASK_VERBS.test(ask.text)) continue;
    const overlap = tokenOverlap(ask.tokens, diffTokens);
    if (overlap < ASK_THRESHOLD) {
      const finding: GateFinding = {
        code: "INTENT_DRIFT",
        message: `Diff does not address original ticket ask: "${ask.text.slice(0, 100)}"`,
        severity: "error",
        requirement: ask.text,
      };
      findings.push(finding);
      issues.push({
        code: "INTENT_DRIFT",
        severity: "error",
        message: finding.message,
      });
    }
  }

  const prdExtras = (input.prd?.acceptanceCriteria ?? []).filter((ac) => {
    const tokens = significantTokens(ac);
    if (tokens.size < 4) return false;
    return bestOverlap(tokens, ticketUnits) < ORPHAN_THRESHOLD;
  });
  if (prdExtras.length > 0 && input.units.length > 0) {
    issues.push({
      code: "INTENT_DRIFT",
      severity: "error",
      message: `Diff implements PRD-only extras the original ticket never asked for: "${prdExtras[0]!.slice(0, 100)}"`,
    });
  }

  return { issues, findings, amberFlags };
}

function ticketUnitsFrom(ticket: OriginalTicketEvidence) {
  const chunks = [
    ticket.summary,
    ...splitUnits(ticket.description),
    ...splitUnits(ticket.comments),
    ...(ticket.discoveryAnswers ?? []),
  ].filter((s) => s.trim().length >= 12);
  return chunks.map((text) => ({ text, tokens: significantTokens(text) }));
}

function prdUnitsFrom(prd?: PrdOutput, generated?: GeneratedPRD) {
  const stories = generated?.userStories?.map((s) => s.story) ?? prd?.userStories ?? [];
  const acs =
    generated?.userStories?.flatMap((s) => s.acceptanceCriteria ?? []) ??
    prd?.acceptanceCriteria ??
    [];
  const chunks = [
    generated?.problemStatement ?? prd?.problemStatement,
    generated?.proposedSolution ?? prd?.proposedSolution,
    ...stories,
    ...acs,
  ].filter((s): s is string => Boolean(s?.trim()));
  return chunks.map((text) => ({ text, tokens: significantTokens(text) }));
}

function bestOverlap(
  tokens: Set<string>,
  units: Array<{ tokens: Set<string> }>
): number {
  let best = 0;
  for (const unit of units) {
    best = Math.max(best, tokenOverlap(tokens, unit.tokens));
  }
  return best;
}
