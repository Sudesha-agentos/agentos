import { assertSafeOutboundUrl } from "../../security/assertSafeOutboundUrl";
import { ValidationError } from "../../utils/errors";
import {
  getWorkspaceProvider,
  type WorkspaceProviderCatalog,
} from "./catalog";

export type WorkspaceValidateResult = {
  valid: boolean;
  error?: string;
  metadata?: Record<string, string>;
};

const FETCH_MS = 12_000;

function requiredString(config: Record<string, unknown>, key: string, label: string): string {
  const value = String(config[key] ?? "").trim();
  if (!value) throw new ValidationError(`${label} is required`);
  return value;
}

function asConfig(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new ValidationError("Connection config is required");
  }
  return raw as Record<string, unknown>;
}

async function fetchJson(
  url: string,
  init: RequestInit
): Promise<{ status: number; json: Record<string, unknown> | null; text: string }> {
  assertSafeOutboundUrl(url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_MS);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const text = await res.text().catch(() => "");
    let json: Record<string, unknown> | null = null;
    try {
      json = text ? (JSON.parse(text) as Record<string, unknown>) : null;
    } catch {
      json = null;
    }
    return { status: res.status, json, text };
  } catch (err) {
    if (err instanceof ValidationError) throw err;
    const message = err instanceof Error ? err.message : String(err);
    throw new ValidationError(`Could not reach the provider API: ${message}`);
  } finally {
    clearTimeout(timer);
  }
}

function failStatus(status: number, text: string, fallback: string): WorkspaceValidateResult {
  const snippet = text.replace(/\s+/g, " ").slice(0, 180);
  return {
    valid: false,
    error: status === 401 || status === 403
      ? "Those credentials were rejected. Check the token and try again."
      : snippet || fallback,
  };
}

export function collectConfig(
  provider: WorkspaceProviderCatalog,
  raw: unknown
): Record<string, string> {
  const config = asConfig(raw);
  const out: Record<string, string> = {};
  for (const field of provider.configSchema) {
    const value = String(config[field.key] ?? "").trim();
    if (!value) {
      if (field.required) {
        throw new ValidationError(`${field.label} is required`);
      }
      continue;
    }
    out[field.key] = value;
  }
  return out;
}

function slackValidate(config: Record<string, unknown>): Promise<WorkspaceValidateResult> {
  const token = requiredString(config, "botToken", "Bot User OAuth Token");
  if (!token.startsWith("xoxb-") && !token.startsWith("xoxp-")) {
    return Promise.resolve({
      valid: false,
      error: "Slack tokens start with xoxb- (bot) or xoxp- (user).",
    });
  }
  return fetchJson("https://slack.com/api/auth.test", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  }).then(({ json }) => {
    if (json?.ok === true) {
      return {
        valid: true,
        metadata: {
          team: String(json.team ?? ""),
          teamId: String(json.team_id ?? ""),
          user: String(json.user ?? ""),
        },
      };
    }
    return {
      valid: false,
      error: String(json?.error ?? "Slack rejected this token."),
    };
  });
}

function hubspotValidate(config: Record<string, unknown>): Promise<WorkspaceValidateResult> {
  const token = requiredString(config, "accessToken", "Private app access token");
  return fetchJson("https://api.hubapi.com/account-info/v3/details", {
    headers: { Authorization: `Bearer ${token}` },
  }).then(({ status, json, text }) => {
    if (status >= 200 && status < 300) {
      const portal = json?.portalId ?? json?.accountId ?? json?.hubId;
      return {
        valid: true,
        metadata: {
          portalId: portal != null ? String(portal) : "",
          timeZone: json?.timeZone ? String(json.timeZone) : "",
        },
      };
    }
    return failStatus(status, text, "HubSpot rejected this access token.");
  });
}

function gongValidate(config: Record<string, unknown>): Promise<WorkspaceValidateResult> {
  const accessKey = requiredString(config, "accessKey", "Access key");
  const secret = requiredString(config, "accessKeySecret", "Access key secret");
  const basic = Buffer.from(`${accessKey}:${secret}`).toString("base64");
  return fetchJson("https://api.gong.io/v2/users", {
    headers: { Authorization: `Basic ${basic}`, Accept: "application/json" },
  }).then(({ status, json, text }) => {
    if (status >= 200 && status < 300) {
      const users = Array.isArray(json?.users) ? json.users.length : undefined;
      return {
        valid: true,
        metadata: {
          userCount: users != null ? String(users) : "",
        },
      };
    }
    return failStatus(status, text, "Gong rejected these API keys.");
  });
}

function linearValidate(config: Record<string, unknown>): Promise<WorkspaceValidateResult> {
  const apiKey = requiredString(config, "apiKey", "Personal API key");
  return fetchJson("https://api.linear.app/graphql", {
    method: "POST",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: "{ viewer { id name organization { name urlKey } } }",
    }),
  }).then(({ status, json, text }) => {
    const viewer = (json?.data as Record<string, unknown> | undefined)?.viewer as
      | Record<string, unknown>
      | undefined;
    const org = viewer?.organization as Record<string, unknown> | undefined;
    if (viewer?.id) {
      return {
        valid: true,
        metadata: {
          user: String(viewer.name ?? ""),
          organization: String(org?.name ?? ""),
          urlKey: String(org?.urlKey ?? ""),
        },
      };
    }
    const gqlError = Array.isArray(json?.errors)
      ? String((json.errors[0] as { message?: string })?.message ?? "")
      : "";
    return failStatus(status, gqlError || text, "Linear rejected this API key.");
  });
}

