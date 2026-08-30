import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { costUsdForTokens, tokenRatesForModel } from "./tokenPricing";

describe("tokenPricing", () => {
  it("prices gpt-5.1 at $1.25 / $10 per million", () => {
    const rate = tokenRatesForModel("gpt-5.1-2025-11-13");
    assert.equal(rate.inputUsdPerMillion, 1.25);
    assert.equal(rate.outputUsdPerMillion, 10);
    assert.equal(costUsdForTokens("gpt-5.1", 1_000_000, 0), 1.25);
    assert.equal(costUsdForTokens("gpt-5.1", 0, 1_000_000), 10);
  });

  it("uses Claude Opus rates for opus models", () => {
    assert.equal(tokenRatesForModel("claude-opus-5").inputUsdPerMillion, 15);
  });
});
