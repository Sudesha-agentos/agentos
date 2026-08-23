import { orgPath } from "../routing/orgPaths";

export const INTEGRATION_CATEGORIES = [
  {
    id: "source_control",
    label: "Source control",
    description: "Repositories agents index, read, and open pull requests against.",
  },
  {
    id: "issue_tracking",
    label: "Issue tracking",
    description: "Tickets and work items agents use to start and stay aligned with delivery.",
  },
  {
    id: "business_data",
    label: "Business Data",
    description: "Business data sources injected as read context into all AI agents.",
  },
  {
    id: "data_storage",
    label: "Data & storage",
    description: "Databases agents can inspect and apply schema changes against.",
  },
  {
    id: "observability",
    label: "Backend & observability",
    description: "Logs and production signals agents use for diagnosis.",
  },
];

/**
 * connectKind:
 *  - native: dedicated connect page (GitHub / Jira / databases)
 *  - log_source: connect a log adapter from the integrations page
 *  - workspace: token/API-key connect for business data apps
 */
const INTEGRATION_DEFS = [
  {
    id: "github",
    name: "GitHub",
    category: "source_control",
    tag: "Source Control",
    description:
      "Index the repository, push implementation branches, and open draft pull requests from agent work.",
    catalogStatus: "available",
    connectKind: "native",
    routeParts: ["integrations", "github"],
    icon: "/marketing/integrations/github-wordmark.svg",
    liveStatusKey: "github",
  },
  {
    id: "bitbucket",
    name: "Bitbucket",
    category: "source_control",
    tag: "Source Control",
    description:
      "Connect Bitbucket Cloud so agents can index the repo, push branches, and open pull requests.",
    catalogStatus: "available",
    connectKind: "native",
    routeParts: ["integrations", "bitbucket"],
    icon: "/marketing/integrations/bitbucket-wordmark.svg",
    liveStatusKey: "bitbucket",
  },
  {
    id: "jira",
    name: "Jira",
    category: "issue_tracking",
    tag: "Project Management",
    description:
      "Ingest tickets as work for Virin, Ananta, and Neel — from the AI Worker queue through writeback.",
    catalogStatus: "available",
    connectKind: "native",
    routeParts: ["integrations", "jira"],
    icon: "/marketing/integrations/jira-wordmark.svg",
    liveStatusKey: "jira",
  },
  {
    id: "spreadsheet",
    name: "Spreadsheet",
    category: "issue_tracking",
    tag: "Project Management",
    description:
      "Upload Excel or CSV to a Kanban board. Drag tickets into AI Worker to run agents without Jira.",
    catalogStatus: "available",
    connectKind: "native",
    routeParts: ["integrations", "spreadsheet"],
    icon: null,
    liveStatusKey: "spreadsheet",
  },
  {
    id: "slack",
    name: "Slack",
    category: "business_data",
    tag: "Communication",
    description:
      "Surface customer conversations, alerts, and team signals as AI-accessible context.",
    catalogStatus: "available",
    connectKind: "workspace",
    routeParts: ["integrations", "slack"],
    icon: null,
    liveStatusKey: "workspace:slack",
  },
  {
    id: "hubspot",
    name: "HubSpot",
    category: "business_data",
    tag: "CRM",
    description:
      "Pull CRM data — contacts, deals, companies — into the AI's context for account-aware responses.",
    catalogStatus: "available",
    connectKind: "workspace",
    routeParts: ["integrations", "hubspot"],
    icon: null,
    liveStatusKey: "workspace:hubspot",
  },
  {
    id: "gong",
    name: "Gong",
    category: "business_data",
    tag: "Revenue Intelligence",
    description:
      "Feed call recordings and revenue intelligence into agents for product and sales insights.",
    catalogStatus: "available",
    connectKind: "workspace",
    routeParts: ["integrations", "gong"],
    icon: null,
    liveStatusKey: "workspace:gong",
  },
  {
    id: "linear",
    name: "Linear",
    category: "business_data",
    tag: "Project Management",
    description:
      "Sync issues, projects, and milestones so agents stay aligned with your engineering roadmap.",
    catalogStatus: "available",
    connectKind: "workspace",
    routeParts: ["integrations", "linear"],
    icon: null,
    liveStatusKey: "workspace:linear",
  },
  {
    id: "zendesk",
    name: "Zendesk",
    category: "business_data",
    tag: "Customer Support",
    description:
      "Ingest support tickets as customer signals — surface pain points and feature requests from real conversations.",
    catalogStatus: "available",
    connectKind: "workspace",
    routeParts: ["integrations", "zendesk"],
    icon: null,
    liveStatusKey: "workspace:zendesk",
  },
  {
    id: "intercom",
    name: "Intercom",
    category: "business_data",
    tag: "Customer Support",
    description:
      "Pull customer conversations and support threads as signals to understand common themes and friction.",
    catalogStatus: "available",
    connectKind: "workspace",
    routeParts: ["integrations", "intercom"],
    icon: null,
    liveStatusKey: "workspace:intercom",
  },
  {
    id: "amplitude",
    name: "Amplitude",
    category: "business_data",
    tag: "Product Analytics",
    description:
      "Bring product analytics — funnels, retention, and feature usage — into agent context for data-informed decisions.",
    catalogStatus: "available",
    connectKind: "workspace",
    routeParts: ["integrations", "amplitude"],
    icon: null,
    liveStatusKey: "workspace:amplitude",
  },
  {
    id: "postgresql",
    name: "PostgreSQL",
    category: "data_storage",
    tag: "Database",
    description:
      "Attach an existing Postgres database. Agents read schema and apply migrations with the ticket.",
    catalogStatus: "available",
    connectKind: "native",
    routeParts: ["integrations", "postgresql"],
    icon: null,
    liveStatusKey: "database:postgresql",
  },
  {
    id: "supabase",
    name: "Supabase",
    category: "data_storage",
    tag: "Database",
    description:
      "Attach your Supabase Postgres so Ananta can inspect tables and apply schema changes with the ticket.",
    catalogStatus: "available",
    connectKind: "native",
    routeParts: ["integrations", "supabase"],
    icon: "/marketing/integrations/supabase-wordmark.svg",
    liveStatusKey: "database:supabase",
  },
  {
    id: "mysql",
    name: "MySQL",
    category: "data_storage",
    tag: "Database",
    description:
      "Attach an existing MySQL or Aurora MySQL database. Agents can inspect schema and apply migrations.",
    catalogStatus: "available",
    connectKind: "native",
    routeParts: ["integrations", "mysql"],
    icon: null,
    liveStatusKey: "database:mysql",
  },
  {
    id: "datadog",
    name: "Datadog",
    category: "observability",
    tag: "Observability",
    description:
      "Pull production errors into Log Intelligence for Virin bug diagnosis.",
    catalogStatus: "available",
    connectKind: "log_source",
    logSourceType: "datadog",
    routeParts: ["integrations", "datadog"],
    icon: null,
    liveStatusKey: "log:datadog",
  },
  {
    id: "sentry",
    name: "Sentry",
    category: "observability",
    tag: "Observability",
    description:
      "Auth token + project, or webhook push, for crash reports Virin can use.",
    catalogStatus: "available",
    connectKind: "log_source",
    logSourceType: "sentry",
    routeParts: ["integrations", "sentry"],
    icon: null,
    liveStatusKey: "log:sentry",
  },
  {
    id: "grafana",
    name: "Grafana Loki",
    category: "observability",
    tag: "Observability",
    description: "Query Loki for error logs correlated to tickets and pipelines.",
    catalogStatus: "available",
    connectKind: "log_source",
    logSourceType: "grafana_loki",
    routeParts: ["integrations", "grafana"],
    icon: "/marketing/integrations/grafana-wordmark.svg",
    liveStatusKey: "log:grafana_loki",
  },
  {
    id: "render",
    name: "Render",
    category: "observability",
    tag: "Observability",
    description: "Pull Render service logs for production bug analysis.",
    catalogStatus: "available",
    connectKind: "log_source",
    logSourceType: "render",
    routeParts: ["integrations", "render"],
    icon: null,
    liveStatusKey: "log:render",
  },
  {
    id: "railway",
    name: "Railway",
    category: "observability",
    tag: "Observability",
    description: "Pull Railway deployment logs into AgentOX.",
    catalogStatus: "available",
    connectKind: "log_source",
    logSourceType: "railway",
    routeParts: ["integrations", "railway"],
    icon: null,
    liveStatusKey: "log:railway",
  },
  {
    id: "cloudwatch",
    name: "AWS CloudWatch",
    category: "observability",
    tag: "Observability",
    description: "CloudWatch Logs groups for backend services.",
    catalogStatus: "available",
    connectKind: "log_source",
    logSourceType: "cloudwatch",
    routeParts: ["integrations", "cloudwatch"],
    icon: null,
    liveStatusKey: "log:cloudwatch",
  },
  {
    id: "otlp",
    name: "OTLP / any backend",
    category: "observability",
    tag: "Observability",
    description:
      "OpenTelemetry or Vector push endpoint — a universal backend link into AgentOX.",
    catalogStatus: "available",
    connectKind: "log_source",
    logSourceType: "otlp",
    routeParts: ["integrations", "otlp"],
    icon: null,
    liveStatusKey: "log:otlp",
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
