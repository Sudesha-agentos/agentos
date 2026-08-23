export type WorkspaceFieldType = "text" | "password" | "url";

export type WorkspaceConfigField = {
  key: string;
  label: string;
  type: WorkspaceFieldType;
  required?: boolean;
  secret?: boolean;
  placeholder?: string;
  help?: string;
};

export type WorkspaceProviderCatalog = {
  id: string;
  displayName: string;
  docsUrl: string;
  docsLabel: string;
  steps: string[];
  configSchema: WorkspaceConfigField[];
};

export const WORKSPACE_CONNECTION_CATALOG: WorkspaceProviderCatalog[] = [
  {
    id: "slack",
    displayName: "Slack",
    docsUrl: "https://docs.slack.dev/authentication/tokens",
    docsLabel: "Slack token docs",
    steps: [
      "Open api.slack.com/apps → Create New App → From scratch.",
      "OAuth & Permissions → Bot Token Scopes: channels:history, channels:read, groups:history, users:read.",
      "Install to Workspace, then copy the Bot User OAuth Token (starts with xoxb-).",
    ],
    configSchema: [
      {
        key: "botToken",
        label: "Bot User OAuth Token",
        type: "password",
        required: true,
        secret: true,
        placeholder: "xoxb-…",
        help: "From OAuth & Permissions after installing the app to your workspace.",
      },
    ],
  },
  {
    id: "hubspot",
    displayName: "HubSpot",
    docsUrl: "https://developers.hubspot.com/docs/apps/legacy-apps/private-apps/overview",
    docsLabel: "HubSpot private apps",
    steps: [
      "In HubSpot, go to Development → Legacy apps (super admin required).",
      "Create a private app and grant CRM read scopes (contacts, deals, companies).",
      "Auth tab → Show token → copy the private app access token (pat-…).",
    ],
    configSchema: [
      {
        key: "accessToken",
        label: "Private app access token",
        type: "password",
        required: true,
        secret: true,
        placeholder: "pat-na1-…",
        help: "Send as Authorization: Bearer in HubSpot API calls.",
      },
    ],
  },
  {
    id: "gong",
    displayName: "Gong",
    docsUrl: "https://help.gong.io/docs/create-an-api-key",
    docsLabel: "Gong API keys",
    steps: [
      "In Gong, open Company settings → API (technical admin).",
      "Create an API key and copy both the Access Key and Access Key Secret.",
      "Gong uses HTTP Basic auth: access key as username, secret as password.",
    ],
    configSchema: [
      {
        key: "accessKey",
        label: "Access key",
        type: "password",
        required: true,
        secret: true,
      },
      {
        key: "accessKeySecret",
        label: "Access key secret",
        type: "password",
        required: true,
        secret: true,
      },
    ],
  },
  {
    id: "linear",
    displayName: "Linear",
    docsUrl: "https://linear.app/developers/graphql",
    docsLabel: "Linear GraphQL API",
    steps: [
      "In Linear, open Settings → Account → Security & access.",
      "Create a personal API key (read is enough for agent context).",
      "Copy the key immediately — Linear only shows it once. Header is Authorization: <key> (no Bearer).",
    ],
    configSchema: [
      {
        key: "apiKey",
        label: "Personal API key",
        type: "password",
        required: true,
        secret: true,
        placeholder: "lin_api_…",
      },
    ],
  },
  {
    id: "zendesk",
    displayName: "Zendesk",
    docsUrl: "https://developer.zendesk.com/api-reference/introduction/security-and-auth/",
    docsLabel: "Zendesk API authentication",
    steps: [
      "Admin Center → Apps and integrations → APIs → Zendesk API → Add API token.",
      "Copy the token and use the email of the admin who created it.",
      "Subdomain is the first part of your Zendesk URL (acme in acme.zendesk.com).",
    ],
    configSchema: [
      {
        key: "subdomain",
        label: "Subdomain",
        type: "text",
        required: true,
        placeholder: "acme",
        help: "Only the subdomain — not the full URL.",
      },
      {
        key: "email",
        label: "Admin email",
        type: "text",
        required: true,
        placeholder: "you@company.com",
      },
      {
        key: "apiToken",
        label: "API token",
        type: "password",
        required: true,
        secret: true,
        help: "Basic auth uses {email}/token:{apiToken}.",
      },
    ],
  },
  {
    id: "intercom",
    displayName: "Intercom",
    docsUrl: "https://developers.intercom.com/docs/build-an-integration/learn-more/authentication",
    docsLabel: "Intercom authentication",
    steps: [
      "Open the Intercom Developer Hub and create a private app on your workspace.",
      "Configure → Authentication → copy the Access Token.",
      "Requests use Authorization: Bearer and Accept: application/json.",
    ],
    configSchema: [
      {
        key: "accessToken",
        label: "Access token",
        type: "password",
        required: true,
        secret: true,
      },
    ],
  },
  {
    id: "amplitude",
    displayName: "Amplitude",
    docsUrl: "https://amplitude.com/docs/apis/analytics/dashboard-rest#authentication",
    docsLabel: "Amplitude Dashboard REST API",
    steps: [
      "In Amplitude, open Organization settings → Projects → your project.",
      "Copy the API Key and Secret Key (Dashboard REST uses HTTP Basic: key as user, secret as password).",
      "EU orgs: set region to EU so AgentOX calls analytics.eu.amplitude.com.",
    ],
    configSchema: [
      {
        key: "apiKey",
        label: "API key",
        type: "password",
        required: true,
        secret: true,
      },
      {
        key: "secretKey",
        label: "Secret key",
        type: "password",
        required: true,
        secret: true,
      },
      {
        key: "region",
        label: "Region",
        type: "text",
        placeholder: "us",
        help: "us (default) or eu.",
      },
    ],
  },
];

export function listWorkspaceProviders(): WorkspaceProviderCatalog[] {
  return WORKSPACE_CONNECTION_CATALOG;
}

export function getWorkspaceProvider(id: string): WorkspaceProviderCatalog | undefined {
  return WORKSPACE_CONNECTION_CATALOG.find((entry) => entry.id === id);
}

export function publicWorkspaceCatalog(): Array<
  Omit<WorkspaceProviderCatalog, "configSchema"> & {
    configSchema: Array<Omit<WorkspaceConfigField, never>>;
  }
> {
  return WORKSPACE_CONNECTION_CATALOG.map((entry) => ({
    ...entry,
    configSchema: entry.configSchema.map((field) => ({ ...field })),
  }));
}
