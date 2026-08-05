import { enqueueFullIndex } from "../codebaseIntelligence/indexQueue";
import {
  getBitbucketRepository,
  listBitbucketRepositories,
  listBitbucketWorkspaces,
} from "../integrations/git/bitbucketOAuth";
import { getPublicOrganizationGitConfig } from "../organization/gitConfigStore";
import { logger } from "../utils/logger";
import {
  getPublicGitCredentials,
  resolveBitbucketAccessToken,
  saveGitCredentialsForOrganization,
  warmOrganizationGitCredentials,
} from "./gitCredentialsStore";

export async function completeBitbucketOAuthAuthorization(input: {
  organizationId: string;
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  scopes?: string;
}) {
  const expiresAt = new Date(Date.now() + input.expiresIn * 1000);
  const { saveOrganizationBitbucketOAuthTokens } = await import(
    "../organization/gitConfigStore"
  );

  let workspace = "";
  let repoSlug = "";
  let username: string | null = null;

  try {
    const workspaces = await listBitbucketWorkspaces(input.accessToken);
    if (workspaces.length === 1) {
      workspace = workspaces[0]!.slug;
      const repos = await listBitbucketRepositories(input.accessToken, workspace);
      if (repos.length === 1) {
        repoSlug = repos[0]!.slug;
      }
    }
  } catch (err) {
    logger.warn({ err }, "bitbucket oauth: list workspaces after authorize failed");
  }

  await saveOrganizationBitbucketOAuthTokens(input.organizationId, {
    accessToken: input.accessToken,
    refreshToken: input.refreshToken,
    tokenExpiresAt: expiresAt,
    scopes: input.scopes,
    workspace,
    repoSlug,
    username,
  });

  await warmOrganizationGitCredentials(input.organizationId);

  let indexRun: { runId: string; queued: boolean } | null = null;
  if (workspace && repoSlug) {
    try {
      const meta = await getBitbucketRepository(
        input.accessToken,
        workspace,
        repoSlug
      );
      await saveGitCredentialsForOrganization(input.organizationId, {
        provider: "bitbucket",
        authMethod: "oauth",
        workspace,
        repoSlug,
        token: input.accessToken,
        accessToken: input.accessToken,
        refreshToken: input.refreshToken,
        tokenExpiresAt: expiresAt,
        scopes: input.scopes,
        defaultBranch: meta.defaultBranch,
      });
      indexRun = await enqueueFullIndex(meta.defaultBranch, "manual");
    } catch (err) {
      logger.warn({ err, workspace, repoSlug }, "bitbucket oauth auto-select index failed");
    }
  }

  const git = await getPublicOrganizationGitConfig(input.organizationId);
  return {
    authorized: true,
    needsRepoSelection: !repoSlug,
    workspace,
    repoSlug,
    git,
    indexQueued: Boolean(indexRun),
    indexRunId: indexRun?.runId ?? null,
  };
}

export async function selectBitbucketRepository(input: {
  organizationId: string;
  workspace: string;
  repo: string;
  defaultBranch?: string;
}) {
  const workspace = input.workspace.trim();
  const repo = input.repo.trim();
  if (!workspace || !repo) {
    throw new Error("workspace and repo are required");
  }

  await warmOrganizationGitCredentials(input.organizationId);
  const { getGitCredentials, activateOrganizationGitContext } = await import(
    "./gitCredentialsStore"
  );
  const { runInOrganizationContextAsync } = await import("../organization/context");

  return runInOrganizationContextAsync(input.organizationId, async () => {
    activateOrganizationGitContext(input.organizationId);
    const creds = getGitCredentials();
    if (creds.provider !== "bitbucket" || creds.authMethod !== "oauth") {
      throw new Error("Bitbucket OAuth is not authorized for this organization");
    }

    const accessToken = await resolveBitbucketAccessToken(creds);
    const meta = await getBitbucketRepository(accessToken, workspace, repo);
    const defaultBranch =
      meta.defaultBranch?.trim() || input.defaultBranch?.trim() || "main";

    await saveGitCredentialsForOrganization(input.organizationId, {
      provider: "bitbucket",
      authMethod: "oauth",
      workspace,
      repoSlug: repo,
      token: accessToken,
      accessToken,
      refreshToken: creds.refreshToken,
      tokenExpiresAt: creds.tokenExpiresAt,
      scopes: creds.scopes,
      defaultBranch,
      username: creds.username,
    });

    let indexRun: { runId: string; queued: boolean } | null = null;
    try {
      indexRun = await enqueueFullIndex(defaultBranch, "manual");
    } catch (err) {
      logger.warn(
        { err, workspace, repo, defaultBranch },
        "bitbucket select-repo index enqueue failed"
      );
    }

    const git = await getPublicOrganizationGitConfig(input.organizationId);
    return {
      connected: true,
      fullName: meta.fullName,
      defaultBranch,
      git,
      indexQueued: Boolean(indexRun),
      indexRunId: indexRun?.runId ?? null,
    };
  });
}

export async function listAuthorizedBitbucketWorkspaces(
  organizationId: string
) {
  await warmOrganizationGitCredentials(organizationId);
  const { runInOrganizationContextAsync } = await import("../organization/context");
  const { activateOrganizationGitContext, getGitCredentials } = await import(
    "./gitCredentialsStore"
  );

  return runInOrganizationContextAsync(organizationId, async () => {
    activateOrganizationGitContext(organizationId);
    const creds = getGitCredentials();
    const accessToken = await resolveBitbucketAccessToken(creds);
    return listBitbucketWorkspaces(accessToken);
  });
}

export async function listAuthorizedBitbucketRepositories(
  organizationId: string,
  workspace: string
) {
  await warmOrganizationGitCredentials(organizationId);
  const { runInOrganizationContextAsync } = await import("../organization/context");
  const { activateOrganizationGitContext, getGitCredentials } = await import(
    "./gitCredentialsStore"
  );

  return runInOrganizationContextAsync(organizationId, async () => {
    activateOrganizationGitContext(organizationId);
    const creds = getGitCredentials();
    const accessToken = await resolveBitbucketAccessToken(creds);
    return listBitbucketRepositories(accessToken, workspace);
  });
}

export { getPublicGitCredentials };
