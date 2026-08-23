import { describe, expect, it } from "vitest";
import { opensWithoutApi } from "./publicPaths";

describe("opensWithoutApi", () => {
  it("lets the marketing site and auth forms open without healthz", () => {
    expect(opensWithoutApi("/")).toBe(true);
    expect(opensWithoutApi("/login")).toBe(true);
    expect(opensWithoutApi("/contact")).toBe(true);
    expect(opensWithoutApi("/forgot-password")).toBe(true);
  });

  it("gates the product app until the API answers", () => {
    expect(opensWithoutApi("/acme/pipelines")).toBe(false);
    expect(opensWithoutApi("/app/pipelines")).toBe(false);
    expect(opensWithoutApi("/onboarding")).toBe(false);
    expect(opensWithoutApi("/auth/google/callback")).toBe(false);
  });
});
