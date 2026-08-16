import type Anthropic from "@anthropic-ai/sdk";
import { TOOL_DEFINITIONS } from "./definitions";
import { LOOKUP_JIRA_TICKET_TOOL } from "./sharedChatToolDefinitions";
import { CUSTOMER_DB_READ_TOOL_DEFINITIONS } from "../customerDb/toolDefinitions";

const VIRIN_CHAT_TOOL_NAMES = new Set([
  "search_historical_context",
  "fetch_related_jira_tickets",
  "analyse_requirement_completeness",
  "score_prd_readiness",
]);

export const VIRIN_CHAT_TOOL_DEFINITIONS: Anthropic.Tool[] = [
  LOOKUP_JIRA_TICKET_TOOL,
  ...TOOL_DEFINITIONS.filter((t) => VIRIN_CHAT_TOOL_NAMES.has(t.name)),
  ...CUSTOMER_DB_READ_TOOL_DEFINITIONS,
];
