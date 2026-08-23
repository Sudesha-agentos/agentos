import { DATA_MODE, DATA_MODES } from "../../shared/config/app";
import { apiPath } from "../../shared/config/apiBase";
import { authHeaders } from "../../shared/lib/authHeaders";
import { fetchJson } from "../../shared/lib/fetchJson";

const STORE_KEY = "agentos.workspaceConnections";

function root(path = "") {
  return apiPath("/api", `/integrations/workspace${path}`);
}

function readMock() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeMock(connections) {
  localStorage.setItem(STORE_KEY, JSON.stringify(connections));
}

const FALLBACK_CATALOG = [
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
      },
    ],
  },
  {
    id: "hubspot",
    displayName: "HubSpot",
    docsUrl: "https://developers.hubspot.com/docs/apps/legacy-apps/private-apps/overview",
    docsLabel: "HubSpot private apps",
    steps: [
      "Development → Legacy apps → create a private app with CRM read scopes.",
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
      },
    ],
  },
  {
    id: "gong",
    displayName: "Gong",
    docsUrl: "https://help.gong.io/docs/create-an-api-key",
    docsLabel: "Gong API keys",
    steps: [
      "Company settings → API → create an Access Key and Access Key Secret.",
    ],
    configSchema: [
      { key: "accessKey", label: "Access key", type: "password", required: true, secret: true },
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
      "Settings → Account → Security & access → create a personal API key.",
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
    ],
    configSchema: [
      { key: "subdomain", label: "Subdomain", type: "text", required: true, placeholder: "acme" },
      { key: "email", label: "Admin email", type: "text", required: true },
      { key: "apiToken", label: "API token", type: "password", required: true, secret: true },
    ],
  },
  {
    id: "intercom",
    displayName: "Intercom",
    docsUrl: "https://developers.intercom.com/docs/build-an-integration/learn-more/authentication",
    docsLabel: "Intercom authentication",
    steps: [
      "Developer Hub → private app → Configure → Authentication → Access Token.",
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
      "Organization settings → Projects → copy API Key and Secret Key.",
    ],
    configSchema: [
      { key: "apiKey", label: "API key", type: "password", required: true, secret: true },
      { key: "secretKey", label: "Secret key", type: "password", required: true, secret: true },
      { key: "region", label: "Region", type: "text", placeholder: "us" },
    ],
  },
];

function mockConnection(provider, config) {
  const hints = {};
  for (const [key, value] of Object.entries(config || {})) {
    const text = String(value || "");
    if (text) hints[key] = text.length <= 4 ? "••••" : `…${text.slice(-4)}`;
  }
  return {
    id: `mock_${provider}`,
    provider,
    displayName: provider,
    connected: true,
    metadata: { mode: "mock" },
    lastVerifiedAt: new Date().toISOString(),
    lastError: null,
    createdAt: new Date().toISOString(),
    secretHints: hints,
  };
}

const restAdapter = {
  catalog: () => fetchJson(root("/catalog"), { headers: authHeaders() }),
  list: () => fetchJson(root(), { headers: authHeaders() }),
  validate: (provider, config) =>
    fetchJson(root(`/${encodeURIComponent(provider)}/validate`), {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ config }),
    }),
  connect: (provider, config, displayName) =>
    fetchJson(root(`/${encodeURIComponent(provider)}`), {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ config, displayName }),
    }),
  disconnect: (provider) =>
    fetchJson(root(`/${encodeURIComponent(provider)}`), {
      method: "DELETE",
      headers: authHeaders(),
    }),
};

const mockAdapter = {
  catalog: async () => ({ catalog: FALLBACK_CATALOG }),
  list: async () => ({ connections: readMock() }),
  validate: async (_provider, config) => {
    const values = Object.values(config || {}).filter((value) => String(value || "").trim());
    if (!values.length) throw new Error("Enter the required credentials first.");
    return { ok: true, metadata: { mode: "mock" } };
  },
  connect: async (provider, config, displayName) => {
    const connection = {
      ...mockConnection(provider, config),
      displayName: displayName || provider,
    };
    const next = readMock().filter((item) => item.provider !== provider);
    next.push(connection);
    writeMock(next);
    return { connection };
  },
  disconnect: async (provider) => {
    writeMock(readMock().filter((item) => item.provider !== provider));
    return { deleted: true };
  },
};

const adapter = DATA_MODE === DATA_MODES.REST ? restAdapter : mockAdapter;

export async function fetchWorkspaceCatalog() {
  try {
    return await adapter.catalog();
  } catch {
    return { catalog: FALLBACK_CATALOG };
  }
}

export async function listWorkspaceConnections() {
  return adapter.list();
}

export async function validateWorkspaceConnection(provider, config) {
  return adapter.validate(provider, config);
}

export async function connectWorkspace(provider, config, displayName) {
  return adapter.connect(provider, config, displayName);
}

export async function disconnectWorkspace(provider) {
  return adapter.disconnect(provider);
}
