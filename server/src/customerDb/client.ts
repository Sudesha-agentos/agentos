import { Client } from "pg";
import { ValidationError } from "../utils/errors";
import { assertSafeDatabaseHost } from "./hostGuard";
import { driverForProvider, type CustomerDbConnectionConfig } from "./types";

const CONNECT_TIMEOUT_MS = 8_000;
const QUERY_TIMEOUT_MS = 15_000;
export const QUERY_ROW_LIMIT = 200;

export interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  truncated: boolean;
}

async function withPostgres<T>(
  config: CustomerDbConnectionConfig,
  fn: (client: Client) => Promise<T>
): Promise<T> {
  await assertSafeDatabaseHost(config.host);
  const client = new Client({
    host: config.host,
    port: config.port,
    user: config.username,
    password: config.password,
    database: config.database,
    ssl: config.ssl ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
    statement_timeout: QUERY_TIMEOUT_MS,
    query_timeout: QUERY_TIMEOUT_MS,
  });
  try {
    await client.connect();
    return await fn(client);
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function withMysql<T>(
  config: CustomerDbConnectionConfig,
  fn: (conn: {
    query: (sql: string) => Promise<unknown>;
    end: () => Promise<void>;
  }) => Promise<T>
): Promise<T> {
  await assertSafeDatabaseHost(config.host);
  let mysql: typeof import("mysql2/promise");
  try {
    mysql = await import("mysql2/promise");
  } catch {
    throw new ValidationError("MySQL support is not installed on this server");
  }
  const conn = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.username,
    password: config.password,
    database: config.database,
    ssl: config.ssl ? {} : undefined,
    connectTimeout: CONNECT_TIMEOUT_MS,
  });
  try {
    return await fn(conn);
  } finally {
    await conn.end().catch(() => undefined);
  }
}

function serializeCell(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "bigint") return value.toString();
  if (Buffer.isBuffer(value)) return `[binary ${value.length} bytes]`;
  return value;
}

function toRowObjects(
  fields: Array<{ name: string }>,
  rows: unknown[]
): Record<string, unknown>[] {
  return rows.slice(0, QUERY_ROW_LIMIT).map((row) => {
    if (row && typeof row === "object" && !Array.isArray(row)) {
      const out: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(row as Record<string, unknown>)) {
        out[key] = serializeCell(value);
      }
      return out;
    }
    const out: Record<string, unknown> = {};
    fields.forEach((field, index) => {
      out[field.name] = serializeCell(Array.isArray(row) ? row[index] : null);
    });
    return out;
  });
}

export async function testConnection(config: CustomerDbConnectionConfig): Promise<{ ok: true; server: string }> {
  const driver = driverForProvider(config.provider);
  if (driver === "mysql") {
    return withMysql(config, async (conn) => {
      await conn.query("SELECT 1");
      return { ok: true as const, server: "mysql" };
    });
  }
  return withPostgres(config, async () => ({ ok: true as const, server: "postgresql" }));
}

export async function runQuery(
  config: CustomerDbConnectionConfig,
  sql: string
): Promise<QueryResult> {
  const driver = driverForProvider(config.provider);
  if (driver === "mysql") {
    return withMysql(config, async (conn) => {
      const result = await conn.query(sql);
      const [rows, fields] = Array.isArray(result) ? result : [result, []];
      const rowList = Array.isArray(rows) ? rows : [];
      const fieldList = Array.isArray(fields)
        ? (fields as Array<{ name: string }>)
        : [];
      const objects = toRowObjects(fieldList, rowList);
      return {
        columns: fieldList.map((f) => f.name),
        rows: objects,
        rowCount: rowList.length,
        truncated: rowList.length > QUERY_ROW_LIMIT,
      };
    });
  }
  return withPostgres(config, async (client) => {
    const result = await client.query(sql);
    const rows = result.rows.map((row) => {
      const out: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(row)) {
        out[key] = serializeCell(value);
      }
      return out;
    });
    return {
      columns: result.fields.map((f) => f.name),
      rows: rows.slice(0, QUERY_ROW_LIMIT),
      rowCount: result.rowCount ?? rows.length,
      truncated: rows.length > QUERY_ROW_LIMIT,
    };
  });
}

export async function runExecute(
  config: CustomerDbConnectionConfig,
  sql: string
): Promise<{ rowCount: number }> {
  const driver = driverForProvider(config.provider);
  if (driver === "mysql") {
    return withMysql(config, async (conn) => {
      const result = await conn.query(sql);
      const header = Array.isArray(result) ? result[0] : result;
      const rowCount =
        header && typeof header === "object" && "affectedRows" in header
          ? Number((header as { affectedRows: number }).affectedRows)
          : 0;
      return { rowCount };
    });
  }
  return withPostgres(config, async (client) => {
    const result = await client.query(sql);
    return { rowCount: result.rowCount ?? 0 };
  });
}
