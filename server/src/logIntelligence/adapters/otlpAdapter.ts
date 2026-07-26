/**
 * OTLP JSON receiver helpers (full pull/stream not used — ingest via HTTP).
 */

import { BaseLogAdapter } from "./baseAdapter";
import { mapEnvironment } from "../ingestion/normaliser";
import type { NormalizedLogEntry } from "../ingestion/schema";

type OtlpAttr = { key?: string; value?: { stringValue?: string; intValue?: string } };

function attrMap(attrs: OtlpAttr[] | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const a of attrs ?? []) {
    if (!a.key) continue;
    out[a.key] = a.value?.stringValue ?? a.value?.intValue ?? "";
  }
  return out;
}

export class OtlpAdapter extends BaseLogAdapter {
  sourceType = "otlp";

  async pull(): Promise<NormalizedLogEntry[]> {
    throw new Error("otlp_use_http_ingest");
  }

  async stream(): Promise<() => void> {
    throw new Error("otlp_use_http_ingest");
  }

  async validate(): Promise<{ valid: boolean; error?: string }> {
    return { valid: true };
  }

  /** Parse OTLP LogsData JSON into normalised entries. */
  parseOtlpJson(
    body: Record<string, unknown>,
    sourceId: string
  ): NormalizedLogEntry[] {
    const entries: NormalizedLogEntry[] = [];
    const resourceLogs = (body.resourceLogs as Array<Record<string, unknown>>) ?? [];

    for (const rl of resourceLogs) {
      const resource = (rl.resource as { attributes?: OtlpAttr[] }) ?? {};
      const resAttrs = attrMap(resource.attributes);
      const serviceName =
        resAttrs["service.name"] || resAttrs["service"] || "unknown";
      const deploymentId =
        resAttrs["deployment.id"] ||
        resAttrs["service.version"] ||
        resAttrs["k8s.pod.name"] ||
        null;
      const environment = mapEnvironment(
        resAttrs["deployment.environment"] || resAttrs["environment"]
      );

      const scopeLogs = (rl.scopeLogs as Array<Record<string, unknown>>) ?? [];
      for (const sl of scopeLogs) {
        const logRecords =
          (sl.logRecords as Array<Record<string, unknown>>) ?? [];
        for (const lr of logRecords) {
          const nano = String(lr.timeUnixNano ?? lr.observedTimeUnixNano ?? "");
          const ms = nano ? Number(BigInt(nano) / 1_000_000n) : Date.now();
          const bodyVal = lr.body as { stringValue?: string } | string | undefined;
          const message =
            typeof bodyVal === "string"
              ? bodyVal
              : String(bodyVal?.stringValue ?? "");
          const severityText = String(lr.severityText ?? "info");
          const attrs = attrMap(lr.attributes as OtlpAttr[]);
          const stack = this.extractStackTrace(message);
          entries.push({
            id: this.newEntryId(),
            sourceId,
            sourceType: this.sourceType,
            timestamp: this.normaliseTimestamp(ms),
            severity: this.normaliseSeverity(severityText),
            message,
            errorType: this.extractErrorType(message),
            errorCode: attrs["http.status_code"] || null,
            stackTrace: stack,
            stackTraceHash: this.generateStackHash(stack),
            httpMethod: attrs["http.method"] || null,
            httpStatus: attrs["http.status_code"]
              ? Number(attrs["http.status_code"])
              : null,
            endpoint: attrs["http.route"] || attrs["http.target"] || null,
            requestId: attrs["request.id"] || null,
            userId: attrs["user.id"] || null,
            serviceName,
            serviceVersion: resAttrs["service.version"] || null,
            deploymentId,
            environment,
            region: resAttrs["cloud.region"] || null,
            instanceId: resAttrs["host.id"] || resAttrs["k8s.pod.name"] || null,
            rawPayload: lr,
          });
        }
      }
    }
    return entries;
  }
}
