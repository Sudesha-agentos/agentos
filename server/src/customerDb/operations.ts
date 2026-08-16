import { AppError, ValidationError } from "../utils/errors";
import { runExecute, runQuery, testConnection, type QueryResult } from "./client";
import { introspectDatabase } from "./introspect";
import { classifySql } from "./sqlGuard";
import {
  createMigrationRecord,
  getConnectionConfig,
  getDatabaseRow,
  getMigration,
  listTableCatalog,
  recordDatabaseError,
  replaceTableCatalog,
  toPublicDatabase,
  updateMigrationRecord,
  type OrganizationDatabaseMigrationRow,
} from "./store";
import type { PublicOrganizationDatabase } from "./types";

export class ConfirmationRequiredError extends AppError {
  constructor(message: string, metadata?: Record<string, unknown>) {
    super("CONFIRMATION_REQUIRED", message, 409, metadata);
    this.name = "ConfirmationRequiredError";
  }
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function shouldAutoApply(row: {
  environment: string;
  autoMigrate: boolean;
  requireConfirmToApply: boolean;
}): boolean {
  if (row.environment === "production" || row.requireConfirmToApply) return false;
  return row.autoMigrate;
}

export async function testDatabaseConnection(
  organizationId: string,
  databaseId: string
): Promise<{ ok: true; server: string; database: PublicOrganizationDatabase }> {
  const { row, config } = await getConnectionConfig(organizationId, databaseId);
  try {
    const result = await testConnection(config);
    await recordDatabaseError(databaseId, null);
    return { ...result, database: toPublicDatabase(row) };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Connection failed";
    await recordDatabaseError(databaseId, message);
    throw new ValidationError(`Could not connect: ${message}`);
  }
}

export async function introspectAndStore(
  organizationId: string,
  databaseId: string
): Promise<{ database: PublicOrganizationDatabase; tables: Awaited<ReturnType<typeof listTableCatalog>> }> {
  const { row, config } = await getConnectionConfig(organizationId, databaseId);
  try {
    const tables = await introspectDatabase(config, asStringArray(row.schemaAllowlist));
    await replaceTableCatalog(databaseId, tables);
    const refreshed = await getDatabaseRow(organizationId, databaseId);
    return {
      database: toPublicDatabase(refreshed, tables.length),
      tables,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Introspection failed";
    await recordDatabaseError(databaseId, message);
    throw new ValidationError(`Could not read schema: ${message}`);
  }
}

export async function queryDatabase(
  organizationId: string,
  databaseId: string,
  sql: string
): Promise<QueryResult> {
  const classified = classifySql(sql);
  if (classified.kind !== "query") {
    throw new ValidationError(classified.reason ?? "Only SELECT/EXPLAIN/SHOW statements are allowed on query");
  }
  const { config } = await getConnectionConfig(organizationId, databaseId);
  return runQuery(config, sql);
}

export async function executeDatabase(
  organizationId: string,
  databaseId: string,
  sql: string,
  confirm = false
): Promise<{ rowCount: number }> {
  const classified = classifySql(sql);
  if (classified.kind === "forbidden") {
    throw new ValidationError(classified.reason ?? "Statement is not allowed");
  }
  if (classified.kind !== "execute") {
    throw new ValidationError("Use the migrate endpoint for schema changes, or query for SELECT");
  }
  const { row, config } = await getConnectionConfig(organizationId, databaseId);
  const needsConfirm = classified.needsConfirm || row.environment === "production";
  if (needsConfirm && !confirm) {
    throw new ConfirmationRequiredError(
      classified.reason ?? "Production writes require confirmation",
      { kind: classified.kind, keyword: classified.keyword }
    );
  }
  return runExecute(config, sql);
}

export async function migrateDatabase(
  organizationId: string,
  databaseId: string,
  sql: string,
  options: { confirm?: boolean; pipelineId?: string } = {}
): Promise<{
  migration: OrganizationDatabaseMigrationRow;
  applied: boolean;
  needsConfirmation?: boolean;
}> {
  const classified = classifySql(sql);
  if (classified.kind === "forbidden") {
    throw new ValidationError(classified.reason ?? "Statement is not allowed");
  }
  if (classified.kind !== "migrate") {
    throw new ValidationError("db_migrate only accepts DDL (CREATE/ALTER/DROP/COMMENT)");
  }
  const { row, config } = await getConnectionConfig(organizationId, databaseId);
  const auto = shouldAutoApply(row);
  const needsConfirm = !auto || classified.needsConfirm || Boolean(row.requireConfirmToApply);
  if (needsConfirm && !options.confirm) {
    const migration = await createMigrationRecord({
      databaseId,
      pipelineId: options.pipelineId,
      sql,
      status: "awaiting_confirm",
    });
    return { migration, applied: false, needsConfirmation: true };
  }

  const migration = await createMigrationRecord({
    databaseId,
    pipelineId: options.pipelineId,
    sql,
    status: "pending",
  });
  try {
    await runExecute(config, sql);
    const updated = await updateMigrationRecord(migration.id, {
      status: "applied",
      appliedAt: new Date(),
      error: null,
    });
    await recordDatabaseError(databaseId, null);
    return { migration: updated, applied: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Migration failed";
    const updated = await updateMigrationRecord(migration.id, {
      status: "failed",
      error: message,
    });
    await recordDatabaseError(databaseId, message);
    return { migration: updated, applied: false };
  }
}

export async function confirmMigration(
  organizationId: string,
  databaseId: string,
  migrationId: string
): Promise<{ migration: OrganizationDatabaseMigrationRow; applied: boolean }> {
  const existing = await getMigration(organizationId, databaseId, migrationId);
  if (existing.status === "applied") {
    return { migration: existing, applied: true };
  }
  const { config } = await getConnectionConfig(organizationId, databaseId);
  try {
    await runExecute(config, existing.sql);
    const updated = await updateMigrationRecord(existing.id, {
      status: "applied",
      appliedAt: new Date(),
      error: null,
    });
    await recordDatabaseError(databaseId, null);
    return { migration: updated, applied: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Migration failed";
    const updated = await updateMigrationRecord(existing.id, {
      status: "failed",
      error: message,
    });
    await recordDatabaseError(databaseId, message);
    return { migration: updated, applied: false };
  }
}
