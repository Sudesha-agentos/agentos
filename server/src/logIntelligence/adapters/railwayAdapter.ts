/**
 * Railway GraphQL logs adapter.
 */

import { BaseLogAdapter } from "./baseAdapter";
import { mapEnvironment } from "../ingestion/normaliser";
import type { LogSeverityLevel, NormalizedLogEntry } from "../ingestion/schema";

const RAILWAY_GQL = "https://backboard.railway.app/graphql/v2";

export class RailwayAdapter extends BaseLogAdapter {
  sourceType = "railway";

  private token(config: Record<string, unknown>): string {
    return String(config.apiToken ?? config.token ?? "").trim();
  }

  async validate(
    config: Record<string, unknown>
  ): Promise<{ valid: boolean; error?: string }> {
    if (!this.token(config)) {
      return { valid: false, error: "apiToken is required" };
    }
    if (!config.environmentId && !config.deploymentId) {
      return {
        valid: false,
        error: "environmentId or deploymentId is required",
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

  private async gql<T>(
    token: string,
    query: string,
    variables: Record<string, unknown>
  ): Promise<T> {
    const res = await fetch(RAILWAY_GQL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) {
      throw new Error(`railway_graphql_http_${res.status}`);
    }
    const body = (await res.json()) as {
      data?: T;
      errors?: Array<{ message?: string }>;
    };
    if (body.errors?.length) {
      throw new Error(body.errors[0]?.message ?? "railway_graphql_error");
    }
    if (!body.data) throw new Error("railway_graphql_empty");
    return body.data;
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
    const token = this.token(input.config);
    let deploymentId = String(input.config.deploymentId ?? "").trim();
    let commitSha: string | null = null;

    if (!deploymentId) {
      const environmentId = String(input.config.environmentId ?? "").trim();
      const data = await this.gql<{
        deployments?: {
          edges?: Array<{
            node?: {
              id?: string;
              meta?: { commitSha?: string };
            };
          }>;
        };
      }>(
        token,
        `query GetDeployments($environmentId: String!) {
          deployments(input: { environmentId: $environmentId }, first: 5) {
            edges { node { id meta { commitSha } } }
          }
        }`,
        { environmentId }
      );
      const node = data.deployments?.edges?.[0]?.node;
      deploymentId = node?.id ?? "";
      commitSha = node?.meta?.commitSha ?? null;
    }

    if (!deploymentId) throw new Error("railway_no_deployment");

    const data = await this.gql<{
      deploymentLogs?: Array<{
        timestamp?: string;
        message?: string;
        severity?: string;
      }>;
    }>(
      token,
      `query GetLogs($deploymentId: String!, $filter: String) {
        deploymentLogs(deploymentId: $deploymentId, filter: $filter) {
          timestamp message severity
        }
      }`,
      { deploymentId, filter: "error" }
    );

    const logs = data.deploymentLogs ?? [];
    const sourceId = input.sourceId ?? "unknown";
    const env = mapEnvironment(
      input.environment ?? input.config.environment ?? "production"
    );
    const serviceName = String(
      input.config.serviceName ?? input.config.projectId ?? "railway"
    );
    const out: NormalizedLogEntry[] = [];

    for (const row of logs.slice(0, input.limit ?? 100)) {
      const message = String(row.message ?? "");
      const severity = this.normaliseSeverity(row.severity ?? "error");
      if (
        input.severityFilter?.length &&
        !input.severityFilter.includes(severity)
      ) {
        continue;
      }
      const ts = this.normaliseTimestamp(row.timestamp ?? new Date());
      if (ts < input.since || ts > input.until) continue;
      const stack = this.extractStackTrace(message);
      out.push({
        id: this.newEntryId(),
        sourceId,
        sourceType: this.sourceType,
        timestamp: ts,
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
        deploymentId: commitSha ?? deploymentId,
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
