import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertSafeOutboundUrl } from "./assertSafeOutboundUrl";
import { ValidationError } from "../utils/errors";

function expectRejected(url: string) {
  assert.throws(() => assertSafeOutboundUrl(url), ValidationError);
}

describe("assertSafeOutboundUrl", () => {
  it("allows public https URLs", () => {
    const url = assertSafeOutboundUrl("https://example.com/app");
    assert.equal(url.hostname, "example.com");
  });

  it("rejects http, localhost, private, and metadata hosts", () => {
    expectRejected("http://example.com");
    expectRejected("https://localhost/admin");
    expectRejected("https://127.0.0.1/");
    expectRejected("https://10.0.0.5/");
    expectRejected("https://192.168.1.1/");
    expectRejected("https://169.254.169.254/latest/meta-data");
    expectRejected("javascript:alert(1)");
  });
});
