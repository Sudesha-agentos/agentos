import {
  getGitCredentials,
  getRepoContext,
  resolveBitbucketAccessToken,
  resolveGithubAccessToken,
  type StoredGitCredentials,
} from "../git-integration/gitCredentialsStore";
import {
  createBitbucketProvider,
  createBitbucketProviderFromAuth,
} from "./git/bitbucketProvider";
import { createGithubProvider } from "./git/githubProvider";
import type { GitFileContent, GitProviderClient, GitTreeItem } from "./git/types";

export type { GitFileContent, GitTreeItem, GitProviderId, GitPullRequest, GitPushFile } from "./git/types";

function clientFor(creds: StoredGitCredentials): GitProviderClient {
  if (creds.provider === "bitbucket") {
    if (creds.authMethod === "oauth") {
      return createBitbucketProviderFromAuth({
        kind: "oauth",
        accessToken: creds.accessToken || creds.token,
      });
    }
    const username = creds.username?.trim() || creds.workspace;
    return createBitbucketProvider(username, creds.token);
  }
  return createGithubProvider(() => resolveGithubAccessToken(creds));
}

/** Async factory that refreshes Bitbucket OAuth tokens before building the client. */
export async function getGitClientAsync(): Promise<GitProviderClient> {
  const creds = getGitCredentials();
  if (creds.provider === "bitbucket" && creds.authMethod === "oauth") {
    const accessToken = await resolveBitbucketAccessToken(creds);
    return createBitbucketProviderFromAuth({ kind: "oauth", accessToken });
  }
  return clientFor(creds);
}

export function getGitClient(): GitProviderClient {
  return clientFor(getGitCredentials());
}

/** Backward-compatible facade used by indexer, viz, and QA tools. */
export const gitClient = {
  async getRepoTree(branchName: string): Promise<GitTreeItem[]> {
    const ctx = getRepoContext();
    const client = await getGitClientAsync();
    return client.getRepoTree(ctx, branchName);
  },

  async getFileContent(
    filePath: string,
    branchName: string
  ): Promise<GitFileContent> {
    const ctx = getRepoContext();
    const client = await getGitClientAsync();
    return client.getFileContent(ctx, filePath, branchName);
  },

  async cloneUrl(): Promise<string> {
    const ctx = getRepoContext();
    const client = await getGitClientAsync();
    return client.cloneUrl(ctx);
  },

  async pushFilesToBranch(
    targetBranch: string,
    sourceBranch: string,
    files: import("./git/types").GitPushFile[],
    commitMessage: string
  ): Promise<{ sha: string }> {
    const ctx = getRepoContext();
    const client = await getGitClientAsync();
    return client.pushFilesToBranch(
      ctx,
      targetBranch,
      sourceBranch,
      files,
      commitMessage
    );
  },

  async createPullRequest(
    headBranch: string,
    baseBranch: string,
    title: string,
    body: string,
    draft = true
  ): Promise<import("./git/types").GitPullRequest> {
    const ctx = getRepoContext();
    const client = await getGitClientAsync();
    return client.createPullRequest(
      ctx,
      headBranch,
      baseBranch,
      title,
      body,
      draft
    );
  },

  async updatePullRequest(
    prNumber: number,
    updates: { title?: string; body?: string; draft?: boolean }
  ): Promise<void> {
    const ctx = getRepoContext();
    const client = await getGitClientAsync();
    return client.updatePullRequest(ctx, prNumber, updates);
  },
};
