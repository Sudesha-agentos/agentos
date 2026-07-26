/**
 * Gather web + log research after intake for Virin stages / handoff.
 */

import { logger } from "../../utils/logger";
import type { PmTicketInput } from "../pm/types";
import { gatherBugLogContext, type BugLogContext, formatBugLogForPrompt } from "./bugLogContext";
import {
  formatWebResearchForPrompt,
  webSearchForVirin,
  type WebResearchBundle,
} from "./webResearch";
import type { IntakeOutput } from "./types";

export type VirinResearchContext = {
  gatheredAt: string;
  web?: WebResearchBundle | null;
  bugLogs?: BugLogContext | null;
  promptBlock: string;
};

function shouldWebSearch(intake: IntakeOutput, ticket: PmTicketInput): boolean {
  if (process.env.VIRIN_WEB_RESEARCH === "0") return false;
  const text = `${ticket.summary}\n${ticket.description ?? ""}`.toLowerCase();
  if (intake.ticketType === "large_feature" || intake.ticketType === "small_feature") {
    return (
      /currency|payment|checkout|gdpr|pci|oauth|sso|i18n|compliance|regulation|eu |stripe|fx |exchange rate/.test(
        text
      ) || intake.ticketType === "large_feature"
    );
  }
  if (intake.ticketType === "bug") {
    return /cve|security|vulnerability|library|dependency|upstream|known issue/.test(text);
  }
  return /best practice|standard|rfc|spec\b/.test(text);
}

export async function gatherVirinResearch(input: {
  jiraKey: string;
  ticket: PmTicketInput;
  intake: IntakeOutput;
  organizationId?: string | null;
}): Promise<VirinResearchContext> {
  const parts: string[] = [];
  let web: WebResearchBundle | null = null;
  let bugLogs: BugLogContext | null = null;

  try {
    if (input.intake.ticketType === "bug" || /bug|error|crash|500|exception/i.test(input.ticket.summary)) {
      bugLogs = await gatherBugLogContext({
        jiraKey: input.jiraKey,
        organizationId: input.organizationId,
        ticketSummary: input.ticket.summary,
      });
      parts.push(formatBugLogForPrompt(bugLogs));
    }

    if (shouldWebSearch(input.intake, input.ticket)) {
      const query = [
        input.ticket.summary.slice(0, 120),
        input.intake.ticketType === "bug" ? "root cause known issue" : "product requirements best practices",
        "EU",
      ]
        .filter(Boolean)
        .join(" ");
      web = await webSearchForVirin(query, { browseTopUrl: false });
      parts.push(formatWebResearchForPrompt(web));
    }
  } catch (err) {
    logger.warn({ err, jiraKey: input.jiraKey }, "gatherVirinResearch failed");
    parts.push("Research gather failed — proceed with ticket + codebase only; ask human for unknowns.");
  }

  if (!parts.length) {
    parts.push("No extra web/log research for this ticket.");
  }

  return {
    gatheredAt: new Date().toISOString(),
    web,
    bugLogs,
    promptBlock: parts.join("\n\n"),
  };
}
