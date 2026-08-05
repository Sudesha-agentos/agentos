/**
 * Bitbucket Cloud OAuth 2.0 (3-LO) consumer helpers.
 *
 * @see https://support.atlassian.com/bitbucket-cloud/docs/use-oauth-on-bitbucket-cloud/
 *
 * Scopes are configured on the OAuth consumer in Bitbucket Workspace Settings →
 * Apps and features → OAuth consumers. Recommended scopes:
 *   repository, repository:write, pullrequest, pullrequest:write, webhook
 */

const BITBUCKET_AUTH_BASE = "https://bitbucket.org/site/oauth2";
const BITBUCKET_API_BASE = "https://api.bitbucket.org/2.0";

export type BitbucketTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scopes?: string;
  token_type?: string;
};

export type BitbucketWorkspace = {
  slug: string;
  name: string;
  uuid: string;
};

export type BitbucketRepository = {
  slug: string;
  name: string;
  fullName: string;
  uuid: string;
  defaultBranch: string;
  isPrivate: boolean;
};

export function isBitbucketOAuthConfigured(): boolean {
  return Boolean(
    process.env.BITBUCKET_OAUTH_CLIENT_ID?.trim() &&
      process.env.BITBUCKET_OAUTH_CLIENT_SECRET?.trim()
  );
}

/** Alias used by setup/routes — matches Atlassian naming style. */
export function isBitbucketOAuthEnabled(): boolean {
  return isBitbucketOAuthConfigured();
}

export function bitbucketOAuthRedirectUri(reqBase?: string): string {
  const configured = process.env.BITBUCKET_OAUTH_REDIRECT_URI?.trim();
  if (configured) return configured.replace(/\/$/, "");
  if (reqBase) {
    return `${reqBase.replace(/\/$/, "")}/api/git-integration/oauth/bitbucket/callback`;
  }
  const publicApi = process.env.PUBLIC_API_URL?.trim();
  if (publicApi) {
    return `${publicApi.replace(/\/$/, "")}/api/git-integration/oauth/bitbucket/callback`;
  }
  return "http://localhost:4000/api/git-integration/oauth/bitbucket/callback";
}

export function buildBitbucketAuthorizeUrl(state: string): string {
  const clientId = process.env.BITBUCKET_OAUTH_CLIENT_ID?.trim();
  if (!clientId) {
    throw new Error("BITBUCKET_OAUTH_CLIENT_ID is not configured");
  }

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    state,
  });

  return `${BITBUCKET_AUTH_BASE}/authorize?${params}`;
}

function basicAuthHeader(): string {
  const clientId = process.env.BITBUCKET_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.BITBUCKET_OAUTH_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error("Bitbucket OAuth client credentials are not configured");
  }
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
}

async function postTokenRequest(
  body: URLSearchParams
): Promise<BitbucketTokenResponse> {
  const res = await fetch(`${BITBUCKET_AUTH_BASE}/access_token`, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
  });

  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    const obj = data as { error_description?: string; error?: string } | null;
    const msg =
      obj?.error_description || obj?.error || text || res.statusText;
    throw new Error(`Bitbucket token exchange failed (${res.status}): ${msg}`);
  }

  return data as BitbucketTokenResponse;
}

export async function exchangeBitbucketCode(
  code: string
): Promise<BitbucketTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
  });
  return postTokenRequest(body);
}

export async function refreshBitbucketToken(
  refreshToken: string
): Promise<BitbucketTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  return postTokenRequest(body);
}

async function bbApiFetch<T>(
  accessToken: string,
  path: string
): Promise<T> {
  const res = await fetch(`${BITBUCKET_API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    throw new Error(`Bitbucket API ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as T;
}

type Paginated<T> = { values?: T[]; next?: string };

async function bbApiFetchAllPages<T>(
  accessToken: string,
  path: string
): Promise<T[]> {
  const first = await bbApiFetch<Paginated<T>>(accessToken, path);
  let values = first.values ?? [];
  let next = first.next;
  while (next) {
    const res = await fetch(next, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });
    if (!res.ok) {
      throw new Error(`Bitbucket API ${res.status}: ${await res.text()}`);
    }
    const page = (await res.json()) as Paginated<T>;
    values = values.concat(page.values ?? []);
    next = page.next;
  }
  return values;
}

export async function listBitbucketWorkspaces(
  accessToken: string
): Promise<BitbucketWorkspace[]> {
  type Row = {
    workspace?: { slug?: string; name?: string; uuid?: string };
    permission?: string;
  };
  const rows = await bbApiFetchAllPages<Row>(
    accessToken,
    "/user/permissions/workspaces?pagelen=100"
  );
  return rows
    .map((row) => {
      const ws = row.workspace;
      if (!ws?.slug) return null;
      return {
        slug: ws.slug,
        name: ws.name ?? ws.slug,
        uuid: ws.uuid ?? "",
      } satisfies BitbucketWorkspace;
    })
    .filter((w): w is BitbucketWorkspace => Boolean(w));
}

export async function listBitbucketRepositories(
  accessToken: string,
  workspace: string
): Promise<BitbucketRepository[]> {
  type Row = {
    slug?: string;
    name?: string;
    full_name?: string;
    uuid?: string;
    is_private?: boolean;
    mainbranch?: { name?: string };
  };
  const rows = await bbApiFetchAllPages<Row>(
    accessToken,
    `/repositories/${encodeURIComponent(workspace)}?pagelen=100&role=member`
  );
  return rows
    .map((row) => {
      if (!row.slug) return null;
      return {
        slug: row.slug,
        name: row.name ?? row.slug,
        fullName: row.full_name ?? `${workspace}/${row.slug}`,
        uuid: row.uuid ?? "",
        defaultBranch: row.mainbranch?.name?.trim() || "main",
        isPrivate: Boolean(row.is_private),
      } satisfies BitbucketRepository;
    })
    .filter((r): r is BitbucketRepository => Boolean(r));
}

export async function getBitbucketRepository(
  accessToken: string,
  workspace: string,
  repoSlug: string
): Promise<BitbucketRepository> {
  const data = await bbApiFetch<{
    slug?: string;
    name?: string;
    full_name?: string;
    uuid?: string;
    is_private?: boolean;
    mainbranch?: { name?: string };
  }>(
    accessToken,
    `/repositories/${encodeURIComponent(workspace)}/${encodeURIComponent(repoSlug)}`
  );
  return {
    slug: data.slug ?? repoSlug,
    name: data.name ?? repoSlug,
    fullName: data.full_name ?? `${workspace}/${repoSlug}`,
    uuid: data.uuid ?? "",
    defaultBranch: data.mainbranch?.name?.trim() || "main",
    isPrivate: Boolean(data.is_private),
  };
}
