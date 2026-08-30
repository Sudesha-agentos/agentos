const API_ERROR_MESSAGES: Record<string, string> = {
  email_exists: "An account with this email already exists. Sign in instead.",
  organization_already_assigned: "You already belong to a workspace.",
  organization_not_found: "That workspace was not found.",
  organization_domain_mismatch: "You can only join workspaces on your email domain.",
  unauthorized: "Your session expired. Please sign in again.",
  invalid_credentials: "Incorrect email or password.",
};

export function formatApiError(bodyText: string, status: number): string {
  if (!bodyText) {
    return `Request failed (${status})`;
  }

  try {
    const body = JSON.parse(bodyText) as {
      error?: string;
      message?: string;
    };
    if (body.message?.trim()) {
      return body.message.trim();
    }
    if (body.error && API_ERROR_MESSAGES[body.error]) {
      return API_ERROR_MESSAGES[body.error];
    }
    if (body.error) {
      return String(body.error).replace(/_/g, " ");
    }
  } catch {
    /* not JSON */
  }

  return bodyText.length > 240 ? `${bodyText.slice(0, 240)}…` : bodyText;
}

export async function fetchJson(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (init.body != null && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(path, {
    ...init,
    headers,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(formatApiError(text, res.status));
  }

  if (res.status === 204) return null;
  return res.json();
}
