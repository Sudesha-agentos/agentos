/**
 * Datadog Logs API adapter (basic search).
 */

import { BaseLogAdapter } from "./baseAdapter";
import { mapEnvironment } from "../ingestion/normaliser";
import type { LogSeverityLevel, NormalizedLogEntry } from "../ingestion/schema";

export class DatadogAdapter extends BaseLogAdapter {
  sourceType = "datadog";

  async validate(
    config: Record<string, unknown>
  ): Promise<{ valid: boolean; error?: string }> {
    if (!config.apiKey || !config.appKey) {
      return { valid: false, error: "apiKey and appKey are required" };
    }
    try {
      await this.pull({
        config,
        since: new Date(Date.now() - 3_600_000),
        until: new Date(),
        limit: 1,
      });
      return { valid: true };
    } catch (err) {
      return {
        valid: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async pull(input: {
    config: Record<string, unknown>;
    since: Date;
    until: Date;
    environment?: string;
    severityFilter?: LogSeverityLevel[];
    limit?: number;
    sourceId?: string;
  }): Promise<NormalizedLogEntry[]> {
    const site = String(input.config.site ?? "datadoghq.com").replace(
      /^https?:\/\//,
      ""
    );
    const url = `https://api.${site}/api/v2/logs/events/search`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "DD-API-KEY": String(input.config.apiKey),
        "DD-APPLICATION-KEY": String(input.config.appKey),
      },
      body: JSON.stringify({
        filter: {
          from: input.since.toISOString(),
          to: input.until.toISOString(),
          query: String(input.config.query ?? "status:(error OR critical)"),
        },
        page: { limit: Math.min(input.limit ?? 50, 100) },
        sort: "timestamp",
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`datadog_http_${res.status}: ${text.slice(0, 200)}`);
    }
    const body = (await res.json()) as {
      data?: Array<{
        attributes?: {
          timestamp?: string;
          message?: string;
          status?: string;
          service?: string;
          attributes?: Record<string, unknown>;
        };
      }>;
    };

    const sourceId = input.sourceId ?? "unknown";
    const env = mapEnvironment(
      input.environment ?? input.config.environment ?? "production"
    );
    const out: NormalizedLogEntry[] = [];
    for (const row of body.data ?? []) {
      const attrs = row.attributes ?? {};
      const message = String(attrs.message ?? "");
      const severity = this.normaliseSeverity(attrs.status ?? "error");
      if (
        input.severityFilter?.length &&
        !input.severityFilter.includes(severity)
      ) {
        continue;
      }
      const stack = this.extractStackTrace(message);
      const nested = (attrs.attributes ?? {}) as Record<string, unknown>;
      out.push({
        id: this.newEntryId(),
        sourceId,
        sourceType: this.sourceType,
        timestamp: this.normaliseTimestamp(attrs.timestamp ?? new Date()),
        severity,
        message,
        errorType: this.extractErrorType(message),
        errorCode: null,
        stackTrace: stack,
        stackTraceHash: this.generateStackHash(stack),
        httpMethod: null,
        httpStatus:
          typeof nested.status_code === "number"
            ? nested.status_code
            : null,
        endpoint: null,
        requestId: null,
        userId: null,
        serviceName: String(attrs.service ?? "datadog"),
        serviceVersion: null,
        deploymentId:
          typeof nested.version === "string" ? nested.version : null,
        environment: env,
        region: null,
        instanceId: null,
        rawPayload: row as Record<string, unknown>,
      });
    }
    return out;
  }

  async stream(): Promise<() => void> {
    return () => undefined;
  }
}
