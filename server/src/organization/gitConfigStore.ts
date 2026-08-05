import { prisma } from "../db/client";
import type { GitAuthMethod, PublicGitCredentials } from "../git-integration/gitCredentialsStore";
import type { GitProviderId } from "../integrations/git/types";

export interface OrganizationGitCredentials {
  provider: GitProviderId;
  workspace: string;
  repoSlug: string;
  username: string | null;
  token: string;
  webhookSecret: string;
  defaultBranch: string;
  installationId: string | null;
  authMethod: GitAuthMethod;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: Date | null;
  scopes: string;
}

function tokenHint(token: string): string | null {
  if (!token || token.length < 8) return null;
  return `${token.slice(0, 4)}…${token.slice(-4)}`;
}

function rowToCredentials(row: {
  provider: string;
  workspace: string;
  repoSlug: string;
  username: string | null;
  token: string;
  webhookSecret: string;
  defaultBranch: string;
  installationId: string | null;
  authMethod: string;
  accessToken?: string | null;
  refreshToken?: string | null;
  tokenExpiresAt?: Date | null;
  scopes?: string | null;
}): OrganizationGitCredentials {
  const accessToken = row.accessToken?.trim() || "";
  const token =
    row.authMethod === "oauth"
      ? accessToken || row.token
      : row.token;

  return {
    provider: row.provider as GitProviderId,
    workspace: row.workspace,
    repoSlug: row.repoSlug,
    username: row.username,
    token,
    webhookSecret: row.webhookSecret,
    defaultBranch: row.defaultBranch,
    installationId: row.installationId,
    authMethod: row.authMethod as GitAuthMethod,
    accessToken,
    refreshToken: row.refreshToken?.trim() || "",
    tokenExpiresAt: row.tokenExpiresAt ?? null,
    scopes: row.scopes?.trim() || "",
  };
}

export async function loadOrganizationGitConfig(
  organizationId: string
): Promise<OrganizationGitCredentials | null> {
  const row = await prisma.organizationGitConfig.findUnique({
    where: { organizationId },
  });
  if (!row) return null;
  return rowToCredentials(row);
}

export async function saveOrganizationGitConfig(
  organizationId: string,
  input: Partial<OrganizationGitCredentials> & { provider?: GitProviderId }
): Promise<OrganizationGitCredentials> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true },
  });
  if (!org) {
    throw new Error(
      "organization_not_found_in_database — sign out, sign in again, and complete workspace onboarding"
    );
  }

  const existing = await prisma.organizationGitConfig.findUnique({
    where: { organizationId },
  });

  const authMethod =
    input.authMethod ?? (existing?.authMethod as GitAuthMethod) ?? "pat";

  const accessToken =
    input.accessToken !== undefined
      ? input.accessToken.trim()
      : existing?.accessToken ?? "";
  const refreshToken =
    input.refreshToken !== undefined
      ? input.refreshToken.trim()
      : existing?.refreshToken ?? "";
  const tokenExpiresAt =
    input.tokenExpiresAt !== undefined
      ? input.tokenExpiresAt
      : existing?.tokenExpiresAt ?? null;
  const scopes =
    input.scopes !== undefined
      ? input.scopes.trim()
      : existing?.scopes ?? "";

  // For OAuth, keep `token` in sync with the current access token so legacy
  // readers that only look at `token` continue to work.
  let token = input.token?.trim() || existing?.token || "";
  if (authMethod === "oauth" && (input.accessToken !== undefined || accessToken)) {
    token = (input.accessToken ?? accessToken).trim() || token;
  }

  const creds: OrganizationGitCredentials = {
    provider: input.provider ?? (existing?.provider as GitProviderId) ?? "github",
    workspace: input.workspace?.trim() ?? existing?.workspace ?? "",
    repoSlug: input.repoSlug?.trim() ?? existing?.repoSlug ?? "",
    username:
      input.username !== undefined ? input.username : existing?.username ?? null,
    token,
    webhookSecret: input.webhookSecret?.trim() || existing?.webhookSecret || "",
    defaultBranch:
      input.defaultBranch?.trim() || existing?.defaultBranch || "main",
    installationId:
      input.installationId !== undefined
        ? input.installationId
        : existing?.installationId ?? null,
    authMethod,
    accessToken,
    refreshToken,
    tokenExpiresAt,
    scopes,
  };

  const shouldUpdateToken =
    Boolean(input.token?.trim()) ||
    (authMethod === "oauth" && input.accessToken !== undefined);

  await prisma.organizationGitConfig.upsert({
    where: { organizationId },
    create: {
      organizationId,
      provider: creds.provider,
      workspace: creds.workspace,
      repoSlug: creds.repoSlug,
      username: creds.username,
      token: creds.token,
      webhookSecret: creds.webhookSecret,
      defaultBranch: creds.defaultBranch,
      installationId: creds.installationId,
      authMethod: creds.authMethod,
      accessToken: creds.accessToken,
      refreshToken: creds.refreshToken,
      tokenExpiresAt: creds.tokenExpiresAt,
      scopes: creds.scopes,
      updatedAt: new Date(),
    },
    update: {
      provider: creds.provider,
      workspace: creds.workspace,
      repoSlug: creds.repoSlug,
      username: creds.username,
      ...(shouldUpdateToken ? { token: creds.token } : {}),
      ...(input.webhookSecret?.trim()
        ? { webhookSecret: creds.webhookSecret }
        : {}),
      defaultBranch: creds.defaultBranch,
      installationId: creds.installationId,
      authMethod: creds.authMethod,
      ...(input.accessToken !== undefined
        ? { accessToken: creds.accessToken }
        : {}),
      ...(input.refreshToken !== undefined
        ? { refreshToken: creds.refreshToken }
        : {}),
      ...(input.tokenExpiresAt !== undefined
        ? { tokenExpiresAt: creds.tokenExpiresAt }
        : {}),
      ...(input.scopes !== undefined ? { scopes: creds.scopes } : {}),
      updatedAt: new Date(),
    },
  });

  return creds;
}

