import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  buildBitbucketAuthorizeUrl,
  exchangeBitbucketCode,
  isBitbucketOAuthConfigured,
  refreshBitbucketToken,
} from "./bitbucketOAuth";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  delete process.env.BITBUCKET_OAUTH_CLIENT_ID;
  delete process.env.BITBUCKET_OAUTH_CLIENT_SECRET;
});

describe("bitbucketOAuth", () => {
  it("reports configured only when client id and secret are set", () => {
    assert.equal(isBitbucketOAuthConfigured(), false);
    process.env.BITBUCKET_OAUTH_CLIENT_ID = "key";
    assert.equal(isBitbucketOAuthConfigured(), false);
    process.env.BITBUCKET_OAUTH_CLIENT_SECRET = "secret";
    assert.equal(isBitbucketOAuthConfigured(), true);
  });

  it("builds authorize URL with client_id, response_type, and state", () => {
    process.env.BITBUCKET_OAUTH_CLIENT_ID = "my-client";
    process.env.BITBUCKET_OAUTH_CLIENT_SECRET = "secret";
    const url = buildBitbucketAuthorizeUrl("signed-state");
    assert.ok(url.startsWith("https://bitbucket.org/site/oauth2/authorize?"));
    const params = new URL(url).searchParams;
    assert.equal(params.get("client_id"), "my-client");
    assert.equal(params.get("response_type"), "code");
    assert.equal(params.get("state"), "signed-state");
  });

  it("exchanges authorization code for tokens", async () => {
    process.env.BITBUCKET_OAUTH_CLIENT_ID = "my-client";
    process.env.BITBUCKET_OAUTH_CLIENT_SECRET = "secret";

    globalThis.fetch = (async (_url, init) => {
      assert.equal(init?.method, "POST");
      const body = String(init?.body ?? "");
      assert.ok(body.includes("grant_type=authorization_code"));
      assert.ok(body.includes("code=abc123"));
      return new Response(
        JSON.stringify({
          access_token: "access-1",
          refresh_token: "refresh-1",
          expires_in: 7200,
          scopes: "repository",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as typeof fetch;

    const tokens = await exchangeBitbucketCode("abc123");
    assert.equal(tokens.access_token, "access-1");
    assert.equal(tokens.refresh_token, "refresh-1");
    assert.equal(tokens.expires_in, 7200);
  });

  it("refreshes access tokens", async () => {
    process.env.BITBUCKET_OAUTH_CLIENT_ID = "my-client";
    process.env.BITBUCKET_OAUTH_CLIENT_SECRET = "secret";

    globalThis.fetch = (async (_url, init) => {
      const body = String(init?.body ?? "");
      assert.ok(body.includes("grant_type=refresh_token"));
      assert.ok(body.includes("refresh_token=refresh-old"));
      return new Response(
        JSON.stringify({
          access_token: "access-2",
          refresh_token: "refresh-2",
          expires_in: 7200,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as typeof fetch;

    const tokens = await refreshBitbucketToken("refresh-old");
    assert.equal(tokens.access_token, "access-2");
    assert.equal(tokens.refresh_token, "refresh-2");
  });
});
