import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeGithubAppSlug } from "./githubApp";

describe("normalizeGithubAppSlug", () => {
  it("extracts the slug from the GitHub App public link", () => {
    assert.equal(
      normalizeGithubAppSlug("https://github.com/apps/agentox-ananta"),
      "agentox-ananta"
    );
  });

  it("rejects an App ID used as the slug", () => {
    assert.equal(normalizeGithubAppSlug("3978281"), null);
  });

  it("lowercases a bare slug", () => {
    assert.equal(normalizeGithubAppSlug("AgentOX-Ananta"), "agentox-ananta");
  });
});
