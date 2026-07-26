/**
 * AWS CloudWatch Logs adapter via FilterLogEvents (SDK optional).
 * Uses AWS REST-compatible approach with @aws-sdk when available;
 * falls back to clear validation error if package missing.
 */

import { BaseLogAdapter } from "./baseAdapter";
import { mapEnvironment } from "../ingestion/normaliser";
import type { LogSeverityLevel, NormalizedLogEntry } from "../ingestion/schema";

type FilterResult = {
  events?: Array<{
    timestamp?: number;
    message?: string;
    eventId?: string;
    logStreamName?: string;
  }>;
};

export class CloudWatchAdapter extends BaseLogAdapter {
  sourceType = "cloudwatch";

  async validate(
    config: Record<string, unknown>
  ): Promise<{ valid: boolean; error?: string }> {
    if (!config.accessKeyId || !config.secretAccessKey || !config.region) {
      return {
        valid: false,
        error: "accessKeyId, secretAccessKey, and region are required",
      };
    }
    if (!config.logGroupName) {
      return { valid: false, error: "logGroupName is required" };
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

  private async loadClient(config: Record<string, unknown>) {
    try {
      // Dynamic import — package may not be installed in all environments
      const mod = await import("@aws-sdk/client-cloudwatch-logs");
      const client = new mod.CloudWatchLogsClient({
        region: String(config.region),
        credentials: {
          accessKeyId: String(config.accessKeyId),
          secretAccessKey: String(config.secretAccessKey),
        },
      });
      return { mod, client };
    } catch {
      throw new Error(
        "Install @aws-sdk/client-cloudwatch-logs to use the CloudWatch adapter"
      );
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
    const { mod, client } = await this.loadClient(input.config);
    const cmd = new mod.FilterLogEventsCommand({
      logGroupName: String(input.config.logGroupName),
      startTime: input.since.getTime(),
      endTime: input.until.getTime(),
      filterPattern: '?error ?Error ?ERROR ?exception ?Exception',
      limit: Math.min(input.limit ?? 100, 200),
    });
    const result = (await client.send(cmd)) as FilterResult;
    const sourceId = input.sourceId ?? "unknown";
    const env = mapEnvironment(
      input.environment ?? input.config.environment ?? "production"
    );
    const serviceName = String(
      input.config.serviceName ?? input.config.logGroupName ?? "cloudwatch"
    );

    const out: NormalizedLogEntry[] = [];
    for (const ev of result.events ?? []) {
      const message = String(ev.message ?? "");
      const severity = this.normaliseSeverity(
        /fatal|critical/i.test(message)
          ? "fatal"
          : /warn/i.test(message)
            ? "warn"
            : "error"
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
        timestamp: this.normaliseTimestamp(ev.timestamp ?? Date.now()),
        severity,
        message,
        errorType: this.extractErrorType(message),
        errorCode: null,
        stackTrace: stack,
        stackTraceHash: this.generateStackHash(stack),
        httpMethod: null,
        httpStatus: null,
        endpoint: null,
        requestId: ev.eventId ?? null,
        userId: null,
        serviceName,
        serviceVersion: null,
        deploymentId: null,
        environment: env,
        region: String(input.config.region ?? "") || null,
        instanceId: ev.logStreamName ?? null,
        rawPayload: ev as Record<string, unknown>,
      });
    }
    return out;
  }

  async stream(): Promise<() => void> {
    return () => undefined;
  }
}
