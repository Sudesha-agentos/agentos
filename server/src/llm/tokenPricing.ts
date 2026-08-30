/** USD per 1M tokens. Used for sim-lab cost display. */
export type TokenRate = {
  inputUsdPerMillion: number;
  outputUsdPerMillion: number;
};

const DEFAULT_RATE: TokenRate = { inputUsdPerMillion: 1.25, outputUsdPerMillion: 10 };

const RATES: Record<string, TokenRate> = {
  "gpt-5.6": { inputUsdPerMillion: 2.5, outputUsdPerMillion: 15 },
  "gpt-5.5": { inputUsdPerMillion: 2.5, outputUsdPerMillion: 15 },
  "gpt-5.1": { inputUsdPerMillion: 1.25, outputUsdPerMillion: 10 },
  "gpt-5": { inputUsdPerMillion: 1.25, outputUsdPerMillion: 10 },
  "gpt-4.1": { inputUsdPerMillion: 2, outputUsdPerMillion: 8 },
  o3: { inputUsdPerMillion: 10, outputUsdPerMillion: 40 },
  "o4-mini": { inputUsdPerMillion: 1.1, outputUsdPerMillion: 4.4 },
  "grok-4.6": { inputUsdPerMillion: 3, outputUsdPerMillion: 15 },
  "grok-4.5": { inputUsdPerMillion: 3, outputUsdPerMillion: 15 },
  "grok-4": { inputUsdPerMillion: 3, outputUsdPerMillion: 15 },
  "grok-3": { inputUsdPerMillion: 3, outputUsdPerMillion: 15 },
  "grok-3-mini": { inputUsdPerMillion: 0.3, outputUsdPerMillion: 0.5 },
  "claude-opus-5": { inputUsdPerMillion: 15, outputUsdPerMillion: 75 },
  "claude-sonnet-5": { inputUsdPerMillion: 3, outputUsdPerMillion: 15 },
  "claude-opus-4-8": { inputUsdPerMillion: 15, outputUsdPerMillion: 75 },
  "claude-sonnet-4-6": { inputUsdPerMillion: 3, outputUsdPerMillion: 15 },
  "claude-sonnet-4-5": { inputUsdPerMillion: 3, outputUsdPerMillion: 15 },
  "claude-haiku-4-5": { inputUsdPerMillion: 0.8, outputUsdPerMillion: 4 },
};

export function normalizeModelId(model: string | undefined | null): string {
  return String(model ?? "")
    .trim()
    .toLowerCase()
    .replace(/-\d{4}-\d{2}-\d{2}$/, "");
}

export function tokenRatesForModel(model: string | undefined | null): TokenRate {
  const id = normalizeModelId(model);
  if (RATES[id]) return RATES[id];
  const match = Object.keys(RATES).find((key) => id.startsWith(key) || id.includes(key));
  return match ? RATES[match] : DEFAULT_RATE;
}

export function costUsdForTokens(
  model: string | undefined | null,
  inputTokens: number,
  outputTokens: number
): number {
  const rate = tokenRatesForModel(model);
  return (
    (Math.max(0, inputTokens) / 1_000_000) * rate.inputUsdPerMillion +
    (Math.max(0, outputTokens) / 1_000_000) * rate.outputUsdPerMillion
  );
}

export function formatUsd(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return "$0.00";
  if (amount < 0.01) return `$${amount.toFixed(4)}`;
  return `$${amount.toFixed(4)}`;
}
