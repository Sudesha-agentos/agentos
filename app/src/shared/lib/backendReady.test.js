import { describe, expect, it } from "vitest";
import { isBackendReady, waitForBackend } from "./backendReady";

describe("waitForBackend", () => {
  it("resolves immediately in test mode", async () => {
    await waitForBackend();
    expect(isBackendReady()).toBe(true);
  });
});
