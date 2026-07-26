/**
 * Thin Vector (Datadog) HTTP sink receiver — maps flexible JSON into NormalizedLogEntry.
 */

import { randomUUID } from "node:crypto";
import { createHash } from "node:crypto";
import { mapEnvironment } from "./normaliser";
import type { NormalizedLogEntry, LogSeverityLevel } from "./schema";

function severityOf(raw: unknown): LogSeverityLevel {
  const s = String(raw ?? "info").toLowerCase();
  if (["fatal", "critical", "emergency"].includes(s)) return "fatal";
  if (["error", "err"].includes(s)) return "error";
  if (["warn", "warning"].includes(s)) return "warn";
  if (["debug", "trace"].includes(s)) return "debug";
  return "info";
}

export function parseVectorPayload(
  body: unknown,
  sourceId: string
): NormalizedLogEntry[] {
  const rows = Array.isArray(body)
    ? body
    : body && typeof body === "object" && Array.isArray((body as { events?: unknown }).events)
      ? ((body as { events: unknown[] }).events)
      : [body];

  const out: NormalizedLogEntry[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const message = String(r.message ?? r.msg ?? r.text ?? "");
    if (!message) continue;
    const ts = r.timestamp ?? r.time ?? r["@timestamp"] ?? Date.now();
    const stack =
      typeof r.stack === "string"
        ? r.stack
        : typeof r.stackTrace === "string"
          ? r.stackTrace
          : null;
    out.push({
      id: randomUUID(),
      sourceId,
      sourceType: "custom",
      timestamp:
        typeof ts === "number"
          ? new Date(ts > 1e12 ? ts : ts * 1000)
          : new Date(String(ts)),
      severity: severityOf(r.severity ?? r.level),
      message,
      errorType: typeof r.errorType === "string" ? r.errorType : null,
      errorCode: r.errorCode != null ? String(r.errorCode) : null,
      stackTrace: stack,
      stackTraceHash: stack
        ? createHash("sha256").update(stack).digest("hex")
        : null,
      httpMethod: typeof r.httpMethod === "string" ? r.httpMethod : null,
      httpStatus:
        typeof r.httpStatus === "number"
          ? r.httpStatus
          : typeof r.status === "number"
            ? r.status
            : null,
      endpoint: typeof r.endpoint === "string" ? r.endpoint : null,
      requestId: typeof r.requestId === "string" ? r.requestId : null,
      userId: typeof r.userId === "string" ? r.userId : null,
      serviceName: String(r.service ?? r.serviceName ?? "vector"),
      serviceVersion:
        typeof r.version === "string" ? r.version : null,
      deploymentId:
        typeof r.deploymentId === "string"
          ? r.deploymentId
          : typeof r.commit === "string"
            ? r.commit
            : null,
      environment: mapEnvironment(r.environment ?? r.env),
      region: typeof r.region === "string" ? r.region : null,
      instanceId: typeof r.instanceId === "string" ? r.instanceId : null,
      rawPayload: r,
    });
  }
  return out;
}
