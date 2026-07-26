/**
 * Grafana Loki query_range adapter.
 */

import { BaseLogAdapter } from "./baseAdapter";
import { mapEnvironment } from "../ingestion/normaliser";
import type { LogSeverityLevel, NormalizedLogEntry } from "../ingestion/schema";

export class LokiAdapter extends BaseLogAdapter {
  sourceType = "grafana_loki";

  async validate(
    config: Record<string, unknown>
  ): Promise<{ valid: boolean; error?: string }> {
    if (!config.baseUrl || !config.username || !config.apiKey) {
      return {
        valid: false,
        error: "baseUrl, username, and apiKey are required",
      };
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
    const baseUrl = String(input.config.baseUrl).replace(/\/$/, "");
    const username = String(input.config.username);
    const apiKey = String(input.config.apiKey);
    const auth = Buffer.from(`${username}:${apiKey}`).toString("base64");
    const query =
      String(input.config.query ?? "").trim() ||
      `{environment="production"} |~ "(?i)error|fatal|exception"`;

    const url = new URL(`${baseUrl}/loki/api/v1/query_range`);
    url.searchParams.set("query", query);
    url.searchParams.set(
      "start",
      String(input.since.getTime() * 1_000_000)
    );
    url.searchParams.set("end", String(input.until.getTime() * 1_000_000));
    url.searchParams.set("limit", String(Math.min(input.limit ?? 100, 200)));

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: "application/json",
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`loki_http_${res.status}: ${text.slice(0, 200)}`);
    }

    const body = (await res.json()) as {
      data?: {
        result?: Array<{
          stream?: Record<string, string>;
          values?: Array<[string, string]>;
        }>;
      };
    };

    const sourceId = input.sourceId ?? "unknown";
    const env = mapEnvironment(
      input.environment ?? input.config.environment ?? "production"
    );
    const out: NormalizedLogEntry[] = [];

    for (const stream of body.data?.result ?? []) {
      const serviceName =
        stream.stream?.app ||
        stream.stream?.service ||
        stream.stream?.job ||
        "loki";
      for (const [tsNano, line] of stream.values ?? []) {
        const ms = Number(BigInt(tsNano) / 1_000_000n);
        const message = String(line);
        const severity = this.normaliseSeverity(
          stream.stream?.level ??
            (/fatal|critical/i.test(message) ? "fatal" : "error")
        );
        if (
          input.severityFilter?.length &&
          !input.severityFilter.includes(severity)
        ) {
          continue;
        }
        const stack = this.extractStackTrace(message);
        out.push({
          id: this.newEntryId(),
          sourceId,
          sourceType: this.sourceType,
          timestamp: this.normaliseTimestamp(ms),
          severity,
          message,
          errorType: this.extractErrorType(message),
          errorCode: null,
          stackTrace: stack,
          stackTraceHash: this.generateStackHash(stack),
          httpMethod: null,
          httpStatus: null,
          endpoint: null,
          requestId: null,
          userId: null,
          serviceName,
          serviceVersion: null,
          deploymentId: stream.stream?.version ?? null,
          environment: env,
          region: null,
          instanceId: stream.stream?.instance ?? null,
          rawPayload: { stream: stream.stream, line },
        });
      }
    }
    return out;
  }

  async stream(): Promise<() => void> {
    return () => undefined;
  }
}
