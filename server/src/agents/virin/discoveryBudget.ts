import type { PmTicketInput } from "../pm/types";
import type { IntakeOutput, VirinTicketType } from "./types";
import { VIRIN_BEHAVIOR } from "./persona";

export interface DiscoveryBudgetInput {
  intake: Pick<IntakeOutput, "ticketType" | "reasoning" | "symptomVsRootCause">;
  ticket: Pick<PmTicketInput, "summary" | "description" | "priority" | "labels">;
  /** Optional codebase / business signals available at question-mode start. */
  codebaseEase?: {
    similarTicketCount?: number;
    candidateModuleCount?: number;
    componentBugCount?: number;
  };
  strategicGoalsText?: string;
}

export interface DiscoveryBudget {
  maxTurns: number;
  rationale: string;
  highImportance: boolean;
}

const HARD_CEILING = VIRIN_BEHAVIOR.maxDiscoveryTurns;
const FLOOR = 2;

/** Base ceilings by intake classification — not quotas. */
const BASE_BY_TYPE: Record<VirinTicketType, number> = {
  bug: 3,
  task: 3,
  small_feature: 5,
  large_feature: 8,
  unclear: 4,
};

const HIGH_PRIORITY = /^(highest|high|critical|blocker|p0|p1)$/i;
const STRATEGIC_KEYWORDS =
  /revenue|billing|auth|security|compliance|migration|platform|core|payment|gdpr|sso|permission/i;

function descriptionRichness(ticket: DiscoveryBudgetInput["ticket"]): "sparse" | "adequate" | "rich" {
  const body = `${ticket.summary ?? ""}\n${ticket.description ?? ""}`.trim();
  const len = body.length;
  if (len < 180) return "sparse";
  if (len > 900) return "rich";
  return "adequate";
}

function isHighPriority(priority: string | undefined): boolean {
  return HIGH_PRIORITY.test((priority ?? "").trim());
}

function strategicOverlap(
  ticket: DiscoveryBudgetInput["ticket"],
  strategicGoalsText: string | undefined,
  intake: DiscoveryBudgetInput["intake"]
): boolean {
  const haystack = [
    ticket.summary,
    ticket.description,
    ...(ticket.labels ?? []),
    intake.reasoning,
    intake.symptomVsRootCause,
    strategicGoalsText ?? "",
  ]
    .join(" ")
    .toLowerCase();
  return STRATEGIC_KEYWORDS.test(haystack);
}

function isEasyImplementation(codebaseEase: DiscoveryBudgetInput["codebaseEase"]): boolean {
  if (!codebaseEase) return false;
  const similar = codebaseEase.similarTicketCount ?? 0;
  const modules = codebaseEase.candidateModuleCount ?? 0;
  const bugs = codebaseEase.componentBugCount ?? 0;
  // Localized change: few modules, prior similar work, not a hot bug area.
  return similar >= 1 && modules > 0 && modules <= 3 && bugs <= 2;
}

/**
 * Per-ticket discovery question ceiling. Budget is a ceiling, not a quota —
 * Virin should still choose "ready" as soon as PRD-critical gaps are closed.
 */
export function resolveDiscoveryBudget(input: DiscoveryBudgetInput): DiscoveryBudget {
  const { intake, ticket } = input;
  const reasons: string[] = [];

  let maxTurns = BASE_BY_TYPE[intake.ticketType] ?? 4;
  reasons.push(`base ${maxTurns} for ${intake.ticketType}`);

  const highPriority = isHighPriority(ticket.priority);
  const strategic = strategicOverlap(ticket, input.strategicGoalsText, intake);
  const highImportance = highPriority || strategic || intake.ticketType === "large_feature";

  if (highPriority) {
    maxTurns += 2;
    reasons.push(`+2 high priority (${ticket.priority || "n/a"})`);
  } else if (strategic && intake.ticketType !== "large_feature") {
    maxTurns += 1;
    reasons.push("+1 strategic / blast-radius keywords");
  }

  const richness = descriptionRichness(ticket);
  if (richness === "sparse") {
    maxTurns += 2;
    reasons.push("+2 sparse ticket body");
  } else if (richness === "rich" && (intake.ticketType === "bug" || intake.ticketType === "task")) {
    maxTurns -= 1;
    reasons.push("-1 rich bug/task description");
  }

  if (isEasyImplementation(input.codebaseEase)) {
    maxTurns -= 2;
    reasons.push("-2 easy/local codebase signals");
  }

  // Large features may climb with importance, but stay under the hard ceiling.
  if (intake.ticketType === "large_feature") {
    maxTurns = Math.min(Math.max(maxTurns, 6), 10);
  }

  maxTurns = Math.min(HARD_CEILING, Math.max(FLOOR, maxTurns));

  return {
    maxTurns,
    highImportance,
    rationale: `Discovery budget ${maxTurns} (ceiling, not a quota): ${reasons.join("; ")}.${
      highImportance
        ? " Prioritize blocking edge/failure/security gaps before UX polish."
        : " Prefer early ready once problem, success, and MVP/done-when are clear."
    }`,
  };
}
