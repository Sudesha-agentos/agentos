import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertSafeDatabaseHostShape } from "./hostGuard";
import { ValidationError } from "../utils/errors";

describe("assertSafeDatabaseHostShape", () => {
  it("allows public hostnames and RFC1918 IPs", () => {
    assert.equal(assertSafeDatabaseHostShape("db.example.com"), "db.example.com");
    assert.equal(assertSafeDatabaseHostShape("10.0.0.12"), "10.0.0.12");
    assert.equal(assertSafeDatabaseHostShape("192.168.1.20"), "192.168.1.20");
  });

  it("rejects localhost and cloud metadata", () => {
    assert.throws(() => assertSafeDatabaseHostShape("localhost"), ValidationError);
    assert.throws(() => assertSafeDatabaseHostShape("127.0.0.1"), ValidationError);
    assert.throws(() => assertSafeDatabaseHostShape("169.254.169.254"), ValidationError);
    assert.throws(() => assertSafeDatabaseHostShape("metadata.google.internal"), ValidationError);
  });

  it("rejects URLs in the host field", () => {
    assert.throws(() => assertSafeDatabaseHostShape("https://db.example.com"), ValidationError);
  });
});
