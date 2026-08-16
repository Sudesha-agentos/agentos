import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { classifySql } from "./sqlGuard";

describe("classifySql", () => {
  it("classifies SELECT as query", () => {
    const result = classifySql("SELECT id FROM public.users WHERE id = 1");
    assert.equal(result.kind, "query");
    assert.equal(result.needsConfirm, false);
  });

  it("classifies WITH as query", () => {
    const result = classifySql("WITH x AS (SELECT 1) SELECT * FROM x");
    assert.equal(result.kind, "query");
  });

  it("classifies INSERT as execute", () => {
    const result = classifySql("INSERT INTO users (email) VALUES ('a@b.com')");
    assert.equal(result.kind, "execute");
    assert.equal(result.needsConfirm, false);
  });

  it("requires confirm for DELETE without WHERE", () => {
    const result = classifySql("DELETE FROM users");
    assert.equal(result.kind, "execute");
    assert.equal(result.needsConfirm, true);
  });

  it("allows DELETE with WHERE", () => {
    const result = classifySql("DELETE FROM users WHERE id = 1");
    assert.equal(result.kind, "execute");
    assert.equal(result.needsConfirm, false);
  });

  it("classifies CREATE TABLE as migrate", () => {
    const result = classifySql("CREATE TABLE public.widgets (id serial PRIMARY KEY)");
    assert.equal(result.kind, "migrate");
  });

  it("forbids DROP DATABASE", () => {
    const result = classifySql("DROP DATABASE production");
    assert.equal(result.kind, "forbidden");
  });

  it("forbids multiple statements", () => {
    const result = classifySql("SELECT 1; DROP TABLE users");
    assert.equal(result.kind, "forbidden");
  });

  it("forbids GRANT and file reads", () => {
    assert.equal(classifySql("GRANT ALL ON users TO public").kind, "forbidden");
    assert.equal(classifySql("SELECT pg_read_file('/etc/passwd')").kind, "forbidden");
  });

  it("requires confirm for TRUNCATE", () => {
    const result = classifySql("TRUNCATE TABLE public.users");
    assert.equal(result.kind, "execute");
    assert.equal(result.needsConfirm, true);
  });
});
