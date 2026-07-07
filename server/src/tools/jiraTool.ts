import { parseDescription } from "../jira-intake/descriptionParser";
import { getPipelineJiraClient } from "../pipeline/jira/client";
import { logger } from "../utils/logger";

type RelationshipType =
  | "epic_children"
  | "linked"
  | "same_components"
  | "same_sprint";

interface JiraIssueRef {
  key: string;
  fields?: {
    summary?: string;
    status?: { name?: string };
    issuetype?: { name?: string };
    components?: Array<{ name?: string }>;
    parent?: { key?: string };
    issuelinks?: JiraIssueLink[];
    [key: string]: unknown;
  };
}

interface JiraIssueLink {
  inwardIssue?: JiraIssueRef;
  outwardIssue?: JiraIssueRef;
}

export interface RelatedJiraTicket {
  key: string;
  summary: string;
  type: string;
  status: string;
  relationship: RelationshipType;
}

export interface RelatedJiraTicketsResult {
  tickets: RelatedJiraTicket[];
  notes: string[];
}

export interface RelatedTicketDetail {
  key: string;
  summary: string;
  description: string;
  status: string;
  issueType: string;
  relationship: "epic" | "subtask" | "linked";
  commentsText?: string;
}

export interface RelatedTicketGraphResult {
  epic?: RelatedTicketDetail;
  subtasks: RelatedTicketDetail[];
  linkedIssues: RelatedTicketDetail[];
  notes: string[];
}

const RELATED_FIELDS = [
  "summary",
  "status",
  "issuetype",
  "components",
  "parent",
  "issuelinks",
  "description",
  "subtasks",
  "comment",
];

const DETAIL_FIELDS = ["summary", "description", "status", "issuetype", "comment"];

interface JiraComment {
  body?: unknown;
  author?: { displayName?: string };
}

