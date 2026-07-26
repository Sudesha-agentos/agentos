/** Frontend URL helpers for OAuth redirects and setup links. */

/** Old Vercel preview — never send post-login users here. */
const LEGACY_FRONTEND_HOSTS = new Set([
  "agentos-blue.vercel.app",
  "www.agentos-blue.vercel.app",
  "agentos.vercel.app",
]);

const CANONICAL_PRODUCTION_FRONTEND = "https://agentox.io";

function normalizeFrontendBase(raw: string): string {
  let base = raw.trim().replace(/\/$/, "");
  base = base.replace(/\/app(\/.*)?$/i, "");

  try {
    const u = new URL(base);
    const host = u.hostname.toLowerCase();
    if (LEGACY_FRONTEND_HOSTS.has(host)) {
      return CANONICAL_PRODUCTION_FRONTEND;
    }
  } catch {
    /* keep as-is if not a full URL */
  }

  return base;
}

/**
 * Where the API sends browsers after Google/GitHub/Jira OAuth.
 * Legacy agentos-blue.vercel.app is rewritten to agentox.io so a stale
 * Render FRONTEND_URL cannot strand users on the old site.
 */
export function frontendBaseUrl(): string {
  const configured = process.env.FRONTEND_URL?.trim();
  if (configured) {
    return normalizeFrontendBase(configured);
  }

  // Production API without FRONTEND_URL → canonical product domain
  const nodeEnv = process.env.NODE_ENV?.trim();
  const publicApi = process.env.PUBLIC_API_URL?.trim() ?? "";
  if (
    nodeEnv === "production" ||
    /onrender\.com/i.test(publicApi) ||
    process.env.RENDER === "true"
  ) {
    return CANONICAL_PRODUCTION_FRONTEND;
  }

  return "";
}

export function frontendIntegrationUrl(
  orgSlug: string,
  integration: "github" | "jira"
): string {
  const base = frontendBaseUrl();
  if (!base || !orgSlug.trim()) return "";
  return `${base}/${orgSlug.trim()}/settings/integrations/${integration}`;
}
