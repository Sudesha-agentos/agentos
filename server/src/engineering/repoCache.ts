import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assertSafeGitRef, execFileAsync } from "../integrations/git/safeGitExec";
import { logger } from "../utils/logger";

const locks = new Map<string, Promise<unknown>>();

export function isSharedRepoCacheEnabled(): boolean {
  const raw = process.env.ENGINEERING_SHARED_REPO_CACHE?.trim().toLowerCase();
  return raw !== "0" && raw !== "false" && raw !== "off";
}

export function repoCacheKey(provider: string, workspace: string, repoSlug: string): string {
  const raw = `${provider}/${workspace}/${repoSlug}`.toLowerCase();
  const safe = raw.replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 72);
  const hash = createHash("sha1").update(raw).digest("hex").slice(0, 10);
  return `${safe || "repo"}-${hash}`;
}

function sandboxBase(): string {
  return process.env.SANDBOX_DIR ?? join(tmpdir(), "agentos-qa-sandbox");
}

export function bareMirrorPath(cacheKey: string): string {
  return join(sandboxBase(), "_repo-cache", cacheKey, "bare.git");
}

async function withRepoCacheLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const previous = locks.get(key) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  locks.set(
    key,
    previous.then(() => gate).catch(() => undefined)
  );
  await previous.catch(() => undefined);
  try {
    return await fn();
  } finally {
    release();
  }
}

/** One bare/shallow mirror per connected repo. Worktrees share its object store. */
export async function ensureBareMirror(input: {
  cacheKey: string;
  repoUrl: string;
  sourceBranch: string;
}): Promise<string> {
  const branch = assertSafeGitRef(input.sourceBranch);
  const bareDir = bareMirrorPath(input.cacheKey);
  return withRepoCacheLock(input.cacheKey, async () => {
    const ready = existsSync(join(bareDir, "HEAD"));
    if (!ready) {
      mkdirSync(join(bareDir, ".."), { recursive: true });
      await execFileAsync(
        "git",
        ["clone", "--bare", "--depth", "1", "--branch", branch, input.repoUrl, bareDir],
        { timeout: 180_000 }
      );
      logger.info({ bareDir, cacheKey: input.cacheKey }, "cached bare repo cloned");
    } else {
      await execFileAsync("git", ["-C", bareDir, "remote", "set-url", "origin", input.repoUrl], {
        timeout: 15_000,
      });
      await execFileAsync(
        "git",
        ["-C", bareDir, "fetch", "--depth", "1", "origin", branch],
        { timeout: 120_000 }
      );
    }
    return bareDir;
  });
}

export async function addEngineeringWorktree(input: {
  bareDir: string;
  workspaceDir: string;
  sourceBranch: string;
  targetBranch: string;
}): Promise<void> {
  const source = assertSafeGitRef(input.sourceBranch);
  const target = assertSafeGitRef(input.targetBranch);
  await execFileAsync("git", ["-C", input.bareDir, "worktree", "prune"], { timeout: 15_000 }).catch(
    () => undefined
  );

  try {
    await execFileAsync(
      "git",
      ["-C", input.bareDir, "fetch", "--depth", "1", "origin", target],
      { timeout: 60_000 }
    );
    await execFileAsync(
      "git",
      ["-C", input.bareDir, "worktree", "add", "-B", target, input.workspaceDir, "FETCH_HEAD"],
      { timeout: 30_000 }
    );
    return;
  } catch {
    /* ticket branch is not on the remote yet */
  }

  await execFileAsync(
    "git",
    ["-C", input.bareDir, "worktree", "add", "-B", target, input.workspaceDir, source],
    { timeout: 30_000 }
  );
}

export function removeEngineeringWorktreeSync(bareDir: string, workspaceDir: string): void {
  try {
    execFileSync("git", ["-C", bareDir, "worktree", "remove", "--force", workspaceDir], {
      timeout: 30_000,
    });
  } catch {
    /* directory may already be gone */
  }
  try {
    execFileSync("git", ["-C", bareDir, "worktree", "prune"], { timeout: 15_000 });
  } catch {
    /* ignore */
  }
}
