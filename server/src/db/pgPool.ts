import type { PoolConfig } from "pg";

/**
 * Supabase / Render: connection strings often include sslmode=require, which makes
 * node-pg verify certs strictly. Strip sslmode from the URL and set ssl explicitly.
 */
export function pgPoolConfig(connectionString: string): PoolConfig {
  const stripped = connectionString
    .replace(/([?&])sslmode=[^&]*&?/g, "$1")
    .replace(/[?&]$/, "")
    .replace(/\?&/, "?");

  const host = tryParseHost(stripped);
  const isLocal =
    host === "localhost" || host === "127.0.0.1" || host === "";

  return {
    connectionString: stripped,
    ssl: isLocal ? undefined : { rejectUnauthorized: false },
  };
}

function tryParseHost(connectionString: string): string {
  try {
    const normalized = connectionString.replace(
      /^postgresql:\/\//,
      "http://"
    );
    return new URL(normalized).hostname;
  } catch {
    return "";
  }
}
