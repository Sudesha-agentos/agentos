import { createHash } from "node:crypto";
import type { ErrorFingerprint, NormalizedLogEntry } from "../ingestion/schema";

export function generateFingerprint(entry: NormalizedLogEntry): ErrorFingerprint {
  const messageTemplate = entry.message
    .replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      "{uuid}"
    )
    .replace(/\b\d{4,}\b/g, "{id}")
    .replace(/[\w.-]+@[\w.-]+\.\w+/g, "{email}")
    .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, "{ip}")
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/g, "{timestamp}")
    // Strip sentry group prefix noise for grouping
    .replace(/^\[sentry:[^\]]+\]\s*/i, "")
    .trim();

  const stackTemplate = entry.stackTrace
    ? entry.stackTrace
        .replace(/:\d+:\d+/g, ":N:N")
        .replace(/0x[0-9a-fA-F]+/g, "0xADDR")
        .split("\n")
        .slice(0, 8)
        .join("\n")
    : entry.errorCode?.startsWith("sentry-group-")
      ? `sentry-group:${entry.errorCode}`
      : null;

  const hashInput = [
    entry.errorType ?? "unknown",
    messageTemplate.slice(0, 200),
    stackTemplate?.slice(0, 500) ?? "",
  ].join("|");

  const hash = createHash("sha256")
    .update(hashInput)
    .digest("hex")
    .slice(0, 16);

  return {
    hash,
    errorType: entry.errorType ?? "UnknownError",
    messageTemplate,
    stackTemplate,
  };
}
