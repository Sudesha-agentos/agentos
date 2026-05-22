import crypto from "crypto";
import { getDb } from "./sqliteStore";
import { intakeConfig, normalizeJiraBaseUrl } from "./config";

export interface JiraCredentials {
  baseUrl: string;
  email: string;
  apiToken: string;
  boardId: string;
  webhookSecret: string;
}

export interface JiraCredentialsPublic {
  baseUrl: string;
  email: string;
  boardId: string;
  hasApiToken: boolean;
  tokenHint: string | null;
  webhookSecret: string;
  configured: boolean;
  source: "database" | "environment" | "none";
}

function credentialsFromEnv(): JiraCredentials {
  return {
    baseUrl: normalizeJiraBaseUrl(process.env.JIRA_BASE_URL || ""),
    email: (process.env.JIRA_EMAIL || "").trim(),
    apiToken: (process.env.JIRA_API_TOKEN || "").trim(),
    boardId: (process.env.JIRA_BOARD_ID || "").trim(),
    webhookSecret: (process.env.JIRA_WEBHOOK_SECRET || "").trim(),
  };
}

function rowToCredentials(row: {
  base_url: string | null;
  email: string | null;
  api_token: string | null;
  board_id: string | null;
  webhook_secret: string | null;
}): JiraCredentials {
  return {
    baseUrl: row.base_url || "",
    email: row.email || "",
    apiToken: row.api_token || "",
    boardId: row.board_id || "",
    webhookSecret: row.webhook_secret || "",
  };
}

export function applyCredentialsToRuntime(creds: JiraCredentials): void {
  intakeConfig.jira.baseUrl = normalizeJiraBaseUrl(creds.baseUrl);
  intakeConfig.jira.email = creds.email;
  intakeConfig.jira.apiToken = creds.apiToken;
  intakeConfig.jira.boardId = creds.boardId;
  if (creds.webhookSecret) {
    process.env.JIRA_WEBHOOK_SECRET = creds.webhookSecret;
  }
}

export function loadJiraCredentialsFromStore(): JiraCredentials {
  const row = getDb()
    .prepare(
      `SELECT base_url, email, api_token, board_id, webhook_secret
       FROM jira_credentials WHERE singleton_id = 1`
    )
    .get() as
    | {
        base_url: string | null;
        email: string | null;
        api_token: string | null;
        board_id: string | null;
        webhook_secret: string | null;
      }
    | undefined;

  const env = credentialsFromEnv();
  if (!row) {
    applyCredentialsToRuntime(env);
    return env;
  }

  const stored = rowToCredentials(row);
  const merged: JiraCredentials = {
    baseUrl: stored.baseUrl || env.baseUrl,
    email: stored.email || env.email,
    apiToken: stored.apiToken || env.apiToken,
    boardId: stored.boardId || env.boardId,
    webhookSecret: stored.webhookSecret || env.webhookSecret,
  };
  applyCredentialsToRuntime(merged);
  return merged;
}

export function getActiveJiraCredentials(): JiraCredentials {
  return {
    baseUrl: intakeConfig.jira.baseUrl,
    email: intakeConfig.jira.email,
    apiToken: intakeConfig.jira.apiToken,
    boardId: intakeConfig.jira.boardId,
    webhookSecret: process.env.JIRA_WEBHOOK_SECRET || "",
  };
}

export function getWebhookSecret(): string {
  return process.env.JIRA_WEBHOOK_SECRET || getActiveJiraCredentials().webhookSecret;
}

function tokenHint(token: string): string | null {
  if (!token || token.length < 4) return null;
  return `••••${token.slice(-4)}`;
}

export function getPublicJiraCredentials(): JiraCredentialsPublic {
  const row = getDb()
    .prepare(
      `SELECT base_url, email, api_token, board_id, webhook_secret
       FROM jira_credentials WHERE singleton_id = 1`
    )
    .get() as
    | {
        base_url: string | null;
        email: string | null;
        api_token: string | null;
        board_id: string | null;
        webhook_secret: string | null;
      }
    | undefined;

  const env = credentialsFromEnv();
  const stored = row ? rowToCredentials(row) : null;
  const merged = stored
    ? {
        baseUrl: stored.baseUrl || env.baseUrl,
        email: stored.email || env.email,
        apiToken: stored.apiToken || env.apiToken,
        boardId: stored.boardId || env.boardId,
        webhookSecret: stored.webhookSecret || env.webhookSecret,
      }
    : env;

  const configured = Boolean(
    merged.baseUrl && merged.email && merged.apiToken && merged.boardId
  );

  let source: JiraCredentialsPublic["source"] = "none";
  if (configured) {
    source = stored?.apiToken ? "database" : "environment";
  }

  return {
    baseUrl: merged.baseUrl,
    email: merged.email,
    boardId: merged.boardId,
    hasApiToken: Boolean(merged.apiToken),
    tokenHint: tokenHint(merged.apiToken),
    webhookSecret: merged.webhookSecret,
    configured,
    source,
  };
}

export function saveJiraCredentials(input: {
  baseUrl: string;
  email: string;
  apiToken?: string;
  boardId: string;
  webhookSecret?: string;
}): JiraCredentials {
  const existing = getDb()
    .prepare(`SELECT api_token, webhook_secret FROM jira_credentials WHERE singleton_id = 1`)
    .get() as { api_token: string | null; webhook_secret: string | null } | undefined;

  const apiToken =
    input.apiToken?.trim() ||
    existing?.api_token ||
    credentialsFromEnv().apiToken;

  const webhookSecret =
    input.webhookSecret?.trim() ||
    existing?.webhook_secret ||
    credentialsFromEnv().webhookSecret ||
    crypto.randomBytes(18).toString("hex");

  const creds: JiraCredentials = {
    baseUrl: normalizeJiraBaseUrl(input.baseUrl),
    email: input.email.trim(),
    apiToken,
    boardId: String(input.boardId).trim(),
    webhookSecret,
  };

  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO jira_credentials (
        singleton_id, base_url, email, api_token, board_id, webhook_secret, updated_at
      ) VALUES (1, @baseUrl, @email, @apiToken, @boardId, @webhookSecret, @now)
      ON CONFLICT(singleton_id) DO UPDATE SET
        base_url = excluded.base_url,
        email = excluded.email,
        api_token = excluded.api_token,
        board_id = excluded.board_id,
        webhook_secret = excluded.webhook_secret,
        updated_at = excluded.updated_at`
    )
    .run({
      baseUrl: creds.baseUrl,
      email: creds.email,
      apiToken: creds.apiToken,
      boardId: creds.boardId,
      webhookSecret: creds.webhookSecret,
      now,
    });

  applyCredentialsToRuntime(creds);
  return creds;
}
