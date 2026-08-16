import { Client } from "pg";
import { assertSafeDatabaseHost } from "./hostGuard";
import { driverForProvider, type CustomerDbConnectionConfig, type CustomerDbTableCatalog } from "./types";
import { ValidationError } from "../utils/errors";

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

async function introspectPostgres(
  config: CustomerDbConnectionConfig,
  schemaAllowlist: string[]
): Promise<CustomerDbTableCatalog[]> {
  await assertSafeDatabaseHost(config.host);
  const allow = schemaAllowlist.map((s) => s.trim()).filter(Boolean);
  const schemaFilter = allow.length
    ? `AND n.nspname = ANY($1::text[])`
    : `AND n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')`;
  const client = new Client({
    host: config.host,
    port: config.port,
    user: config.username,
    password: config.password,
    database: config.database,
    ssl: config.ssl ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 8000,
    statement_timeout: 15000,
  });
  await client.connect();
  try {
    const tables = await client.query(
      `SELECT n.nspname AS schema_name, c.relname AS table_name,
              COALESCE(s.n_live_tup, 0)::int AS row_estimate
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
       WHERE c.relkind = 'r'
       ${schemaFilter}
       ORDER BY n.nspname, c.relname
       LIMIT 400`,
      allow.length ? [allow] : []
    );
    const catalogs: CustomerDbTableCatalog[] = [];
    for (const table of tables.rows) {
      const schemaName = String(table.schema_name);
      const tableName = String(table.table_name);
      const [columns, pks, fks, indexes] = await Promise.all([
        client.query(
          `SELECT column_name, data_type, is_nullable, column_default
           FROM information_schema.columns
           WHERE table_schema = $1 AND table_name = $2
           ORDER BY ordinal_position`,
          [schemaName, tableName]
        ),
        client.query(
          `SELECT a.attname AS column_name
           FROM pg_index i
           JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
           JOIN pg_class c ON c.oid = i.indrelid
           JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE i.indisprimary AND n.nspname = $1 AND c.relname = $2`,
          [schemaName, tableName]
        ),
        client.query(
          `SELECT
             kcu.column_name,
             ccu.table_schema AS referenced_schema,
             ccu.table_name AS referenced_table,
             ccu.column_name AS referenced_column
           FROM information_schema.table_constraints tc
           JOIN information_schema.key_column_usage kcu
             ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
           JOIN information_schema.constraint_column_usage ccu
             ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
           WHERE tc.constraint_type = 'FOREIGN KEY'
             AND tc.table_schema = $1 AND tc.table_name = $2`,
          [schemaName, tableName]
        ),
        client.query(
          `SELECT i.relname AS index_name, ix.indisunique AS is_unique,
                  array_agg(a.attname ORDER BY array_position(ix.indkey, a.attnum)) AS columns
           FROM pg_index ix
           JOIN pg_class t ON t.oid = ix.indrelid
           JOIN pg_class i ON i.oid = ix.indexrelid
           JOIN pg_namespace n ON n.oid = t.relnamespace
           JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
           WHERE n.nspname = $1 AND t.relname = $2 AND NOT ix.indisprimary
           GROUP BY i.relname, ix.indisunique`,
          [schemaName, tableName]
        ),
      ]);
      catalogs.push({
        schemaName,
        tableName,
        columns: columns.rows.map((col) => ({
          name: String(col.column_name),
          type: String(col.data_type),
          nullable: String(col.is_nullable).toUpperCase() === "YES",
          default: col.column_default == null ? null : String(col.column_default),
        })),
        primaryKeys: pks.rows.map((row) => String(row.column_name)),
        foreignKeys: fks.rows.map((row) => ({
          column: String(row.column_name),
          referencedSchema: String(row.referenced_schema),
          referencedTable: String(row.referenced_table),
          referencedColumn: String(row.referenced_column),
        })),
        indexes: indexes.rows.map((row) => ({
          name: String(row.index_name),
          columns: asStringArray(row.columns),
          unique: Boolean(row.is_unique),
        })),
        rowEstimate: Number(table.row_estimate) || null,
      });
    }
    return catalogs;
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function introspectMysql(
  config: CustomerDbConnectionConfig,
  schemaAllowlist: string[]
): Promise<CustomerDbTableCatalog[]> {
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
    connectTimeout: 8000,
  });
  try {
    const allow = schemaAllowlist.map((s) => s.trim()).filter(Boolean);
    const [tableRows] = allow.length
      ? await conn.query(
          `SELECT table_schema AS schema_name, table_name
           FROM information_schema.tables
           WHERE table_type = 'BASE TABLE' AND table_schema IN (?)
           ORDER BY table_schema, table_name
           LIMIT 400`,
          [allow]
        )
      : await conn.query(
          `SELECT table_schema AS schema_name, table_name
           FROM information_schema.tables
           WHERE table_type = 'BASE TABLE' AND table_schema = DATABASE()
           ORDER BY table_schema, table_name
           LIMIT 400`
        );
    const tables = Array.isArray(tableRows) ? tableRows : [];
    const catalogs: CustomerDbTableCatalog[] = [];
    for (const table of tables as Array<{ schema_name: string; table_name: string }>) {
      const schemaName = String(table.schema_name);
      const tableName = String(table.table_name);
      const [columnRows] = await conn.query(
        `SELECT column_name, data_type, is_nullable, column_default
         FROM information_schema.columns
         WHERE table_schema = ? AND table_name = ?
         ORDER BY ordinal_position`,
        [schemaName, tableName]
      );
      const columns = Array.isArray(columnRows) ? columnRows : [];
      catalogs.push({
        schemaName,
        tableName,
        columns: (columns as Array<Record<string, unknown>>).map((col) => ({
          name: String(col.column_name),
          type: String(col.data_type),
          nullable: String(col.is_nullable).toUpperCase() === "YES",
          default: col.column_default == null ? null : String(col.column_default),
        })),
        primaryKeys: [],
        foreignKeys: [],
        indexes: [],
        rowEstimate: null,
      });
    }
    return catalogs;
  } finally {
    await conn.end().catch(() => undefined);
  }
}

export async function introspectDatabase(
  config: CustomerDbConnectionConfig,
  schemaAllowlist: string[]
): Promise<CustomerDbTableCatalog[]> {
  if (driverForProvider(config.provider) === "mysql") {
    return introspectMysql(config, schemaAllowlist);
  }
  return introspectPostgres(config, schemaAllowlist);
}
