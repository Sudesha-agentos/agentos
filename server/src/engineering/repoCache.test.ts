import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  addEngineeringWorktree,
  bareMirrorPath,
  ensureBareMirror,
  removeEngineeringWorktreeSync,
  repoCacheKey,
} from "./repoCache";

describe("repoCache", () => {
  it("builds a stable cache key per provider/repo", () => {
    const a = repoCacheKey("github", "Acme", "App");
    const b = repoCacheKey("github", "acme", "app");
    const c = repoCacheKey("github", "acme", "other");
    assert.equal(a, b);
    assert.notEqual(a, c);
  });

  it("shares objects across two worktrees of the same repo", async () => {
    const root = mkdtempSync(join(tmpdir(), "repo-cache-"));
    const origin = join(root, "origin");
    mkdirSync(origin);
    execFileSync("git", ["-C", origin, "init", "-b", "main"]);
    execFileSync("git", ["-C", origin, "config", "user.email", "test@agentos"]);
    execFileSync("git", ["-C", origin, "config", "user.name", "test"]);
    writeFileSync(join(origin, "readme.md"), "hello\n");
    execFileSync("git", ["-C", origin, "add", "readme.md"]);
    execFileSync("git", ["-C", origin, "commit", "-m", "init"]);

    const prev = process.env.SANDBOX_DIR;
    process.env.SANDBOX_DIR = join(root, "sandbox");
    try {
      const cacheKey = repoCacheKey("github", "acme", "app");
      const bareDir = await ensureBareMirror({
        cacheKey,
        repoUrl: origin,
        sourceBranch: "main",
      });
      assert.ok(existsSync(join(bareDir, "HEAD")));

      const first = join(root, "wt-1");
      const second = join(root, "wt-2");
      await addEngineeringWorktree({
        bareDir,
        workspaceDir: first,
        sourceBranch: "main",
        targetBranch: "agentos/one",
      });
      await addEngineeringWorktree({
        bareDir,
        workspaceDir: second,
        sourceBranch: "main",
        targetBranch: "agentos/two",
      });
      assert.match(readFileSync(join(first, "readme.md"), "utf8"), /hello/);
      assert.match(readFileSync(join(second, "readme.md"), "utf8"), /hello/);
      assert.equal(bareMirrorPath(cacheKey), bareDir);

      removeEngineeringWorktreeSync(bareDir, first);
      assert.equal(existsSync(first), false);
      assert.ok(existsSync(second));
    } finally {
      if (prev === undefined) delete process.env.SANDBOX_DIR;
      else process.env.SANDBOX_DIR = prev;
      rmSync(root, { recursive: true, force: true });
    }
  });
});
