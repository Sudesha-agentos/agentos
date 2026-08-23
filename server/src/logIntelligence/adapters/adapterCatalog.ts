/**
 * Adapter catalog metadata — drives Sources UI forms and connection docs.
 */

export type LogAdapterMode = "pull" | "push" | "both";

export type LogConfigFieldType = "text" | "password" | "url" | "select";

export type LogConfigField = {
  key: string;
  label: string;
  type: LogConfigFieldType;
  required?: boolean;
  secret?: boolean;
  placeholder?: string;
  help?: string;
  options?: Array<{ value: string; label: string }>;
};

export type LogAdapterCatalogEntry = {
  id: string;
  displayName: string;
  mode: LogAdapterMode;
  configSchema: LogConfigField[];
  docsHint: string;
  docsUrl?: string;
  docsLabel?: string;
  /** Hide from primary picker (aliases like loki → grafana_loki). */
  aliasOf?: string;
};

export const LOG_ADAPTER_CATALOG: LogAdapterCatalogEntry[] = [
  {
    id: "render",
    displayName: "Render",
    mode: "pull",
    docsUrl: "https://api-docs.render.com/reference/create-api-key",
    docsLabel: "Render API keys",
    docsHint:
      "Create an API key in Render Account Settings → API Keys. Use the service ID from the service URL (srv-…). AgentOX pulls error/warn logs on a schedule.",
    configSchema: [
      {
        key: "apiKey",
        label: "API key",
        type: "password",
        required: true,
        secret: true,
        placeholder: "rnd_…",
      },
      {
        key: "serviceId",
        label: "Service ID",
        type: "text",
        required: true,
        placeholder: "srv-…",
      },
      {
        key: "serviceName",
        label: "Service display name",
        type: "text",
        placeholder: "api",
      },
      {
        key: "environment",
        label: "Environment",
        type: "select",
        options: [
          { value: "production", label: "Production" },
          { value: "staging", label: "Staging" },
          { value: "preview", label: "Preview" },
          { value: "development", label: "Development" },
        ],
      },
    ],
  },
  {
    id: "sentry",
    displayName: "Sentry",
    mode: "both",
    docsUrl: "https://docs.sentry.io/api/auth/",
    docsLabel: "Sentry authentication",
    docsHint:
      "Use a Sentry auth token with event:read. For push, also point a Sentry webhook at POST /api/log-intelligence/webhooks/sentry?organizationId=<yourOrgId>.",
    configSchema: [
      {
        key: "authToken",
        label: "Auth token",
        type: "password",
        required: true,
        secret: true,
      },
      {
        key: "organizationSlug",
        label: "Organization slug",
        type: "text",
        required: true,
        placeholder: "my-org",
      },
      {
        key: "projectSlug",
        label: "Project slug",
        type: "text",
        required: true,
        placeholder: "backend",
      },
      {
        key: "environment",
        label: "Environment",
        type: "select",
        options: [
          { value: "production", label: "Production" },
          { value: "staging", label: "Staging" },
          { value: "development", label: "Development" },
        ],
      },
    ],
  },
  {
    id: "datadog",
    displayName: "Datadog",
    mode: "pull",
    docsUrl: "https://docs.datadoghq.com/api/latest/authentication/",
    docsLabel: "Datadog authentication",
    docsHint:
      "Requires an API key and Application key with logs_read. Site defaults to datadoghq.com (use datadoghq.eu for EU).",
    configSchema: [
      {
        key: "apiKey",
        label: "API key",
        type: "password",
        required: true,
        secret: true,
      },
      {
        key: "appKey",
        label: "Application key",
        type: "password",
        required: true,
        secret: true,
      },
      {
        key: "site",
        label: "Site",
        type: "text",
        placeholder: "datadoghq.com",
      },
      {
        key: "query",
        label: "Search query",
        type: "text",
        placeholder: "status:(error OR critical)",
      },
      {
        key: "environment",
        label: "Environment",
        type: "select",
        options: [
          { value: "production", label: "Production" },
          { value: "staging", label: "Staging" },
        ],
      },
    ],
  },
  {
    id: "cloudwatch",
    displayName: "AWS CloudWatch",
    mode: "pull",
    docsUrl: "https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/Working-with-log-groups-and-streams.html",
    docsLabel: "CloudWatch Logs",
    docsHint:
      "IAM user/role needs logs:FilterLogEvents on the target log group. Region must match the log group.",
    configSchema: [
      {
        key: "accessKeyId",
        label: "Access key ID",
        type: "password",
        required: true,
        secret: true,
      },
      {
        key: "secretAccessKey",
        label: "Secret access key",
        type: "password",
        required: true,
        secret: true,
      },
      {
        key: "region",
        label: "Region",
        type: "text",
        required: true,
        placeholder: "us-east-1",
      },
      {
        key: "logGroupName",
        label: "Log group name",
        type: "text",
        required: true,
        placeholder: "/aws/lambda/api",
      },
      {
        key: "serviceName",
        label: "Service name",
        type: "text",
        placeholder: "api",
      },
      {
        key: "environment",
        label: "Environment",
        type: "select",
        options: [
          { value: "production", label: "Production" },
          { value: "staging", label: "Staging" },
        ],
      },
    ],
  },
  {
    id: "grafana_loki",
    displayName: "Grafana Loki",
    mode: "pull",
    docsUrl: "https://grafana.com/docs/loki/latest/query/",
    docsLabel: "Grafana Loki query API",
    docsHint:
      "Works with Grafana Cloud Loki (username + API key) or self-hosted Loki with basic auth on the query endpoint.",
    configSchema: [
      {
        key: "baseUrl",
        label: "Base URL",
        type: "url",
        required: true,
        placeholder: "https://logs-prod-xxx.grafana.net",
      },
      {
        key: "username",
        label: "Username / instance ID",
        type: "text",
        required: true,
      },
      {
        key: "apiKey",
        label: "API key / password",
        type: "password",
        required: true,
        secret: true,
      },
      {
        key: "query",
        label: "LogQL query",
        type: "text",
        placeholder: '{job="api"} |= "error"',
      },
      {
        key: "environment",
        label: "Environment",
        type: "select",
        options: [
          { value: "production", label: "Production" },
          { value: "staging", label: "Staging" },
        ],
      },
    ],
  },
  {
    id: "loki",
    displayName: "Loki (alias)",
    mode: "pull",
    aliasOf: "grafana_loki",
    docsHint: "Alias of grafana_loki.",
    configSchema: [],
  },
  {
    id: "railway",
    displayName: "Railway",
    mode: "pull",
    docsUrl: "https://docs.railway.com/guides/public-api",
    docsLabel: "Railway public API",
    docsHint:
      "Use a Railway account token. Provide environmentId (preferred) or a specific deploymentId.",
    configSchema: [
      {
        key: "apiToken",
        label: "API token",
        type: "password",
        required: true,
        secret: true,
      },
      {
        key: "environmentId",
        label: "Environment ID",
        type: "text",
        placeholder: "…",
      },
      {
        key: "deploymentId",
        label: "Deployment ID (optional)",
        type: "text",
      },
      {
        key: "serviceName",
        label: "Service name",
        type: "text",
      },
      {
        key: "environment",
        label: "Environment label",
        type: "select",
        options: [
          { value: "production", label: "Production" },
          { value: "staging", label: "Staging" },
        ],
      },
    ],
  },
  {
    id: "otlp",
    displayName: "OTLP / OpenTelemetry",
    mode: "push",
    docsUrl: "https://opentelemetry.io/docs/specs/otlp/",
    docsLabel: "OTLP specification",
    docsHint:
      "Push OTLP JSON logs to AgentOX. No outbound credentials required — AgentOX is the receiver. Use the ingest URL shown after you save this source.",
    configSchema: [
      {
        key: "serviceName",
        label: "Default service name",
        type: "text",
        placeholder: "backend",
      },
      {
        key: "environment",
        label: "Environment",
        type: "select",
        options: [
          { value: "production", label: "Production" },
          { value: "staging", label: "Staging" },
          { value: "development", label: "Development" },
        ],
      },
    ],
  },
  {
    id: "custom",
    displayName: "Other (HTTP / Vector)",
    mode: "push",
    docsHint:
      "Forward any system via Vector, Fluent Bit, or a custom webhook. POST JSON log batches to the custom ingest endpoint with your organization id.",
    configSchema: [
      {
        key: "serviceName",
        label: "Default service name",
        type: "text",
        placeholder: "backend",
      },
      {
        key: "environment",
        label: "Environment",
        type: "select",
        options: [
          { value: "production", label: "Production" },
          { value: "staging", label: "Staging" },
        ],
      },
      {
        key: "notes",
        label: "Notes (optional)",
        type: "text",
        placeholder: "e.g. Vector → AgentOX",
      },
    ],
  },
];

export function listCatalogEntries(opts?: {
  includeAliases?: boolean;
}): LogAdapterCatalogEntry[] {
  const includeAliases = opts?.includeAliases === true;
  return LOG_ADAPTER_CATALOG.filter((e) => includeAliases || !e.aliasOf);
}

export function getCatalogEntry(id: string): LogAdapterCatalogEntry | undefined {
  return LOG_ADAPTER_CATALOG.find((e) => e.id === id);
}