export const jiraTool = {
  async fetchRelated(input: {
    jiraKey: string;
    relationshipTypes: RelationshipType[];
  }): Promise<RelatedJiraTicketsResult> {
    logger.info(
      { jiraKey: input.jiraKey, relationshipTypes: input.relationshipTypes },
      "fetching related Jira tickets"
    );

    const current = (await getPipelineJiraClient().getIssue(input.jiraKey)) as JiraIssueRef;
    const tickets = new Map<string, RelatedJiraTicket>();
    const notes: string[] = [];

    for (const relationshipType of input.relationshipTypes) {
      try {
        switch (relationshipType) {
          case "linked":
            collectLinkedIssues(current, tickets);
            break;
          case "epic_children":
            await collectEpicChildren(current, input.jiraKey, tickets, notes);
            break;
          case "same_components":
            await collectSameComponents(current, input.jiraKey, tickets, notes);
            break;
          case "same_sprint":
            await collectSameSprint(current, input.jiraKey, tickets, notes);
            break;
          default:
            notes.push(`Unsupported relationship type: ${relationshipType}`);
        }
      } catch (error) {
        notes.push(
          `${relationshipType} lookup failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    return {
      tickets: [...tickets.values()].slice(0, 12),
      notes,
    };
  },

  async fetchRelatedTicketDetails(jiraKey: string): Promise<RelatedTicketGraphResult> {
    logger.info({ jiraKey }, "fetching related Jira ticket graph details");

    const notes: string[] = [];
    const subtasks: RelatedTicketDetail[] = [];
    const linkedIssues: RelatedTicketDetail[] = [];
    let epic: RelatedTicketDetail | undefined;

    try {
      const current = (await getPipelineJiraClient().getIssueWithFields<JiraIssueRef>(
        jiraKey,
        RELATED_FIELDS
      )) as JiraIssueRef;

      const epicKey =
        current.fields?.issuetype?.name?.toLowerCase() === "epic"
          ? jiraKey
          : current.fields?.parent?.key ?? findEpicKey(current.fields);

      if (epicKey && epicKey !== jiraKey) {
        const detail = await fetchIssueDetail(epicKey, "epic");
        if (detail) epic = detail;
      } else if (epicKey === jiraKey) {
        const detail = issueRefToDetail(current, "epic");
        if (detail) epic = detail;
      } else {
        notes.push("No parent epic detected for this ticket.");
      }

      const subtaskRefs = (current.fields?.subtasks as JiraIssueRef[] | undefined) ?? [];
      for (const ref of subtaskRefs.slice(0, 8)) {
        if (!ref.key) continue;
        const detail =
          ref.fields?.description !== undefined
            ? issueRefToDetail(ref, "subtask")
            : await fetchIssueDetail(ref.key, "subtask");
        if (detail) subtasks.push(detail);
      }

      for (const link of current.fields?.issuelinks ?? []) {
        const related = link.outwardIssue ?? link.inwardIssue;
        if (!related?.key || related.key === jiraKey) continue;
        const detail = await fetchIssueDetail(related.key, "linked");
        if (detail) linkedIssues.push(detail);
      }
    } catch (error) {
      notes.push(
        `Related ticket graph fetch failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    return {
      epic,
      subtasks: subtasks.slice(0, 8),
      linkedIssues: linkedIssues.slice(0, 6),
      notes,
    };
  },
};

function collectLinkedIssues(
  issue: JiraIssueRef,
  target: Map<string, RelatedJiraTicket>
): void {
  for (const link of issue.fields?.issuelinks ?? []) {
    const related = link.outwardIssue ?? link.inwardIssue;
    if (!related?.key) continue;
    target.set(related.key, summarizeIssue(related, "linked"));
  }
}

async function collectEpicChildren(
  current: JiraIssueRef,
  jiraKey: string,
  target: Map<string, RelatedJiraTicket>,
  notes: string[]
): Promise<void> {
  const currentIssueType = current.fields?.issuetype?.name?.toLowerCase();
  const epicKey =
    currentIssueType === "epic"
      ? jiraKey
      : current.fields?.parent?.key ?? findEpicKey(current.fields);

  if (!epicKey) {
    notes.push("No epic or parent relationship detected for epic_children lookup.");
    return;
  }

  const queries = [
    `key != "${jiraKey}" AND (parent = "${epicKey}" OR "Epic Link" = "${epicKey}") ORDER BY updated DESC`,
    `key != "${jiraKey}" AND parent = "${epicKey}" ORDER BY updated DESC`,
  ];

  const issues = await runSearchWithFallback(queries);
  for (const issue of issues) {
    target.set(issue.key, summarizeIssue(issue, "epic_children"));
  }
}

async function collectSameComponents(
  current: JiraIssueRef,
  jiraKey: string,
  target: Map<string, RelatedJiraTicket>,
  notes: string[]
): Promise<void> {
  const components = (current.fields?.components ?? [])
    .map((component) => component?.name?.trim())
    .filter((value): value is string => Boolean(value));

  if (components.length === 0) {
    notes.push("No components found for same_components lookup.");
    return;
  }

  const componentList = components.map((name) => `"${escapeJql(name)}"`).join(", ");
  const issues = await runSearchWithFallback([
    `key != "${jiraKey}" AND component in (${componentList}) ORDER BY updated DESC`,
  ]);

  for (const issue of issues) {
    target.set(issue.key, summarizeIssue(issue, "same_components"));
  }
}

async function collectSameSprint(
  current: JiraIssueRef,
  jiraKey: string,
  target: Map<string, RelatedJiraTicket>,
  notes: string[]
): Promise<void> {
  const sprintField = detectSprintField(current.fields);
  if (!sprintField) {
    notes.push("No sprint field detected for same_sprint lookup.");
    return;
  }

  const issues = await runSearchWithFallback([
    `key != "${jiraKey}" AND ${sprintField.fieldKey} = ${sprintField.sprintId} ORDER BY updated DESC`,
  ]);

  for (const issue of issues) {
    target.set(issue.key, summarizeIssue(issue, "same_sprint"));
  }
}

async function runSearchWithFallback(queries: string[]): Promise<JiraIssueRef[]> {
  let lastError: unknown;

  for (const query of queries) {
    try {
      const response =
        await getPipelineJiraClient().searchIssues<JiraIssueRef>(query, {
          fields: RELATED_FIELDS,
          maxResults: 6,
        });
      return response.issues ?? [];
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Related issue search failed");
}

function formatComments(
  commentField: { comments?: JiraComment[] } | undefined,
  maxComments = 3
): string {
  return (commentField?.comments ?? [])
    .slice(-maxComments)
    .map((c) => {
      const author = c.author?.displayName ?? "Unknown";
      const body = parseDescription(c.body);
      return `[${author}]: ${body}`;
    })
    .filter(Boolean)
    .join("\n\n");
}

function issueRefToDetail(
  issue: JiraIssueRef,
  relationship: RelatedTicketDetail["relationship"]
): RelatedTicketDetail | null {
  if (!issue.key) return null;
  const commentField = issue.fields?.comment as { comments?: JiraComment[] } | undefined;
  return {
    key: issue.key,
    summary: issue.fields?.summary ?? "",
    description: parseDescription(issue.fields?.description),
    status: issue.fields?.status?.name ?? "Unknown",
    issueType: issue.fields?.issuetype?.name ?? "Unknown",
    relationship,
    commentsText: formatComments(commentField) || undefined,
  };
}

async function fetchIssueDetail(
  jiraKey: string,
  relationship: RelatedTicketDetail["relationship"]
): Promise<RelatedTicketDetail | null> {
  try {
    const issue = (await getPipelineJiraClient().getIssueWithFields<JiraIssueRef>(
      jiraKey,
      DETAIL_FIELDS
    )) as JiraIssueRef;
    return issueRefToDetail(issue, relationship);
  } catch {
    return null;
  }
}

function summarizeIssue(
  issue: JiraIssueRef,
  relationship: RelationshipType
): RelatedJiraTicket {
  return {
    key: issue.key,
    summary: issue.fields?.summary ?? "",
    type: issue.fields?.issuetype?.name ?? "Unknown",
    status: issue.fields?.status?.name ?? "Unknown",
    relationship,
  };
}

function findEpicKey(fields: JiraIssueRef["fields"] | undefined): string | null {
  if (!fields) return null;

  for (const [fieldKey, value] of Object.entries(fields)) {
    if (!/epic/i.test(fieldKey)) continue;
    if (typeof value === "string" && /^[A-Z][A-Z0-9]+-\d+$/.test(value)) {
      return value;
    }
    if (typeof value === "object" && value !== null && "key" in value) {
      const key = (value as { key?: unknown }).key;
      if (typeof key === "string") return key;
    }
  }

  return null;
}

function detectSprintField(
  fields: JiraIssueRef["fields"] | undefined
): { fieldKey: string; sprintId: number } | null {
  if (!fields) return null;

  for (const [fieldKey, value] of Object.entries(fields)) {
    const sprint = extractSprintValue(value);
    if (sprint?.id) {
      return { fieldKey, sprintId: sprint.id };
    }
  }

  return null;
}

function extractSprintValue(value: unknown): { id: number } | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const sprint = extractSprintValue(item);
      if (sprint) return sprint;
    }
    return null;
  }

  if (typeof value !== "object" || value === null) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = record.id;
  const name = record.name;
  const state = record.state;
  if (
    typeof id === "number" &&
    typeof name === "string" &&
    (typeof state === "string" || state === undefined)
  ) {
    return { id };
  }

  return null;
}

function escapeJql(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
