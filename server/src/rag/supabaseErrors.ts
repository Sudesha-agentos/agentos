/** Detect Supabase/PostgREST quota or rate-limit responses for sync circuit breaking. */
export function isSupabaseQuotaOrRateLimitError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;

  const record = err as {
    status?: number;
    code?: string;
    message?: string;
    hint?: string;
  };

  if (record.status === 402 || record.status === 429) return true;

  const haystack = [record.message, record.code, record.hint]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    haystack.includes("402") ||
    haystack.includes("429") ||
    haystack.includes("rate limit") ||
    haystack.includes("quota") ||
    haystack.includes("egress") ||
    haystack.includes("exceeded")
  );
}

export async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/** Abort sync loops after repeated 402/429 responses with exponential backoff. */
export class SyncCircuitBreaker {
  private consecutiveFailures = 0;

  tripped = false;

  recordSuccess(): void {
    this.consecutiveFailures = 0;
  }

  /** Returns true when the breaker trips and callers should stop syncing. */
  async recordFailure(err: unknown): Promise<boolean> {
    if (!isSupabaseQuotaOrRateLimitError(err)) {
      return false;
    }

    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= 3) {
      this.tripped = true;
      return true;
    }

    await sleep(2 ** this.consecutiveFailures * 1000);
    return false;
  }
}
