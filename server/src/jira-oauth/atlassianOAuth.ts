const ATLASSIAN_AUTH_BASE = "https://auth.atlassian.com";

/**
 * OAuth 2.0 (3LO) scopes for AgentOS Jira integration.
 *
 * Classic scopes cover platform REST (issues, comments, transitions).
 * Granular scopes are required since Atlassian's 2024 migration:
 * - read:jql:jira — POST /rest/api/3/search/jql (intake scan, AI Worker column)
 * - read:project:jira — project list
 * - read:board-scope:* — Agile board + column configuration
 *
 * Enable the same permissions in the Atlassian Developer Console, then
 * disconnect and reconnect Jira in each org (old tokens won't gain new scopes).
 */
export const ATLASSIAN_JIRA_SCOPES = [
  // Classic — issues, comments, transitions, webhooks
  "read:jira-work",
  "write:jira-work",
  "read:jira-user",
  "manage:jira-webhook",
  "offline_access",
  // Granular — JQL search (required for /rest/api/3/search/jql)
  "read:jql:jira",
  "validate:jql:jira",
  // Granular — projects, boards, issues (pipeline board picker + intake)
  "read:project:jira",
  "read:board-scope:jira-software",
  "read:board-scope.admin:jira-software",
  "read:issue:jira-software",
] as const;

export type AtlassianTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  token_type?: string;
};

export function isAtlassianOAuthConfigured(): boolean {
  return Boolean(
    process.env.ATLASSIAN_CLIENT_ID?.trim() &&
      process.env.ATLASSIAN_CLIENT_SECRET?.trim()
  );
}

export function atlassianOAuthRedirectUri(reqBase?: string): string {
  const configured = process.env.ATLASSIAN_OAUTH_REDIRECT_URI?.trim();
  if (configured) return configured.replace(/\/$/, "");
  if (reqBase) return `${reqBase.replace(/\/$/, "")}/api/jira/oauth/callback`;
  const publicApi = process.env.PUBLIC_API_URL?.trim();
  if (publicApi) return `${publicApi.replace(/\/$/, "")}/api/jira/oauth/callback`;
  return "http://localhost:4000/api/jira/oauth/callback";
}

export function buildAtlassianAuthorizeUrl(state: string, redirectUri: string): string {
  const clientId = process.env.ATLASSIAN_CLIENT_ID?.trim();
  if (!clientId) {
    throw new Error("ATLASSIAN_CLIENT_ID is not configured");
  }

  const params = new URLSearchParams({
    audience: "api.atlassian.com",
    client_id: clientId,
    scope: ATLASSIAN_JIRA_SCOPES.join(" "),
    redirect_uri: redirectUri,
    state,
    response_type: "code",
    prompt: "consent",
  });

  return `${ATLASSIAN_AUTH_BASE}/authorize?${params}`;
}

async function postTokenRequest(
  body: Record<string, string>
): Promise<AtlassianTokenResponse> {
  const clientId = process.env.ATLASSIAN_CLIENT_ID?.trim();
  const clientSecret = process.env.ATLASSIAN_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error("Atlassian OAuth client credentials are not configured");
  }

  const res = await fetch(`${ATLASSIAN_AUTH_BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      grant_type: body.grant_type,
      client_id: clientId,
      client_secret: clientSecret,
      ...body,
    }),
  });

  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    const obj = data as { error_description?: string; message?: string } | null;
    const msg =
      obj?.error_description || obj?.message || text || res.statusText;
    throw new Error(`Atlassian token exchange failed (${res.status}): ${msg}`);
  }

  return data as AtlassianTokenResponse;
}

export async function exchangeAtlassianCode(
  code: string,
  redirectUri: string
): Promise<AtlassianTokenResponse> {
  return postTokenRequest({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });
}

export async function refreshAtlassianToken(
  refreshToken: string
): Promise<AtlassianTokenResponse> {
  return postTokenRequest({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
}
