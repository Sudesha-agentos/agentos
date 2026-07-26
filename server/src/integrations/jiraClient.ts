import { logger } from "../utils/logger";
import { retry } from "../utils/retry";

/**
 * Minimal Jira REST v3 client. Only the endpoints the pipeline actually needs:
 * fetching a ticket, posting a comment, and attaching agent output as a
 * structured block. Auth is Basic email:token.
 */

export interface JiraComment {
  body: unknown;
}

export interface JiraIssueSearchResult<TIssue = unknown> {
  issues: TIssue[];
}

type JiraClientOAuthOpts = {
  cloudId: string;
  getAccessToken: () => Promise<string>;
};

type AdfNode = Record<string, unknown>;

/** Inline bold for *text* / **text** (non-greedy, single-line). */
function inlineMarks(line: string): AdfNode[] {
  const nodes: AdfNode[] = [];
  const re = /(\*\*|__)(.+?)\1|(\*|_)(.+?)\3/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    if (m.index > last) {
      nodes.push({ type: "text", text: line.slice(last, m.index) });
    }
    const bold = Boolean(m[1] || m[3] === "*" || m[3] === "_");
    const text = (m[2] ?? m[4] ?? "") as string;
    nodes.push({
      type: "text",
      text,
      marks: bold ? [{ type: "strong" }] : [{ type: "em" }],
    });
    last = m.index + m[0].length;
  }
  if (last < line.length) {
    nodes.push({ type: "text", text: line.slice(last) });
  }
  if (!nodes.length) nodes.push({ type: "text", text: line || " " });
  return nodes;
}

/**
 * Best-effort conversion of wiki (`h2.`) / markdown (`##`) comment bodies to ADF.
 * Keeps writebacks readable in Jira Cloud (ADF does not parse wiki markup).
 */
