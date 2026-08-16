import { isIP } from "node:net";
import { lookup } from "node:dns/promises";
import { ValidationError } from "../utils/errors";

const BLOCKED_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "metadata.google.internal",
  "metadata.google.com",
  "instance-data",
]);

const HOST_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9.-]{0,251}[a-zA-Z0-9])?$/;

function isLoopbackIpv4(host: string): boolean {
  const parts = host.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return false;
  }
  return parts[0] === 127 || parts[0] === 0;
}

function isLinkLocalIpv4(host: string): boolean {
  const parts = host.split(".").map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return false;
  }
  return parts[0] === 169 && parts[1] === 254;
}

function isBlockedIp(host: string): boolean {
  const normalized = host.replace(/^\[|\]$/g, "").toLowerCase();
  const version = isIP(normalized);
  if (version === 4) {
    return isLoopbackIpv4(normalized) || isLinkLocalIpv4(normalized);
  }
  if (version === 6) {
    return (
      normalized === "::1" ||
      normalized === "::" ||
      normalized.startsWith("fe80") ||
      normalized === "169.254.169.254"
    );
  }
  return false;
}

export function assertSafeDatabaseHostShape(host: string): string {
  const trimmed = host.trim().toLowerCase().replace(/\.$/, "");
  if (!trimmed) {
    throw new ValidationError("Database host is required");
  }
  if (trimmed.includes("/") || trimmed.includes(":") && !isIP(trimmed.replace(/^\[|\]$/g, ""))) {
    const withoutBrackets = trimmed.replace(/^\[|\]$/g, "");
    if (isIP(withoutBrackets) !== 6) {
      throw new ValidationError("Database host must be a hostname or IP, not a URL");
    }
  }
  const hostOnly = trimmed.replace(/^\[|\]$/g, "");
  if (BLOCKED_HOSTS.has(hostOnly) || hostOnly.endsWith(".localhost") || hostOnly === "169.254.169.254") {
    throw new ValidationError("Database host is not allowed");
  }
  if (isBlockedIp(hostOnly)) {
    throw new ValidationError("Database host is not allowed");
  }
  if (!HOST_RE.test(hostOnly) && isIP(hostOnly) === 0) {
    throw new ValidationError("Enter a valid database hostname");
  }
  return hostOnly;
}

/** Block loopback and cloud metadata. RFC1918 private IPs are allowed for VPC databases. */
export async function assertSafeDatabaseHost(host: string): Promise<string> {
  const normalized = assertSafeDatabaseHostShape(host);
  if (isIP(normalized)) return normalized;

  try {
    const results = await lookup(normalized, { all: true, verbatim: true });
    for (const result of results) {
      if (isBlockedIp(result.address) || BLOCKED_HOSTS.has(result.address)) {
        throw new ValidationError("Database host is not allowed");
      }
    }
  } catch (err) {
    if (err instanceof ValidationError) throw err;
    // Unresolvable from this network is OK — connection will fail later.
  }
  return normalized;
}
