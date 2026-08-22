import type { NormalizedTicket } from "../types/ticket";
import type { PmAnalysisRecord } from "../agents/pm/types";

export interface OriginalTicketEvidence {
  summary: string;
  description: string;
  comments: string;
  discoverySummary?: string;
  discoveryAnswers?: string[];
}

export function extractOriginalTicket(
  ticket?: NormalizedTicket | null,
  pmRecord?: PmAnalysisRecord | null
): OriginalTicketEvidence {
  const stored = ticket?.originalTicket;
  const summary =
    stored?.summary?.trim() ||
    ticket?.summary?.trim() ||
    pmRecord?.ticketInput?.summary?.trim() ||
    "";
  const description =
    stored?.description?.trim() ||
    ticket?.description?.trim() ||
    pmRecord?.ticketInput?.description?.trim() ||
    "";
  const comments =
    stored?.comments?.trim() ||
    pmRecord?.ticketInput?.commentsText?.trim() ||
    "";
  const discoverySummary =
    pmRecord?.questionMode?.discoverySummary?.trim() || undefined;
  const discoveryAnswers = (pmRecord?.questionMode?.conversation ?? [])
    .map((turn) => turn.answer?.trim())
    .filter((answer): answer is string => Boolean(answer));

  return {
    summary,
    description,
    comments,
    discoverySummary,
    discoveryAnswers,
  };
}

export function originalTicketText(evidence: OriginalTicketEvidence): string {
  return [
    evidence.summary,
    evidence.description,
    evidence.comments,
    evidence.discoverySummary,
    ...(evidence.discoveryAnswers ?? []),
  ]
    .filter(Boolean)
    .join("\n");
}

export function stampOriginalTicket(
  ticket: NormalizedTicket
): NormalizedTicket {
  if (ticket.originalTicket?.summary) return ticket;
  return {
    ...ticket,
    originalTicket: {
      summary: ticket.summary ?? "",
      description: ticket.description ?? "",
      comments: ticket.originalTicket?.comments ?? "",
    },
  };
}
