import { isIP } from "node:net";
import { ValidationError } from "../utils/errors";

const BLOCKED_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "metadata.google.internal",
  "metadata.google.com",
]);

function isPrivateIpv4(host: string): boolean {
  const parts = host.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return false;
  }
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b !== undefined && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 0) return true;
  return false;
}

function isPrivateIpv6(host: string): boolean {
  const normalized = host.toLowerCase();
  return (
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80")
  );
}

/** Reject non-https, localhost, RFC1918, link-local, and cloud metadata targets (SSRF). */
export function assertSafeOutboundUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ValidationError("Invalid URL");
  }
  if (url.protocol !== "https:") {
    throw new ValidationError("Only https URLs are allowed");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (BLOCKED_HOSTS.has(host) || host.endsWith(".localhost") || host === "169.254.169.254") {
    throw new ValidationError("URL host is not allowed");
  }
  const ipVersion = isIP(host);
  if (ipVersion === 4 && isPrivateIpv4(host)) {
    throw new ValidationError("URL host is not allowed");
  }
  if (ipVersion === 6 && isPrivateIpv6(host)) {
    throw new ValidationError("URL host is not allowed");
  }
  return url;
}
