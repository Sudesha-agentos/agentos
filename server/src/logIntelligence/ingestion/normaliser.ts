import { createHash } from "node:crypto";
import type { NormalizedLogEntry } from "./schema";

/** Ensure required fields and trim oversized payloads. */
export function finaliseNormalisedEntry(
  entry: NormalizedLogEntry
): NormalizedLogEntry {
  return {
    ...entry,
    message: String(entry.message ?? "").slice(0, 20_000),
    stackTrace: entry.stackTrace ? entry.stackTrace.slice(0, 16_000) : null,
    serviceName: entry.serviceName || "unknown",
    environment: entry.environment || "production",
    rawPayload: entry.rawPayload ?? {},
  };
}

export function dedupeKey(entry: NormalizedLogEntry): string {
  const stackOrMsg = entry.stackTraceHash || entry.message.slice(0, 200);
  return createHash("sha256")
    .update(
      [
        entry.sourceId,
        entry.timestamp.toISOString(),
        entry.serviceName,
        stackOrMsg,
      ].join("|")
    )
    .digest("hex")
    .slice(0, 32);
}

export function mapEnvironment(raw: unknown): NormalizedLogEntry["environment"] {
  const s = String(raw ?? "production").toLowerCase();
  if (s.includes("stag")) return "staging";
  if (s.includes("preview") || s.includes("pr-")) return "preview";
  if (s.includes("dev")) return "development";
  return "production";
}
