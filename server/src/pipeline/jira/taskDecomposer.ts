import { getPipelineJiraClient } from "./client";
import { logger } from "../../utils/logger";

export interface StoryTaskGroup {
  storyKey: string;
  storySummary: string;
  taskKeys: string[];
}

export interface DecomposedIntake {
  sourceKey: string;
  sourceIssueType: string;
  groups: StoryTaskGroup[];
}

interface HierarchyIssue {
  id: string;
  key: string;
  fields?: {
    summary?: string;
    issuetype?: { name?: string; subtask?: boolean };
    subtasks?: Array<{ key?: string }>;
    parent?: { key?: string };
    [key: string]: unknown;
  };
}

const HIERARCHY_FIELDS = [
  "summary",
  "issuetype",
  "subtasks",
  "parent",
  "customfield_10014",
];

/** Expand Epic/Story intake into leaf tasks grouped by story (contiguous queue blocks). */
export async function decomposeForPipelineIntake(
  rootKey: string
): Promise<DecomposedIntake> {
  const client = getPipelineJiraClient();
  const root = (await client.getIssueWithFields<HierarchyIssue>(
    rootKey,
    HIERARCHY_FIELDS
  )) as HierarchyIssue;

  const sourceIssueType = root.fields?.issuetype?.name ?? "Story";
  const issueTypeLower = sourceIssueType.toLowerCase();

  if (issueTypeLower === "epic") {
    const stories = await fetchEpicStoryChildren(rootKey);
    if (stories.length === 0) {
      logger.warn({ rootKey }, "epic has no child stories — queueing epic as single task");
      return {
        sourceKey: rootKey,
        sourceIssueType,
        groups: [
          {
            storyKey: rootKey,
            storySummary: root.fields?.summary ?? rootKey,
            taskKeys: [rootKey],
          },
        ],
      };
    }

    const groups: StoryTaskGroup[] = [];
    for (const story of stories) {
      const taskKeys = await expandToBasicTasks(story.key);
      groups.push({
        storyKey: story.key,
        storySummary: story.fields?.summary ?? story.key,
        taskKeys,
      });
    }

    return { sourceKey: rootKey, sourceIssueType, groups };
  }

  const taskKeys = await expandToBasicTasks(rootKey);
  return {
    sourceKey: rootKey,
    sourceIssueType,
    groups: [
      {
        storyKey: rootKey,
        storySummary: root.fields?.summary ?? rootKey,
        taskKeys,
      },
    ],
  };
}

/** Recursively split until leaf issues (no child subtasks). */
async function expandToBasicTasks(issueKey: string): Promise<string[]> {
  const children = await fetchDirectChildren(issueKey);
  if (children.length === 0) {
    return [issueKey];
  }

  const tasks: string[] = [];
  for (const child of children) {
    tasks.push(...(await expandToBasicTasks(child.key)));
  }
  return tasks;
}

async function fetchDirectChildren(parentKey: string): Promise<HierarchyIssue[]> {
  const client = getPipelineJiraClient();
  const issue = (await client.getIssueWithFields<HierarchyIssue>(
    parentKey,
    HIERARCHY_FIELDS
  )) as HierarchyIssue;

  const fromSearch = await runSearchWithFallback([
    `parent = "${parentKey}" ORDER BY rank ASC, created ASC`,
  ]);

  const merged = new Map<string, HierarchyIssue>();
  for (const child of fromSearch) {
    merged.set(child.key, child);
  }

  for (const stub of issue.fields?.subtasks ?? []) {
    if (!stub.key || merged.has(stub.key)) continue;
    try {
      const full = (await client.getIssueWithFields<HierarchyIssue>(
        stub.key,
        HIERARCHY_FIELDS
      )) as HierarchyIssue;
      merged.set(full.key, full);
    } catch (err) {
      logger.warn({ err, parentKey, childKey: stub.key }, "failed to fetch subtask stub");
    }
  }

  return [...merged.values()];
}

async function fetchEpicStoryChildren(epicKey: string): Promise<HierarchyIssue[]> {
  const issues = await runSearchWithFallback([
    `(parent = "${epicKey}" OR "Epic Link" = "${epicKey}") ORDER BY rank ASC, created ASC`,
    `parent = "${epicKey}" ORDER BY rank ASC, created ASC`,
  ]);

  return issues.filter((issue) => !isSubtaskIssue(issue));
}

async function runSearchWithFallback(
  queries: string[]
): Promise<HierarchyIssue[]> {
  const client = getPipelineJiraClient();
  let lastError: unknown;

  for (const jql of queries) {
    try {
      const response = await client.searchIssues<HierarchyIssue>(jql, {
        fields: HIERARCHY_FIELDS,
        maxResults: 100,
      });
      return response.issues ?? [];
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Jira hierarchy search failed");
}

function isSubtaskIssue(issue: HierarchyIssue): boolean {
  const typeName = issue.fields?.issuetype?.name?.toLowerCase() ?? "";
  return issue.fields?.issuetype?.subtask === true || typeName === "sub-task";
}
