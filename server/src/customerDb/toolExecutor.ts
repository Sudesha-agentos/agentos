import { ConfirmationRequiredError } from "./operations";
import {
  executeDatabase,
  introspectAndStore,
  migrateDatabase,
  queryDatabase,
} from "./operations";
import {
  listDatabases,
  listTableCatalog,
  resolveCustomerDbOrganizationId,
} from "./store";

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export async function executeCustomerDbTool(
  name: string,
  input: Record<string, unknown>,
  pipelineId?: string
): Promise<unknown> {
  const organizationId = await resolveCustomerDbOrganizationId(pipelineId);
  if (!organizationId) {
    return {
      error: "No workspace context — connect a database in Settings → Integrations.",
    };
  }

  switch (name) {
    case "list_databases": {
      const databases = await listDatabases(organizationId);
      return {
        databases,
        message:
          databases.length === 0
            ? "No customer databases connected. Ask the user to attach Postgres/Supabase/MySQL in Settings → Integrations."
            : undefined,
      };
    }
    case "db_schema": {
      const databaseId = stringValue(input.database_id);
      if (!databaseId) return { error: "database_id is required" };
      let tables = await listTableCatalog(organizationId, databaseId);
      if (tables.length === 0) {
        const introspected = await introspectAndStore(organizationId, databaseId);
        tables = introspected.tables;
      }
      const schema = stringValue(input.schema).trim();
      const table = stringValue(input.table).trim();
      const filtered = tables.filter((item) => {
        if (schema && item.schemaName !== schema) return false;
        if (table && item.tableName !== table) return false;
        return true;
      });
      return { database_id: databaseId, tables: filtered, tableCount: filtered.length };
    }
    case "db_query": {
      const databaseId = stringValue(input.database_id);
      const sql = stringValue(input.sql);
      if (!databaseId || !sql) return { error: "database_id and sql are required" };
      return queryDatabase(organizationId, databaseId, sql);
    }
    case "db_execute": {
      const databaseId = stringValue(input.database_id);
      const sql = stringValue(input.sql);
      if (!databaseId || !sql) return { error: "database_id and sql are required" };
      try {
        return await executeDatabase(organizationId, databaseId, sql, input.confirm === true);
      } catch (err) {
        if (err instanceof ConfirmationRequiredError) {
          return {
            needsConfirmation: true,
            message: err.message,
            metadata: err.metadata,
          };
        }
        throw err;
      }
    }
    case "db_migrate": {
      const databaseId = stringValue(input.database_id);
      const sql = stringValue(input.sql);
      if (!databaseId || !sql) return { error: "database_id and sql are required" };
      const result = await migrateDatabase(organizationId, databaseId, sql, {
        confirm: input.confirm === true,
        pipelineId,
      });
      if (result.needsConfirmation) {
        return {
          needsConfirmation: true,
          migrationId: result.migration.id,
          status: result.migration.status,
          message:
            "DDL was queued for human confirmation (production or destructive). Do not set confirm=true yourself — wait for Settings → Integrations.",
        };
      }
      if (result.migration.status === "failed") {
        return {
          applied: false,
          status: "failed",
          error: result.migration.error,
          migrationId: result.migration.id,
        };
      }
      return {
        applied: result.applied,
        status: result.migration.status,
        migrationId: result.migration.id,
      };
    }
    default:
      return null;
  }
}

export function isCustomerDbTool(name: string): boolean {
  return (
    name === "list_databases" ||
    name === "db_schema" ||
    name === "db_query" ||
    name === "db_execute" ||
    name === "db_migrate"
  );
}
