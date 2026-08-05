import { retry } from "../../utils/retry";
import { normalizePushFiles } from "./normalizePushFiles";
import type {
  GitFileContent,
  GitProviderClient,
  GitPullRequest,
  GitRepoContext,
  GitTreeItem,
} from "./types";

const API_BASE = "https://api.bitbucket.org/2.0";

type BitbucketEntry = {
  path: string;
  type: "commit_file" | "commit_directory";
  size?: number;
};

export type BitbucketAuth =
  | { kind: "oauth"; accessToken: string }
  | { kind: "basic"; username: string; appPassword: string };

function authHeaders(auth: BitbucketAuth): Record<string, string> {
  if (auth.kind === "oauth") {
    return { Authorization: `Bearer ${auth.accessToken}` };
  }
  return {
    Authorization: `Basic ${Buffer.from(
      `${auth.username}:${auth.appPassword}`
    ).toString("base64")}`,
  };
}

/** @deprecated Prefer createBitbucketProviderFromAuth. */
export function createBitbucketProvider(
  username: string,
  appPassword: string
): GitProviderClient {
  return createBitbucketProviderFromAuth({
    kind: "basic",
    username,
    appPassword,
  });
}

export function createBitbucketProviderFromAuth(
  auth: BitbucketAuth
): GitProviderClient {
  async function bbFetch<T>(
    path: string,
    init?: RequestInit & { rawBody?: boolean }
  ): Promise<T> {
    return retry(async () => {
      const res = await fetch(`${API_BASE}${path}`, {
        ...init,
        headers: {
          ...authHeaders(auth),
          Accept: "application/json",
          ...(init?.headers ?? {}),
        },
      });
      if (!res.ok) {
        throw new Error(`Bitbucket API ${res.status}: ${await res.text()}`);
      }
      if (init?.rawBody) {
        return res as unknown as T;
      }
      const text = await res.text();
      if (!text) return {} as T;
      return JSON.parse(text) as T;
    });
  }

  async function listDir(
    ctx: GitRepoContext,
    branchName: string,
    dirPath: string
  ): Promise<BitbucketEntry[]> {
    const suffix = dirPath ? `/${dirPath}` : "";
    const data = await bbFetch<{ values: BitbucketEntry[]; next?: string }>(
      `/repositories/${ctx.workspace}/${ctx.repoSlug}/src/${encodeURIComponent(branchName)}${suffix}?pagelen=100`
    );
    let values = data.values ?? [];
    let next: string | undefined = data.next;
    while (next) {
      const nextUrl = next;
      const page = await retry(async () => {
        const res = await fetch(nextUrl, {
          headers: { ...authHeaders(auth), Accept: "application/json" },
        });
        if (!res.ok) throw new Error(`Bitbucket API ${res.status}`);
        return (await res.json()) as { values: BitbucketEntry[]; next?: string };
      });
      values = values.concat(page.values ?? []);
      next = page.next;
    }
    return values;
  }

  async function walkTree(
    ctx: GitRepoContext,
    branchName: string,
    dirPath: string,
    acc: GitTreeItem[]
  ): Promise<void> {
    const entries = await listDir(ctx, branchName, dirPath);
    for (const entry of entries) {
      if (entry.type === "commit_directory") {
        await walkTree(ctx, branchName, entry.path, acc);
      } else {
        acc.push({
          path: entry.path,
          type: "blob",
          sha: entry.path,
          size: entry.size,
        });
      }
    }
  }

  async function getBranchTip(
    ctx: GitRepoContext,
    branchName: string
  ): Promise<string | null> {
    const res = await fetch(
      `${API_BASE}/repositories/${ctx.workspace}/${ctx.repoSlug}/refs/branches/${encodeURIComponent(branchName)}`,
      { headers: { ...authHeaders(auth), Accept: "application/json" } }
    );
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new Error(`Bitbucket API ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as { target?: { hash?: string } };
    return data.target?.hash?.trim() || null;
  }

  return {
    provider: "bitbucket",

    async testConnection(ctx) {
      const data = await bbFetch<{
        full_name: string;
        mainbranch?: { name?: string };
      }>(`/repositories/${ctx.workspace}/${ctx.repoSlug}`);
      return {
        fullName: data.full_name,
        defaultBranch: data.mainbranch?.name,
      };
    },

    async branchExists(ctx, branchName) {
      const tip = await getBranchTip(ctx, branchName);
      return Boolean(tip);
    },

    async getRepoTree(ctx, branchName) {
      const items: GitTreeItem[] = [];
      await walkTree(ctx, branchName, "", items);
      return items;
    },

    async getFileContent(ctx, filePath, branchName) {
      const res = await retry(async () => {
        const url = `${API_BASE}/repositories/${ctx.workspace}/${ctx.repoSlug}/src/${encodeURIComponent(branchName)}/${filePath}`;
        const response = await fetch(url, {
          headers: { ...authHeaders(auth) },
        });
        if (!response.ok) {
          throw new Error(
            `Bitbucket API ${response.status}: ${await response.text()}`
          );
        }
        return response;
      });
      const content = await res.text();
      return {
        path: filePath,
        sha: filePath,
        size: content.length,
        content,
      } satisfies GitFileContent;
    },

    async cloneUrl(ctx) {
      if (auth.kind === "oauth") {
        return `https://x-token-auth:${encodeURIComponent(auth.accessToken)}@bitbucket.org/${ctx.workspace}/${ctx.repoSlug}.git`;
      }
      return `https://${encodeURIComponent(auth.username)}:${encodeURIComponent(auth.appPassword)}@bitbucket.org/${ctx.workspace}/${ctx.repoSlug}.git`;
    },

    async pushFilesToBranch(ctx, targetBranch, sourceBranch, files, commitMessage) {
      const pushFiles = normalizePushFiles(files);

      const sourceTip = await getBranchTip(ctx, sourceBranch);
      if (!sourceTip) {
        throw new Error(
          `Bitbucket source branch not found: ${sourceBranch}`
        );
      }

      const targetTip = await getBranchTip(ctx, targetBranch);
      const parentSha = targetTip ?? sourceTip;

      const form = new FormData();
      form.append("message", commitMessage);
      form.append("branch", targetBranch);
      form.append("parents", parentSha);

      for (const file of pushFiles) {
        // Bitbucket expects the form field name to be the repo-relative path.
        form.append(file.filePath, file.content);
      }

      const res = await retry(async () => {
        const response = await fetch(
          `${API_BASE}/repositories/${ctx.workspace}/${ctx.repoSlug}/src`,
          {
            method: "POST",
            headers: authHeaders(auth),
            body: form,
          }
        );
        if (!response.ok) {
          throw new Error(
            `Bitbucket commit failed (${response.status}): ${await response.text()}`
          );
        }
        return response;
      });

      // Bitbucket often returns 201 with empty body + Location pointing at the commit
      const location = res.headers.get("location") ?? res.headers.get("Location");
      let sha = parentSha;
      if (location) {
        const match = location.match(/\/commit\/([0-9a-f]{7,40})/i);
        if (match?.[1]) sha = match[1];
      } else {
        const newTip = await getBranchTip(ctx, targetBranch);
        if (newTip) sha = newTip;
      }

      return { sha };
    },

    async createPullRequest(ctx, headBranch, baseBranch, title, body, draft = true) {
      const prTitle =
        draft && !/^draft:\s*/i.test(title) ? `Draft: ${title}` : title;

      const pr = await bbFetch<{
        id: number;
        title: string;
        state: string;
        links?: { html?: { href?: string } };
      }>(`/repositories/${ctx.workspace}/${ctx.repoSlug}/pullrequests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: prTitle,
          description: body,
          source: { branch: { name: headBranch } },
          destination: { branch: { name: baseBranch } },
          close_source_branch: false,
        }),
      });

      return {
        number: pr.id,
        url: pr.links?.html?.href ?? "",
        title: pr.title,
        state: pr.state?.toLowerCase() === "open" ? "open" : pr.state,
        draft: Boolean(draft),
      } satisfies GitPullRequest;
    },

    async updatePullRequest(ctx, prNumber, updates) {
      const existing = await bbFetch<{
        title: string;
        description?: string;
      }>(
        `/repositories/${ctx.workspace}/${ctx.repoSlug}/pullrequests/${prNumber}`
      );

      let title = updates.title ?? existing.title;
      if (updates.draft === false && /^draft:\s*/i.test(title)) {
        title = title.replace(/^draft:\s*/i, "");
      } else if (
        updates.draft === true &&
        !/^draft:\s*/i.test(title)
      ) {
        title = `Draft: ${title}`;
      }

      await bbFetch(
        `/repositories/${ctx.workspace}/${ctx.repoSlug}/pullrequests/${prNumber}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            description:
              updates.body !== undefined ? updates.body : existing.description ?? "",
          }),
        }
      );
    },
  };
}
