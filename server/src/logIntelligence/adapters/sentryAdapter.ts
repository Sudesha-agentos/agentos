/**
 * Sentry Issues API adapter + webhook payload normalisation.
 */

import { BaseLogAdapter } from "./baseAdapter";
import { mapEnvironment } from "../ingestion/normaliser";
import type { LogSeverityLevel, NormalizedLogEntry } from "../ingestion/schema";

type SentryIssue = {
  id?: string;
  title?: string;
  culprit?: string;
  level?: string;
  status?: string;
  count?: string | number;
  firstSeen?: string;
  lastSeen?: string;
  permalink?: string;
  metadata?: { type?: string; value?: string };
  project?: { slug?: string };
};

export class SentryAdapter extends BaseLogAdapter {
  sourceType = "sentry";

  private authToken(config: Record<string, unknown>): string {
    return String(config.authToken ?? config.auth_token ?? "").trim();
  }

  private org(config: Record<string, unknown>): string {
    return String(
      config.organizationSlug ?? config.org ?? config.organization ?? ""
    ).trim();
  }

  private project(config: Record<string, unknown>): string {
    return String(config.projectSlug ?? config.project ?? "").trim();
  }

  async validate(
    config: Record<string, unknown>
  ): Promise<{ valid: boolean; error?: string }> {
    const token = this.authToken(config);
    const org = this.org(config);
    const project = this.project(config);
    if (!token || !org || !project) {
      return {
        valid: false,
        error: "authToken, organizationSlug, and projectSlug are required",
      };
    }
    try {
      await this.pull({
        config,
        since: new Date(Date.now() - 86_400_000),
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
    const token = this.authToken(input.config);
    const org = this.org(input.config);
    const project = this.project(input.config);
    const limit = Math.min(input.limit ?? 100, 100);
    const url = new URL(
      `https://sentry.io/api/0/projects/${encodeURIComponent(org)}/${encodeURIComponent(project)}/issues/`
    );
    url.searchParams.set("query", "is:unresolved");
    url.searchParams.set("limit", String(limit));

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`sentry_issues_http_${res.status}: ${text.slice(0, 200)}`);
    }

    const issues = (await res.json()) as SentryIssue[];
    const sourceId = input.sourceId ?? "unknown";
    const env = mapEnvironment(
      input.environment ?? input.config.environment ?? "production"
    );
    const serviceName = String(
      input.config.serviceName ?? project
    );

    const out: NormalizedLogEntry[] = [];
    for (const issue of issues) {
      const lastSeen = issue.lastSeen ? new Date(issue.lastSeen) : new Date();
      if (lastSeen < input.since || lastSeen > input.until) continue;

      const message = String(
        issue.title ?? issue.metadata?.value ?? "Sentry issue"
      );
      const severity = this.normaliseSeverity(issue.level ?? "error");
      if (
        input.severityFilter?.length &&
        !input.severityFilter.includes(severity)
      ) {
        continue;
      }
      const errorType =
        issue.metadata?.type || this.extractErrorType(message) || "SentryIssue";

      out.push({
        id: this.newEntryId(),
        sourceId,
        sourceType: this.sourceType,
        timestamp: lastSeen,
        severity,
        message: `[sentry:${issue.id}] ${message}`,
        errorType,
        errorCode: issue.id ? `sentry-group-${issue.id}` : null,
        stackTrace: null,
        stackTraceHash: issue.id
          ? this.generateStackHash(`sentry-group:${issue.id}`)
          : null,
        httpMethod: null,
        httpStatus: null,
        endpoint: issue.culprit ?? null,
        requestId: issue.id ?? null,
        userId: null,
        serviceName,
        serviceVersion: null,
        deploymentId: null,
        environment: env,
        region: null,
        instanceId: null,
        rawPayload: issue as Record<string, unknown>,
      });
    }
    return out;
  }

  async stream(): Promise<() => void> {
    return () => undefined;
  }

  /** Map a Sentry webhook issue payload to a normalised entry. */
  fromWebhookPayload(
    payload: Record<string, unknown>,
    sourceId: string,
    config: Record<string, unknown> = {}
  ): NormalizedLogEntry | null {
    const data = (payload.data as Record<string, unknown>) ?? payload;
    const issue = (data.issue as SentryIssue) ?? (data as SentryIssue);
    if (!issue?.id && !issue?.title) return null;

    const message = String(issue.title ?? "Sentry webhook issue");
    const stack = this.extractStackTrace(message);
    return {
      id: this.newEntryId(),
      sourceId,
      sourceType: this.sourceType,
      timestamp: this.normaliseTimestamp(issue.lastSeen ?? new Date()),
      severity: this.normaliseSeverity(issue.level ?? "error"),
      message: `[sentry:${issue.id}] ${message}`,
      errorType:
        issue.metadata?.type || this.extractErrorType(message) || "SentryIssue",
      errorCode: issue.id ? `sentry-group-${issue.id}` : null,
      stackTrace: stack,
      stackTraceHash: issue.id
        ? this.generateStackHash(`sentry-group:${issue.id}`)
        : this.generateStackHash(stack),
      httpMethod: null,
      httpStatus: null,
      endpoint: issue.culprit ?? null,
      requestId: issue.id ?? null,
      userId: null,
      serviceName: String(
        config.serviceName ?? issue.project?.slug ?? "sentry"
      ),
      serviceVersion: null,
      deploymentId: null,
      environment: mapEnvironment(config.environment ?? "production"),
      region: null,
      instanceId: null,
      rawPayload: payload,
    };
  }
}
