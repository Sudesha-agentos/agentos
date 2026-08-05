import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createOAuthState, parseOAuthState } from "../../git-integration/oauthState";

describe("bitbucket oauth state binding", () => {
  it("round-trips organizationId in signed state used by Bitbucket callback", () => {
    const state = createOAuthState("org_123", "acme");
    const parsed = parseOAuthState(state);
    assert.equal(parsed.valid, true);
    assert.equal(parsed.organizationId, "org_123");
    assert.equal(parsed.organizationSlug, "acme");
  });

  it("rejects tampered state", () => {
    const state = createOAuthState("org_123", "acme");
    const tampered = `${state.slice(0, -4)}xxxx`;
    const parsed = parseOAuthState(tampered);
    assert.equal(parsed.valid, false);
  });
});