export function textToAdfContent(text: string): AdfNode[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const content: AdfNode[] = [];
  let paraBuf: string[] = [];

  const flushPara = () => {
    if (!paraBuf.length) return;
    const joined = paraBuf.join("\n");
    content.push({
      type: "paragraph",
      content: inlineMarks(joined),
    });
    paraBuf = [];
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const wiki = line.match(/^(h([1-6]))\.\s+(.*)$/i);
    const md = line.match(/^(#{1,6})\s+(.*)$/);
    if (wiki || md) {
      flushPara();
      const level = wiki
        ? Number(wiki[2])
        : Math.min(6, (md![1] as string).length);
      const headingText = (wiki ? wiki[3] : md![2]) ?? "";
      content.push({
        type: "heading",
        attrs: { level },
        content: inlineMarks(headingText),
      });
      continue;
    }
    if (line.trim() === "") {
      flushPara();
      continue;
    }
    // Strip leading wiki list bullets that would otherwise show as raw text
    const bullet = line.match(/^[\*\-]\s+(.*)$/);
    if (bullet) {
      flushPara();
      content.push({
        type: "bulletList",
        content: [
          {
            type: "listItem",
            content: [
              {
                type: "paragraph",
                content: inlineMarks(bullet[1] ?? ""),
              },
            ],
          },
        ],
      });
      continue;
    }
    paraBuf.push(line);
  }
  flushPara();
  return content;
}

export class JiraClient {
  private readonly baseUrl: string;
  private readonly authHeader: string | null;
  private readonly oauth: JiraClientOAuthOpts | null;

  constructor(
    opts?:
      | { baseUrl?: string; email?: string; apiToken?: string }
      | { oauth: JiraClientOAuthOpts }
  ) {
    if (opts && "oauth" in opts) {
      this.oauth = opts.oauth;
      this.baseUrl = "";
      this.authHeader = null;
      return;
    }

    const baseUrl = opts?.baseUrl ?? process.env.JIRA_BASE_URL ?? "";
    const email = opts?.email ?? process.env.JIRA_EMAIL ?? "";
    const apiToken = opts?.apiToken ?? process.env.JIRA_API_TOKEN ?? "";
    if (!baseUrl || !email || !apiToken) {
      logger.warn("Jira credentials not fully configured");
    }
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.authHeader = `Basic ${Buffer.from(`${email}:${apiToken}`).toString("base64")}`;
    this.oauth = null;
  }

  static fromOAuth(oauth: JiraClientOAuthOpts): JiraClient {
    return new JiraClient({ oauth });
  }

  private async resolveRequestAuth(): Promise<{ baseUrl: string; authHeader: string }> {
    if (this.oauth) {
      const token = await this.oauth.getAccessToken();
      return {
        baseUrl: `https://api.atlassian.com/ex/jira/${this.oauth.cloudId}`,
        authHeader: `Bearer ${token}`,
      };
    }
    if (!this.baseUrl || !this.authHeader) {
      throw new Error("Jira baseUrl not configured");
    }
    return { baseUrl: this.baseUrl, authHeader: this.authHeader };
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const { baseUrl, authHeader } = await this.resolveRequestAuth();
    return retry(async () => {
      const res = await fetch(`${baseUrl}${path}`, {
        ...init,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: authHeader,
          ...(init.headers ?? {}),
        },
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Jira ${init.method ?? "GET"} ${path} ${res.status}: ${body}`);
      }
      if (res.status === 204) return undefined as T;
      return (await res.json()) as T;
    });
  }

  getIssue(jiraKey: string): Promise<unknown> {
    return this.request(`/rest/api/3/issue/${encodeURIComponent(jiraKey)}`);
  }

  getIssueWithFields<T = unknown>(jiraKey: string, fields: string[]): Promise<T> {
    const params = new URLSearchParams();
    if (fields.length > 0) {
      params.set("fields", fields.join(","));
    }
    const suffix = params.toString() ? `?${params}` : "";
    return this.request(
      `/rest/api/3/issue/${encodeURIComponent(jiraKey)}${suffix}`
    );
  }

  async listIssueAttachments(
    jiraKey: string
  ): Promise<Array<{ id: string; filename: string; mimeType: string; size: number }>> {
    const issue = (await this.getIssueWithFields<{
      fields?: {
        attachment?: Array<{
          id?: string;
          filename?: string;
          mimeType?: string;
          size?: number;
        }>;
      };
    }>(jiraKey, ["attachment"])) as {
      fields?: {
        attachment?: Array<{
          id?: string;
          filename?: string;
          mimeType?: string;
          size?: number;
        }>;
      };
    };

    return (issue.fields?.attachment ?? [])
      .filter((a) => a.id && a.filename)
      .map((a) => ({
        id: String(a.id),
        filename: String(a.filename),
        mimeType: String(a.mimeType ?? "application/octet-stream"),
        size: Number(a.size ?? 0),
      }));
  }

  async downloadAttachment(
    attachmentId: string
  ): Promise<{ buffer: Buffer; mimeType: string; filename?: string }> {
    const { baseUrl, authHeader } = await this.resolveRequestAuth();
    const meta = (await this.request<{
      filename?: string;
      mimeType?: string;
    }>(`/rest/api/3/attachment/${encodeURIComponent(attachmentId)}`)) as {
      filename?: string;
      mimeType?: string;
    };

    const res = await fetch(
      `${baseUrl}/rest/api/3/attachment/content/${encodeURIComponent(attachmentId)}`,
      {
        headers: {
          Authorization: authHeader,
          Accept: "*/*",
        },
      }
    );

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Jira attachment download ${attachmentId} ${res.status}: ${body}`);
    }

    const arrayBuffer = await res.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      mimeType: meta.mimeType ?? res.headers.get("content-type") ?? "application/octet-stream",
      filename: meta.filename,
    };
  }

  searchIssues<TIssue = unknown>(
    jql: string,
    options: { fields?: string[]; maxResults?: number } = {}
  ): Promise<JiraIssueSearchResult<TIssue>> {
    const body: Record<string, unknown> = {
      jql,
      maxResults: options.maxResults ?? 10,
      fields: options.fields?.length ? options.fields : ["summary", "status", "issuetype"],
    };
    return this.request("/rest/api/3/search/jql", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  addComment(jiraKey: string, comment: JiraComment): Promise<unknown> {
    return this.request(
      `/rest/api/3/issue/${encodeURIComponent(jiraKey)}/comment`,
      { method: "POST", body: JSON.stringify(comment) }
    );
  }

  addPlainTextComment(jiraKey: string, text: string): Promise<unknown> {
    // Convert wiki/markdown-ish lines into ADF so h2./##/*bold* are not shown raw
    const content = textToAdfContent(text);

    return this.addComment(jiraKey, {
      body: {
        type: "doc",
        version: 1,
        content: content.length
          ? content
          : [{ type: "paragraph", content: [{ type: "text", text }] }],
      },
    });
  }

  async addLabels(jiraKey: string, labelsToAdd: string[]): Promise<void> {
    if (!labelsToAdd.length) return;
    const issue = (await this.getIssue(jiraKey)) as {
      fields?: { labels?: string[] };
    };
    const existing = issue.fields?.labels ?? [];
    const merged = [...new Set([...existing, ...labelsToAdd])];
    await this.request(`/rest/api/3/issue/${encodeURIComponent(jiraKey)}`, {
      method: "PUT",
      body: JSON.stringify({ fields: { labels: merged } }),
    });
  }

  async updateStoryPoints(jiraKey: string, points: number): Promise<void> {
    const fieldId = process.env.JIRA_STORY_POINTS_FIELD;
    if (!fieldId) {
      logger.debug({ jiraKey, points }, "JIRA_STORY_POINTS_FIELD not set — skip story points");
      return;
    }
    await this.request(`/rest/api/3/issue/${encodeURIComponent(jiraKey)}`, {
      method: "PUT",
      body: JSON.stringify({ fields: { [fieldId]: points } }),
    });
  }

  async getTransitions(jiraKey: string): Promise<Array<{ id: string; name: string }>> {
    const data = (await this.request<{
      transitions?: Array<{ id: string; name: string }>;
    }>(`/rest/api/3/issue/${encodeURIComponent(jiraKey)}/transitions`)) as {
      transitions?: Array<{ id: string; name: string }>;
    };
    return data.transitions ?? [];
  }

  async transitionIssue(jiraKey: string, transitionId: string): Promise<void> {
    await this.request(`/rest/api/3/issue/${encodeURIComponent(jiraKey)}/transitions`, {
      method: "POST",
      body: JSON.stringify({ transition: { id: transitionId } }),
    });
  }

  async transitionToStatus(jiraKey: string, statusName: string): Promise<boolean> {
    const normalized = statusName.trim().toLowerCase();
    const transitions = await this.getTransitions(jiraKey);
    const match = transitions.find((t) => t.name.trim().toLowerCase() === normalized);
    if (!match) {
      logger.warn({ jiraKey, statusName, available: transitions.map((t) => t.name) }, "Jira transition not found");
      return false;
    }
    await this.transitionIssue(jiraKey, match.id);
    return true;
  }

  async getIssueLabels(jiraKey: string): Promise<string[]> {
    const issue = (await this.getIssue(jiraKey)) as {
      fields?: { labels?: string[] };
    };
    return issue.fields?.labels ?? [];
  }

  async updateIssueDescription(jiraKey: string, text: string): Promise<void> {
    const body = {
      body: {
        type: "doc",
        version: 1,
        content: text.split(/\n{2,}/).map((block) => ({
          type: "paragraph",
          content: [{ type: "text", text: block.trim() }],
        })),
      },
    };
    await this.request(`/rest/api/3/issue/${encodeURIComponent(jiraKey)}`, {
      method: "PUT",
      body: JSON.stringify({ fields: { description: body } }),
    });
  }

  addAttachmentNote(
    jiraKey: string,
    title: string,
    payload: Record<string, unknown>
  ): Promise<unknown> {
    // Stored as an ADF comment block. Real attachments use a multipart upload;
    // for Phase 1 a structured comment is enough and reversible.
    const body = {
      body: {
        type: "doc",
        version: 1,
        content: [
          {
            type: "heading",
            attrs: { level: 3 },
            content: [{ type: "text", text: title }],
          },
          {
            type: "codeBlock",
            attrs: { language: "json" },
            content: [
              { type: "text", text: JSON.stringify(payload, null, 2) },
            ],
          },
        ],
      },
    };
    return this.addComment(jiraKey, body);
  }

  async createIssue(opts: {
    summary: string;
    description?: string;
    issueType?: string;
    labels?: string[];
    priority?: string;
    projectKey?: string;
  }): Promise<{ key: string; id: string } | null> {
    const projectKey = opts.projectKey ?? process.env.JIRA_DEFAULT_PROJECT_KEY;
    if (!projectKey) {
      logger.warn("createIssue skipped — no project key (set JIRA_DEFAULT_PROJECT_KEY)");
      return null;
    }
    const descText = opts.description ?? opts.summary;
    const body = {
      fields: {
        project: { key: projectKey },
        summary: opts.summary,
        issuetype: { name: opts.issueType ?? "Bug" },
        labels: opts.labels ?? [],
        ...(opts.priority ? { priority: { name: opts.priority } } : {}),
        description: {
          type: "doc",
          version: 1,
          content: descText.split(/\n{2,}/).map((block) => ({
            type: "paragraph",
            content: [{ type: "text", text: block.trim() }],
          })),
        },
      },
    };
    const created = await this.request<{ key: string; id: string }>(
      "/rest/api/3/issue",
      { method: "POST", body: JSON.stringify(body) }
    );
    return created ?? null;
  }
}

export const jiraClient = new JiraClient();
