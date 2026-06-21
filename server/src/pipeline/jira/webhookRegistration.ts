import { pipelineJiraFetch } from "./client";
import { getActivePipelineJiraCredentials } from "./credentialsStore";

export interface JiraAdminWebhook {
  id?: number;
  name: string;
  url: string;
  enabled?: boolean;
  events?: string[];
  secret?: string;
  self?: string;
}

const WEBHOOK_NAME = "AgentOS Pipeline";

function escapeJqlString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function normalizeWebhookUrl(url: string): string {
  return url.replace(/\/$/, "");
}

function oauthWebhookErrorMessage(err: unknown, webhookUrl: string): Error {
  if (!webhookUrl.startsWith("https://")) {
    return new Error(
      "Jira requires an HTTPS webhook URL. Set PUBLIC_API_URL to your Render HTTPS URL."
    );
  }
  const message = err instanceof Error ? err.message : String(err);
  if (/scope does not match/i.test(message)) {
    return new Error(
      "Jira OAuth token is missing webhook scopes. Disconnect Jira, redeploy the server, then Connect with Atlassian again."
    );
  }
  if (message.includes("403") || message.includes("401")) {
    return new Error(
      "Jira rejected webhook registration. Disconnect and reconnect Jira with manage:jira-webhook enabled in your Atlassian app."
    );
  }
  return err instanceof Error ? err : new Error(message);
}

// --- Admin webhooks (API token / site URL) — /rest/webhooks/1.0/webhook ---

export async function listPipelineAdminWebhooks(): Promise<JiraAdminWebhook[]> {
  const data = (await pipelineJiraFetch("/rest/webhooks/1.0/webhook")) as
    | JiraAdminWebhook[]
    | { values?: JiraAdminWebhook[] };
  if (Array.isArray(data)) return data;
  return data?.values ?? [];
}

export async function findPipelineWebhookByUrl(
  targetUrl: string
): Promise<JiraAdminWebhook | null> {
  const hooks = await listPipelineAdminWebhooks();
  const normalized = normalizeWebhookUrl(targetUrl);
  return hooks.find((h) => normalizeWebhookUrl(h.url ?? "") === normalized) ?? null;
}

export async function registerPipelineAdminWebhook(input: {
  webhookUrl: string;
  secret: string;
  projectKey?: string | null;
}): Promise<JiraAdminWebhook> {
  const existing = await findPipelineWebhookByUrl(input.webhookUrl);
  if (existing) return existing;

  const jqlFilter = input.projectKey
    ? `project = "${escapeJqlString(input.projectKey)}"`
    : undefined;

  const body: Record<string, unknown> = {
    name: WEBHOOK_NAME,
    description: "AgentOS — full Jira sync, AI Worker intake, and RAG embedding",
    url: input.webhookUrl,
    excludeBody: false,
    enabled: true,
    events: ["jira:issue_created", "jira:issue_updated", "jira:issue_deleted"],
    secret: input.secret,
  };

  if (jqlFilter) {
    body.filters = { "issue-related-events-section": jqlFilter };
  }

  return (await pipelineJiraFetch("/rest/webhooks/1.0/webhook", {
    method: "POST",
    body: JSON.stringify(body),
  })) as JiraAdminWebhook;
}

// --- Dynamic webhooks (OAuth 2.0) — POST /rest/api/3/webhook ---

interface DynamicWebhookListItem {
  id?: number;
  url?: string;
}

interface DynamicWebhookRegisterResult {
  createdWebhookId?: number;
  errors?: string[];
}

async function listDynamicWebhooks(): Promise<DynamicWebhookListItem[]> {
  const data = (await pipelineJiraFetch(
    "/rest/api/3/webhook?maxResults=100"
  )) as { values?: DynamicWebhookListItem[] } | DynamicWebhookListItem[];
  if (Array.isArray(data)) return data;
  return data?.values ?? [];
}

async function findDynamicWebhookByUrl(
  targetUrl: string
): Promise<DynamicWebhookListItem | null> {
  const hooks = await listDynamicWebhooks();
  const normalized = normalizeWebhookUrl(targetUrl);
  return (
    hooks.find((h) => normalizeWebhookUrl(h.url ?? "") === normalized) ?? null
  );
}

async function registerDynamicOAuthWebhook(input: {
  webhookUrl: string;
  projectKey?: string | null;
}): Promise<JiraAdminWebhook> {
  const existing = await findDynamicWebhookByUrl(input.webhookUrl);
  if (existing?.id != null) {
    return {
      id: existing.id,
      name: WEBHOOK_NAME,
      url: input.webhookUrl,
      enabled: true,
    };
  }

  const jqlFilter = input.projectKey?.trim()
    ? `project = "${escapeJqlString(input.projectKey.trim())}"`
    : "project IS NOT EMPTY";

  const results = (await pipelineJiraFetch("/rest/api/3/webhook", {
    method: "POST",
    body: JSON.stringify({
      url: input.webhookUrl,
      webhooks: [
        {
          jqlFilter,
          events: [
            "jira:issue_created",
            "jira:issue_updated",
            "jira:issue_deleted",
          ],
        },
      ],
    }),
  })) as DynamicWebhookRegisterResult[];

  const first = results?.[0];
  if (first?.errors?.length) {
    throw new Error(first.errors.join("; "));
  }
  if (first?.createdWebhookId == null) {
    throw new Error("Jira did not return a webhook ID for dynamic registration");
  }

  return {
    id: first.createdWebhookId,
    name: WEBHOOK_NAME,
    url: input.webhookUrl,
    enabled: true,
  };
}

export async function ensurePipelineJiraWebhook(input: {
  webhookUrl: string;
  secret: string;
  projectKey?: string | null;
}): Promise<{ registered: boolean; webhook: JiraAdminWebhook; created: boolean }> {
  const creds = getActivePipelineJiraCredentials();

  if (creds.authMethod === "oauth") {
    const existing = await findDynamicWebhookByUrl(input.webhookUrl);
    if (existing?.id != null) {
      return {
        registered: true,
        webhook: {
          id: existing.id,
          name: WEBHOOK_NAME,
          url: input.webhookUrl,
          enabled: true,
        },
        created: false,
      };
    }

    try {
      const webhook = await registerDynamicOAuthWebhook(input);
      return { registered: true, webhook, created: true };
    } catch (err) {
      throw oauthWebhookErrorMessage(err, input.webhookUrl);
    }
  }

  const existing = await findPipelineWebhookByUrl(input.webhookUrl);
  if (existing) {
    return { registered: true, webhook: existing, created: false };
  }

  try {
    const webhook = await registerPipelineAdminWebhook(input);
    return { registered: true, webhook, created: true };
  } catch (err) {
    throw oauthWebhookErrorMessage(err, input.webhookUrl);
  }
}