export async function saveOrganizationBitbucketOAuthTokens(
  organizationId: string,
  input: {
    accessToken: string;
    refreshToken?: string;
    tokenExpiresAt: Date;
    scopes?: string;
    workspace?: string;
    repoSlug?: string;
    username?: string | null;
  }
): Promise<OrganizationGitCredentials> {
  return saveOrganizationGitConfig(organizationId, {
    provider: "bitbucket",
    authMethod: "oauth",
    accessToken: input.accessToken,
    refreshToken: input.refreshToken,
    tokenExpiresAt: input.tokenExpiresAt,
    scopes: input.scopes,
    token: input.accessToken,
    workspace: input.workspace,
    repoSlug: input.repoSlug,
    username: input.username,
  });
}

export async function getPublicOrganizationGitConfig(
  organizationId: string
): Promise<PublicGitCredentials> {
  const creds = await loadOrganizationGitConfig(organizationId);
  if (
    !creds ||
    (!creds.token &&
      !creds.accessToken &&
      !creds.installationId &&
      creds.authMethod !== "oauth")
  ) {
    return {
      provider: null,
      workspace: "",
      repoSlug: "",
      username: null,
      hasToken: false,
      tokenHint: null,
      webhookSecret: "",
      defaultBranch: "main",
      configured: false,
      authMethod: null,
      installationId: null,
      source: "none",
    };
  }

  const connected =
    creds.authMethod === "github_app"
      ? Boolean(creds.installationId && creds.workspace && creds.repoSlug)
      : creds.authMethod === "oauth"
        ? Boolean(
            (creds.accessToken || creds.token) &&
              creds.workspace &&
              creds.repoSlug
          )
        : Boolean(creds.token && creds.workspace && creds.repoSlug);

  const displayToken = creds.accessToken || creds.token;

  return {
    provider: creds.provider,
    workspace: creds.workspace,
    repoSlug: creds.repoSlug,
    username: creds.username,
    hasToken:
      Boolean(displayToken) ||
      (creds.authMethod === "github_app" && Boolean(creds.installationId)) ||
      (creds.authMethod === "oauth" && Boolean(creds.refreshToken)),
    tokenHint: displayToken ? tokenHint(displayToken) : null,
    webhookSecret: creds.webhookSecret,
    defaultBranch: creds.defaultBranch,
    configured: connected,
    authMethod: creds.authMethod,
    installationId: creds.installationId,
    source: "database",
    needsRepoSelection:
      creds.authMethod === "oauth" &&
      Boolean(creds.accessToken || creds.refreshToken) &&
      !creds.repoSlug,
  };
}

export async function clearOrganizationGitConfig(organizationId: string): Promise<void> {
  await prisma.organizationGitConfig.deleteMany({ where: { organizationId } });
}

/** Remove all GitHub/Git integration data for a workspace (DB + install + cache). */
export async function purgeOrganizationGitIntegration(
  organizationId: string
): Promise<void> {
  const config = await loadOrganizationGitConfig(organizationId);
  const {
    getGithubInstallForOrganization,
    removeGithubInstallation,
  } = await import("../git-integration/githubInstallationStore");

  const pgInstall = await getGithubInstallForOrganization(organizationId);
  const installationIds = new Set<string>();
  if (config?.installationId) installationIds.add(config.installationId);
  if (pgInstall?.installationId) installationIds.add(pgInstall.installationId);

  const linkedInstalls = await prisma.githubInstallation.findMany({
    where: { organizationId },
    select: { installationId: true },
  });
  for (const row of linkedInstalls) {
    installationIds.add(row.installationId);
  }

  await clearOrganizationGitConfig(organizationId);

  const {
    clearOrganizationGitRuntime,
    activateOrganizationGitContext,
  } = await import("../git-integration/gitCredentialsStore");
  clearOrganizationGitRuntime(organizationId);
  activateOrganizationGitContext(null);

  for (const installationId of installationIds) {
    await removeGithubInstallation(installationId);
  }
}
