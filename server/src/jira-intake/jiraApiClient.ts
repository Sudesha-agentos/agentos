import {
  getActivePipelineJiraCredentials,
  validatePipelineJiraConfig,
} from "../pipeline/jira/credentialsStore";
import { pipelineJiraFetch } from "../pipeline/jira/client";
import { getPipelineIntakeMapping } from "../pipeline/jira/intakeConfig";
import { getBoardColumnsOrdered } from "../pipeline/jira/boardService";

function getAuthHeader(): string {
  const creds = getActivePipelineJiraCredentials();
  const token = Buffer.from(`${creds.email}:${creds.apiToken}`).toString("base64");
  return `Basic ${token}`;
}

export async function jiraFetch(
  path: string,
  options: RequestInit = {}
): Promise<unknown> {
  validatePipelineJiraConfig();
  return pipelineJiraFetch(path, options);
}

export function escapeJqlString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export async function getBoardFilterJql(): Promise<string> {
  const { boardId } = getPipelineIntakeMapping();
  if (!boardId) {
    const keys = getActivePipelineJiraCredentials().projectKeys;
    if (keys.length === 1) return `project = "${escapeJqlString(keys[0])}"`;
    if (keys.length > 1) {
      const list = keys.map((k) => `"${escapeJqlString(k)}"`).join(", ");
      return `project in (${list})`;
    }
    return "order by updated DESC";
  }

  const configData = (await jiraFetch(
    `/rest/agile/1.0/board/${boardId}/configuration`
  )) as { filter?: { query?: string } };

  const filterJql = configData?.filter?.query?.trim();
  if (filterJql) return filterJql;

  const keys = getActivePipelineJiraCredentials().projectKeys;
  if (keys.length === 1) return `project = "${escapeJqlString(keys[0])}"`;
  return "order by updated DESC";
}

export async function getBoardColumnMapping(): Promise<Map<string, string>> {
  const columns = await getBoardColumnsOrdered();
  const map = new Map<string, string>();
  for (const col of columns) {
    for (const status of col.statuses) {
      map.set(status.toLowerCase(), col.name);
    }
  }
  return map;
}

export async function searchIssues<T = unknown>(
  jql: string,
  { maxResults = 100, nextPageToken }: { maxResults?: number; nextPageToken?: string } = {}
): Promise<{
  issues: T[];
  isLast: boolean;
  nextPageToken?: string;
}> {
  const body: Record<string, unknown> = {
    jql,
    maxResults,
    fields: [
      "summary",
      "description",
      "status",
      "issuetype",
      "project",
      "assignee",
      "reporter",
      "priority",
      "labels",
      "updated",
    ],
  };
  if (nextPageToken) body.nextPageToken = nextPageToken;

  const result = (await jiraFetch("/rest/api/3/search/jql", {
    method: "POST",
    body: JSON.stringify(body),
  })) as {
    issues?: T[];
    isLast?: boolean;
    nextPageToken?: string;
  };

  return {
    issues: result.issues ?? [],
    isLast: Boolean(result.isLast),
    nextPageToken: result.nextPageToken,
  };
}

export { getAuthHeader };
