const BLOCKED_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);

function isPrivateIpv4(host) {
  const parts = host.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return false;
  }
  const [a, b] = parts;
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

export function hostnameFromUrl(raw) {
  const url = normalizeWebsiteUrl(raw);
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function normalizeWebsiteUrl(raw) {
  const value = String(raw || "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value.replace(/^\/+/, "")}`;
}

export function isLocalOrPrivateHost(host) {
  const hostname = String(host || "")
    .replace(/^\[|\]$/g, "")
    .toLowerCase();
  if (!hostname) return true;
  if (BLOCKED_HOSTS.has(hostname)) return true;
  if (hostname.endsWith(".local") || hostname.endsWith(".localhost")) return true;
  if (isPrivateIpv4(hostname)) return true;
  return false;
}

/** Public https URL suitable for a live website preview — never localhost or this app. */
export function toPublicWebsiteUrl(raw, appHostname = "") {
  const normalized = normalizeWebsiteUrl(raw);
  if (!normalized) return "";
  try {
    const parsed = new URL(normalized);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
    const host = parsed.hostname.replace(/^\[|\]$/g, "").toLowerCase();
    if (isLocalOrPrivateHost(host)) return "";
    if (appHostname && host === String(appHostname).toLowerCase()) return "";
    if (!host.includes(".")) return "";
    parsed.protocol = "https:";
    parsed.username = "";
    parsed.password = "";
    return parsed.toString();
  } catch {
    return "";
  }
}
