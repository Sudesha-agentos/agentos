import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { createBitbucketProviderFromAuth } from "./bitbucketProvider";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("bitbucketProvider write methods", () => {
  const ctx = {
    provider: "bitbucket" as const,
    workspace: "acme",
    repoSlug: "demo",
    defaultBranch: "main",
  };

  it("creates a pull request with Draft: title prefix when draft=true", async () => {
    const calls: Array<{ url: string; body: unknown }> = [];
    globalThis.fetch = (async (url, init) => {
      const parsed = init?.body ? JSON.parse(String(init.body)) : null;
      calls.push({ url: String(url), body: parsed });
      return new Response(
        JSON.stringify({
          id: 42,
          title: parsed.title,
          state: "OPEN",
          links: { html: { href: "https://bitbucket.org/acme/demo/pull-requests/42" } },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as typeof fetch;

    const client = createBitbucketProviderFromAuth({
      kind: "oauth",
      accessToken: "tok",
    });
    const pr = await client.createPullRequest(
      ctx,
      "feature/x",
      "main",
      "Add feature",
      "body",
      true
    );

    assert.equal(pr.number, 42);
    assert.equal(pr.draft, true);
    assert.equal(pr.title, "Draft: Add feature");
    assert.ok(String(calls[0]?.url).includes("/pullrequests"));
    assert.equal((calls[0]?.body as { title: string }).title, "Draft: Add feature");
  });

  it("pushes files via multipart /src commit", async () => {
    const calls: Array<{ url: string; method?: string }> = [];
    globalThis.fetch = (async (url, init) => {
      const u = String(url);
      calls.push({ url: u, method: init?.method });

      if (u.includes("/refs/branches/main")) {
        return new Response(
          JSON.stringify({ target: { hash: "abc1234567890" } }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (u.includes("/refs/branches/feature%2Fx") || u.includes("/refs/branches/feature/x")) {
        return new Response("not found", { status: 404 });
      }
      if (u.endsWith("/src") && init?.method === "POST") {
        assert.ok(init.body instanceof FormData);
        const form = init.body as FormData;
        assert.equal(form.get("message"), "test commit");
        assert.equal(form.get("branch"), "feature/x");
        assert.equal(form.get("parents"), "abc1234567890");
        return new Response(null, {
          status: 201,
          headers: {
            Location:
              "https://api.bitbucket.org/2.0/repositories/acme/demo/commit/deadbeef",
          },
        });
      }
      return new Response("unexpected", { status: 500 });
    }) as typeof fetch;

    const client = createBitbucketProviderFromAuth({
      kind: "oauth",
      accessToken: "tok",
    });
    const result = await client.pushFilesToBranch(
      ctx,
      "feature/x",
      "main",
      [{ filePath: "README.md", content: "# hi\n" }],
      "test commit"
    );

    assert.equal(result.sha, "deadbeef");
    assert.ok(calls.some((c) => c.url.endsWith("/src") && c.method === "POST"));
  });

  it("builds x-token-auth clone URL for OAuth", async () => {
    const client = createBitbucketProviderFromAuth({
      kind: "oauth",
      accessToken: "tok-value",
    });
    const url = await client.cloneUrl(ctx);
    assert.equal(
      url,
      "https://x-token-auth:tok-value@bitbucket.org/acme/demo.git"
    );
  });
});
