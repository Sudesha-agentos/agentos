/**
 * Render logs adapter — REST pull + optional SSE stream.
 * https://api-docs.render.com/reference/retrieve-logs
 */

import { BaseLogAdapter } from "./baseAdapter";
import { mapEnvironment } from "../ingestion/normaliser";
import type { LogSeverityLevel, NormalizedLogEntry } from "../ingestion/schema";
import { logger } from "../../utils/logger";

type RenderLogRow = {
  id?: string;
  timestamp?: string;
  message?: string;
  level?: string;
  labels?: Record<string, string>;
};

function extractDeployCommit(message: string): string | null {
  const m =
    /commit[:\s]+([0-9a-f]{7,40})/i.exec(message) ||
    /Deploy(?:ed|ing)?[^]*?([0-9a-f]{40})/i.exec(message);
  return m?.[1] ?? null;
}

export class RenderAdapter extends BaseLogAdapter {
  sourceType = "render";

  private apiKey(config: Record<string, unknown>): string {
    return String(config.apiKey ?? config.api_key ?? "").trim();
  }

  private serviceId(config: Record<string, unknown>): string {
    return String(config.serviceId ?? config.service_id ?? "").trim();
  }

  async validate(
    config: Record<string, unknown>
  ): Promise<{ valid: boolean; error?: string }> {
    const apiKey = this.apiKey(config);
    const serviceId = this.serviceId(config);
    if (!apiKey || !serviceId) {
      return { valid: false, error: "apiKey and serviceId are required" };
    }
    try {
      const until = new Date();
      const since = new Date(until.getTime() - 60_000);
      await this.pull({ config, since, until, limit: 1 });
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
    const apiKey = this.apiKey(input.config);
    const serviceId = this.serviceId(input.config);
    if (!apiKey || !serviceId) {
      throw new Error("render_config_incomplete");
    }

    const limit = Math.min(input.limit ?? 100, 100);
    const url = new URL(
      `https://api.render.com/v1/services/${encodeURIComponent(serviceId)}/logs`
    );
    url.searchParams.set("startTime", input.since.toISOString());
    url.searchParams.set("endTime", input.until.toISOString());
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("direction", "backward");

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`render_logs_http_${res.status}: ${text.slice(0, 200)}`);
    }

    const body = (await res.json()) as
      | RenderLogRow[]
      | { logs?: RenderLogRow[]; entries?: RenderLogRow[] };
    const rows = Array.isArray(body)
      ? body
      : body.logs ?? body.entries ?? [];

    const sourceId = input.sourceId ?? "unknown";
    const env = mapEnvironment(
      input.environment ?? input.config.environment ?? "production"
    );
    const serviceName = String(
      input.config.serviceName ?? input.config.displayName ?? serviceId
    );

    const out: NormalizedLogEntry[] = [];
    for (const row of rows) {
      const message = String(row.message ?? "");
      const severity = this.normaliseSeverity(row.level ?? "info");
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
        timestamp: this.normaliseTimestamp(row.timestamp ?? new Date()),
        severity,
        message,
        errorType: this.extractErrorType(message),
        errorCode: null,
        stackTrace: stack,
        stackTraceHash: this.generateStackHash(stack),
        httpMethod: null,
        httpStatus: null,
        endpoint: null,
        requestId: row.id ?? null,
        userId: null,
        serviceName,
        serviceVersion: null,
        deploymentId: extractDeployCommit(message),
        environment: env,
        region: null,
        instanceId: null,
        rawPayload: row as Record<string, unknown>,
      });
    }
    return out;
  }

  async stream(input: {
    config: Record<string, unknown>;
    sourceId?: string;
    onEntry: (entry: NormalizedLogEntry) => Promise<void>;
    onError: (error: Error) => void;
  }): Promise<() => void> {
    // Render SSE is optional; poll-based pull covers MVP. Soft no-op stop.
    logger.info(
      { serviceId: this.serviceId(input.config) },
      "render SSE stream not started — using scheduled pull"
    );
    return () => undefined;
  }
}
