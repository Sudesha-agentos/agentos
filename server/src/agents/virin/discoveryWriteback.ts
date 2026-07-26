/**
 * Classify Virin flags/questions that require human input (creds, access, analysis)
 * and write discovery pauses / blockers back to Jira.
 */

import { getPipelineJiraClient } from "../../pipeline/jira/client";
import { logger } from "../../utils/logger";

export type HumanBlockerKind =
  | "credentials"
  | "access"
  | "human_analysis"
  | "already_shipped"
  | "log_sources"
  | "other";

export type HumanBlocker = {
  id: string;
  kind: HumanBlockerKind;
  title: string;
  detail: string;
  jiraWritten: boolean;
  createdAt: string;
  resolvedAt?: string | null;
};

const CRED_RE =
  /\b(cred(ential)?s?|api[_ ]?key|secret|token|password|passwd|auth[_ ]?key|private[_ ]?key|access[_ ]?key|saas[_ ]?key)\b/i;
const ACCESS_RE =
  /\b(vpn|staging (url|access)|prod access|permission|ssh|bastion|whitelist|allowlist|login to|admin access)\b/i;
const ANALYSIS_RE =
  /\b(product (decision|call)|stakeholder|legal|compliance|pricing|business (decision|owner)|need(s)? (human|your) (input|review|decision)|confirm with)\b/i;

export function classifyHumanBlocker(text: string): HumanBlockerKind | null {
  const t = text.trim();
  if (!t) return null;
  if (CRED_RE.test(t)) return "credentials";
  if (ACCESS_RE.test(t)) return "access";
  if (/already (built|shipped|implemented)|do not rebuild/i.test(t)) return "already_shipped";
  if (/log source|link.*(datadog|sentry|logs)|no log/i.test(t)) return "log_sources";
  if (ANALYSIS_RE.test(t)) return "human_analysis";
  if (/\b(need|requires?|waiting on|blocked on)\b.*\b(human|you|stakeholder|owner)\b/i.test(t)) {
    return "human_analysis";
  }
  return null;
}

export function blockerTitle(kind: HumanBlockerKind): string {
  switch (kind) {
    case "credentials":
      return "Credentials / secrets needed";
    case "access":
      return "Environment / access needed";
    case "human_analysis":
      return "Human product analysis needed";
    case "already_shipped":
      return "Capability may already exist — confirm";
    case "log_sources":
      return "Link log sources or paste traces";
    default:
      return "Human input needed";
  }
}

function jiraClientOrNull() {
  try {
    return getPipelineJiraClient();
  } catch {
    return null;
  }
}

export async function writeDiscoveryQuestionToJira(input: {
  jiraKey: string;
  question: string;
  options?: string[];
  stage?: string;
}): Promise<boolean> {
  if (process.env.VIRIN_JIRA_DISCOVERY_WRITEBACK === "0") return false;
  const client = jiraClientOrNull();
  if (!client) return false;
  const opts =
    input.options?.length
      ? `\nOptions:\n${input.options.map((o, i) => `${i + 1}. ${o}`).join("\n")}`
      : "";
  const body = [
    `[Virin] Waiting on human input (${input.stage ?? "discovery"})`,
    "",
    input.question,
    opts,
    "",
    "Reply in AgentOX (PM Agents → Virin) or comment here — then continue the analysis.",
  ].join("\n");
  try {
    await client.addPlainTextComment(input.jiraKey, body);
    await client.addLabels(input.jiraKey, ["virin-awaiting-input"]);
    return true;
  } catch (err) {
    logger.warn({ err, jiraKey: input.jiraKey }, "virin discovery question Jira writeback failed");
    return false;
  }
}

export async function writeHumanBlockerToJira(input: {
  jiraKey: string;
  blocker: HumanBlocker;
}): Promise<boolean> {
  if (process.env.VIRIN_JIRA_DISCOVERY_WRITEBACK === "0") return false;
  const client = jiraClientOrNull();
  if (!client) return false;
  const body = [
    `[Virin] BLOCKER — ${input.blocker.title}`,
    `Kind: ${input.blocker.kind}`,
    "",
    input.blocker.detail,
    "",
    "Provide the missing input in AgentOX or as a Jira comment, then resume Virin.",
  ].join("\n");
  try {
    await client.addPlainTextComment(input.jiraKey, body);
    await client.addLabels(input.jiraKey, ["virin-blocker", `virin-${input.blocker.kind}`]);
    return true;
  } catch (err) {
    logger.warn({ err, jiraKey: input.jiraKey }, "virin blocker Jira writeback failed");
    return false;
  }
}

export async function writeAlreadyShippedToJira(input: {
  jiraKey: string;
  note: string;
  alreadyExists: string[];
  gapsToBuild: string[];
  verdict: string;
}): Promise<boolean> {
  if (process.env.VIRIN_JIRA_DISCOVERY_WRITEBACK === "0") return false;
  const client = jiraClientOrNull();
  if (!client) return false;
  const body = [
    `[Virin] Codebase overlap: ${input.verdict}`,
    "",
    input.note,
    "",
    "Already in codebase:",
    ...(input.alreadyExists.length
      ? input.alreadyExists.map((x) => `• ${x}`)
      : ["• (see analysis)"]),
    "",
    "Remaining gaps:",
    ...(input.gapsToBuild.length
      ? input.gapsToBuild.map((x) => `• ${x}`)
      : ["• none — consider verifying/closing instead of rebuilding"]),
    "",
    "Confirm in AgentOX solutioning before engineering rebuilds this.",
  ].join("\n");
  try {
    await client.addPlainTextComment(input.jiraKey, body);
    await client.addLabels(input.jiraKey, ["virin-already-built", "agentos-overlap"]);
    return true;
  } catch (err) {
    logger.warn({ err, jiraKey: input.jiraKey }, "virin already-shipped Jira writeback failed");
    return false;
  }
}

export function makeBlocker(kind: HumanBlockerKind, detail: string): HumanBlocker {
  return {
    id: `hb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    kind,
    title: blockerTitle(kind),
    detail: detail.slice(0, 2000),
    jiraWritten: false,
    createdAt: new Date().toISOString(),
  };
}