function zendeskSubdomain(raw: string): string {
  const trimmed = raw.trim().toLowerCase().replace(/^https?:\/\//, "");
  const host = (trimmed.split("/")[0] ?? "").replace(/:\d+$/, "");
  if (!host || host === "localhost") {
    throw new ValidationError("Zendesk subdomain should look like acme (from acme.zendesk.com).");
  }
  if (host.includes(".")) {
    if (!host.endsWith(".zendesk.com") || host.split(".").length !== 3) {
      throw new ValidationError("Zendesk subdomain should look like acme (from acme.zendesk.com).");
    }
    return host.slice(0, -".zendesk.com".length);
  }
  if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(host)) {
    throw new ValidationError("Zendesk subdomain should look like acme (from acme.zendesk.com).");
  }
  return host;
}

function zendeskValidate(config: Record<string, unknown>): Promise<WorkspaceValidateResult> {
  const subdomain = zendeskSubdomain(requiredString(config, "subdomain", "Subdomain"));
  const email = requiredString(config, "email", "Admin email");
  const apiToken = requiredString(config, "apiToken", "API token");
  const basic = Buffer.from(`${email}/token:${apiToken}`).toString("base64");
  const url = `https://${subdomain}.zendesk.com/api/v2/users/me.json`;
  return fetchJson(url, {
    headers: { Authorization: `Basic ${basic}`, Accept: "application/json" },
  }).then(({ status, json, text }) => {
    const user = json?.user as Record<string, unknown> | undefined;
    if (status >= 200 && status < 300 && user) {
      return {
        valid: true,
        metadata: {
          subdomain,
          email: String(user.email ?? email),
          name: String(user.name ?? ""),
        },
      };
    }
    return failStatus(status, text, "Zendesk rejected these credentials.");
  });
}

function intercomValidate(config: Record<string, unknown>): Promise<WorkspaceValidateResult> {
  const token = requiredString(config, "accessToken", "Access token");
  return fetchJson("https://api.intercom.io/me", {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Intercom-Version": "2.11",
    },
  }).then(({ status, json, text }) => {
    if (status >= 200 && status < 300) {
      const app = json?.app as Record<string, unknown> | undefined;
      return {
        valid: true,
        metadata: {
          name: String(json?.name ?? json?.email ?? ""),
          appId: String(app?.id_code ?? app?.id ?? ""),
        },
      };
    }
    return failStatus(status, text, "Intercom rejected this access token.");
  });
}

function amplitudeRegion(raw: unknown): "us" | "eu" {
  const value = String(raw ?? "us").trim().toLowerCase();
  return value === "eu" ? "eu" : "us";
}

function amplitudeValidate(config: Record<string, unknown>): Promise<WorkspaceValidateResult> {
  const apiKey = requiredString(config, "apiKey", "API key");
  const secretKey = requiredString(config, "secretKey", "Secret key");
  const region = amplitudeRegion(config.region);
  const host =
    region === "eu" ? "https://analytics.eu.amplitude.com" : "https://amplitude.com";
  const basic = Buffer.from(`${apiKey}:${secretKey}`).toString("base64");
  return fetchJson(`${host}/api/2/taxonomy`, {
    headers: { Authorization: `Basic ${basic}`, Accept: "application/json" },
  }).then(({ status, text }) => {
    if (status >= 200 && status < 300) {
      return { valid: true, metadata: { region } };
    }
    return failStatus(status, text, "Amplitude rejected this API key and secret.");
  });
}

const VALIDATORS: Record<
  string,
  (config: Record<string, unknown>) => Promise<WorkspaceValidateResult>
> = {
  slack: slackValidate,
  hubspot: hubspotValidate,
  gong: gongValidate,
  linear: linearValidate,
  zendesk: zendeskValidate,
  intercom: intercomValidate,
  amplitude: amplitudeValidate,
};

export async function validateWorkspaceConfig(
  providerId: string,
  rawConfig: unknown
): Promise<WorkspaceValidateResult> {
  const provider = getWorkspaceProvider(providerId);
  if (!provider) {
    throw new ValidationError(`Unknown integration: ${providerId}`);
  }
  const config = collectConfig(provider, rawConfig);
  const validator = VALIDATORS[providerId];
  if (!validator) {
    throw new ValidationError(`No validator for ${providerId}`);
  }
  try {
    return await validator(config);
  } catch (err) {
    if (err instanceof ValidationError) {
      return { valid: false, error: err.message };
    }
    const message = err instanceof Error ? err.message : String(err);
    return { valid: false, error: message };
  }
}

export { zendeskSubdomain, amplitudeRegion };
