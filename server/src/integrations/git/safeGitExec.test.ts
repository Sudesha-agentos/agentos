import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertSafeGitRef } from "./safeGitExec";

describe("assertSafeGitRef", () => {
  it("accepts normal branch names", () => {
    assert.equal(assertSafeGitRef("main"), "main");
    assert.equal(assertSafeGitRef("feature/foo-bar"), "feature/foo-bar");
  });

  it("rejects shell metacharacters and path traversal", () => {
    assert.throws(() => assertSafeGitRef("main; rm -rf /"));
    assert.throws(() => assertSafeGitRef("foo$(whoami)"));
    assert.throws(() => assertSafeGitRef("../etc/passwd"));
    assert.throws(() => assertSafeGitRef(""));
  });
});
