import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ValidationError } from "../../utils/errors";
import {
  getWorkspaceProvider,
  listWorkspaceProviders,
} from "./catalog";
import {
  amplitudeRegion,
  collectConfig,
  zendeskSubdomain,
} from "./validate";

describe("workspace connection catalog", () => {
  it("covers every business-data provider the hub lists", () => {
    const ids = listWorkspaceProviders().map((item) => item.id).sort();
    assert.deepEqual(ids, [
      "amplitude",
      "gong",
      "hubspot",
      "intercom",
      "linear",
      "slack",
      "zendesk",
    ]);
  });

  it("requires Slack bot token before calling Slack", () => {
    const provider = getWorkspaceProvider("slack");
    assert.ok(provider);
    assert.throws(
      () => collectConfig(provider, { botToken: "  " }),
      ValidationError
    );
    const collected = collectConfig(provider, { botToken: "xoxb-test" });
    assert.equal(collected.botToken, "xoxb-test");
  });

  it("normalizes Zendesk subdomain from a full host", () => {
    assert.equal(zendeskSubdomain("acme"), "acme");
    assert.equal(zendeskSubdomain("https://Acme.zendesk.com/agent"), "acme");
    assert.throws(() => zendeskSubdomain("https://evil.example.com"), ValidationError);
    assert.throws(() => zendeskSubdomain("localhost"), ValidationError);
  });

  it("maps Amplitude region to us or eu", () => {
    assert.equal(amplitudeRegion("eu"), "eu");
    assert.equal(amplitudeRegion("EU"), "eu");
    assert.equal(amplitudeRegion(""), "us");
    assert.equal(amplitudeRegion("us"), "us");
  });
});
