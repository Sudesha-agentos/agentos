import { orgPath } from "../routing/orgPaths";

export const INTEGRATION_CATEGORIES = [
  { id: "source_control", label: "Source control" },
  { id: "issue_tracking", label: "Issue tracking" },
  { id: "data_storage", label: "Data & storage" },
  { id: "observability", label: "Backend & observability" },
  { id: "communication", label: "Communication" },
];

/**
 * connectKind:
 *  - native: dedicated settings page (GitHub / Jira / databases)
 *  - log_source: one-click deep-link to Logs → Sources with provider preselected
 *  - coming_soon: notify-only
 */
const INTEGRATION_DEFS = [
  {
    id: "github",
    name: "GitHub",
    category: "source_control",
    description:
      "GitHub App or PAT for codebase indexing, branch push, and QA sandboxes.",
    catalogStatus: "available",
    connectKind: "native",
    routeParts: ["settings", "integrations", "github"],
    icon: "/marketing/integrations/github-wordmark.svg",
    liveStatusKey: "github",
  },
  {
    id: "bitbucket",
    name: "Bitbucket",
    category: "source_control",
    description:
      "Bitbucket Cloud OAuth for codebase indexing, branch push, and pull requests.",
    catalogStatus: "available",
    connectKind: "native",
    routeParts: ["settings", "integrations", "bitbucket"],
    icon: "/marketing/integrations/bitbucket-wordmark.svg",
    liveStatusKey: "bitbucket",
  },
  {
    id: "jira",
    name: "Jira",
    category: "issue_tracking",
    description:
      "AI Worker queue, webhooks, column mapping, and pipeline ingress from tickets.",
    catalogStatus: "available",
    connectKind: "native",
    routeParts: ["settings", "integrations", "jira"],
    icon: "/marketing/integrations/jira-wordmark.svg",
    liveStatusKey: "jira",
  },
  {
    id: "postgresql",
    name: "PostgreSQL",
    category: "data_storage",
    description:
      "Attach an existing Postgres database (RDS, Neon, Cloud SQL, self-hosted). Agents read schema and apply migrations.",
    catalogStatus: "available",
    connectKind: "native",
    routeParts: ["settings", "integrations", "postgresql"],
    icon: null,
    liveStatusKey: "database:postgresql",
  },
  {
    id: "supabase",
    name: "Supabase",
    category: "data_storage",
    description:
      "Attach your Supabase Postgres so Ananta can inspect tables and apply schema changes with the ticket.",
    catalogStatus: "available",
    connectKind: "native",
    routeParts: ["settings", "integrations", "supabase"],
    icon: "/marketing/integrations/supabase-wordmark.svg",
    liveStatusKey: "database:supabase",
  },
  {
    id: "mysql",
    name: "MySQL",
    category: "data_storage",
    description:
      "Attach an existing MySQL or Aurora MySQL database. Agents can inspect schema and apply migrations.",
    catalogStatus: "available",
    connectKind: "native",
    routeParts: ["settings", "integrations", "mysql"],
    icon: null,
    liveStatusKey: "database:mysql",
  },
  {
    id: "datadog",
    name: "Datadog",
    category: "observability",
    description:
      "One-click link: pull production errors into Log Intelligence for Virin bug diagnosis.",
    catalogStatus: "available",
    connectKind: "log_source",
    logSourceType: "datadog",
    routeParts: ["logs"],
    search: "tab=sources&provider=datadog",
    icon: null,
    liveStatusKey: "log:datadog",
  },
  {
    id: "sentry",
    name: "Sentry",
    category: "observability",
    description:
      "One-click link: auth token + project, or webhook push for crash reports Virin can use.",
    catalogStatus: "available",
    connectKind: "log_source",
    logSourceType: "sentry",
    routeParts: ["logs"],
    search: "tab=sources&provider=sentry",
    icon: null,
    liveStatusKey: "log:sentry",
  },
  {
    id: "grafana",
    name: "Grafana Loki",
    category: "observability",
    description: "One-click link: query Loki for error logs correlated to tickets and pipelines.",
    catalogStatus: "available",
    connectKind: "log_source",
    logSourceType: "grafana_loki",
    routeParts: ["logs"],
    search: "tab=sources&provider=grafana_loki",
    icon: "/marketing/integrations/grafana-wordmark.svg",
    liveStatusKey: "log:grafana_loki",
  },
  {
    id: "render",
    name: "Render",
    category: "observability",
    description: "One-click link: pull Render service logs for production bug analysis.",
    catalogStatus: "available",
    connectKind: "log_source",
    logSourceType: "render",
    routeParts: ["logs"],
    search: "tab=sources&provider=render",
    icon: null,
    liveStatusKey: "log:render",
  },
  {
    id: "railway",
    name: "Railway",
    category: "observability",
    description: "One-click link: pull Railway deployment logs into AgentOX.",
    catalogStatus: "available",
    connectKind: "log_source",
    logSourceType: "railway",
    routeParts: ["logs"],
    search: "tab=sources&provider=railway",
    icon: null,
    liveStatusKey: "log:railway",
  },
  {
    id: "cloudwatch",
    name: "AWS CloudWatch",
    category: "observability",
    description: "One-click link: CloudWatch Logs groups for backend services.",
    catalogStatus: "available",
    connectKind: "log_source",
    logSourceType: "cloudwatch",
    routeParts: ["logs"],
    search: "tab=sources&provider=cloudwatch",
    icon: null,
    liveStatusKey: "log:cloudwatch",
  },
  {
    id: "otlp",
    name: "OTLP / any backend",
    category: "observability",
    description:
      "One-click push endpoint: OpenTelemetry or Vector → AgentOX (universal backend link).",
    catalogStatus: "available",
    connectKind: "log_source",
    logSourceType: "otlp",
    routeParts: ["logs"],
    search: "tab=sources&provider=otlp",
    icon: null,
    liveStatusKey: "log:otlp",
  },
  {
    id: "slack",
    name: "Slack",
    category: "communication",
    description: "Post pipeline approvals, human gates, and agent summaries to Slack channels.",
    catalogStatus: "coming_soon",
    connectKind: "coming_soon",
    routeParts: ["settings", "integrations", "slack"],
    icon: null,
    liveStatusKey: null,
  },
  {
    id: "linear",
    name: "Linear",
    category: "issue_tracking",
    description: "Import Linear issues into the AI Worker queue with bidirectional status sync.",
    catalogStatus: "coming_soon",
    connectKind: "coming_soon",
    routeParts: ["settings", "integrations", "linear"],
    icon: null,
    liveStatusKey: null,
  },
];

export function buildIntegrationsCatalog(orgSlug) {
  return INTEGRATION_DEFS.map(({ routeParts, search, ...item }) => {
    const base = orgPath(orgSlug, ...routeParts);
    return {
      ...item,
      route: search ? `${base}?${search}` : base,
      search: search || null,
    };
  });
}

/** @deprecated Use buildIntegrationsCatalog(orgSlug) */
export const INTEGRATIONS_CATALOG = buildIntegrationsCatalog("workspace");

export function getIntegrationById(id, orgSlug = "workspace") {
  return buildIntegrationsCatalog(orgSlug).find((item) => item.id === id) ?? null;
}

export function groupIntegrationsByCategory(integrations) {
  return INTEGRATION_CATEGORIES.map((category) => ({
    ...category,
    items: integrations.filter((item) => item.category === category.id),
  })).filter((group) => group.items.length > 0);
}

/** Map Settings integration id → Log Intelligence sourceType */
export function logSourceTypeForIntegration(integrationId) {
  const def = INTEGRATION_DEFS.find((d) => d.id === integrationId);
  return def?.logSourceType ?? null;
}
