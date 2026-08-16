import { prisma } from "../db/client";
import {
  decryptSourceConfig,
  encryptSourceConfig,
} from "../logIntelligence/crypto/sourceSecrets";
import { getActiveOrganizationId } from "../organization/context";
import { NotFoundError, ValidationError } from "../utils/errors";
import { assertSafeDatabaseHost } from "./hostGuard";
import {
  defaultPortForProvider,
  driverForProvider,
  isCustomerDbEnvironment,
  isCustomerDbProvider,
  type CustomerDbConnectionConfig,
  type CustomerDbEnvironment,
  type CustomerDbProvider,
  type CustomerDbTableCatalog,
  type PublicOrganizationDatabase,
} from "./types";

const prismaDb = prisma as typeof prisma & {
  organizationDatabase: {
    findMany: (args: unknown) => Promise<OrganizationDatabaseRow[]>;
    findFirst: (args: unknown) => Promise<OrganizationDatabaseRow | null>;
    create: (args: unknown) => Promise<OrganizationDatabaseRow>;
    update: (args: unknown) => Promise<OrganizationDatabaseRow>;
    delete: (args: unknown) => Promise<unknown>;
  };
  organizationDatabaseTable: {
    findMany: (args: unknown) => Promise<OrganizationDatabaseTableRow[]>;
    deleteMany: (args: unknown) => Promise<unknown>;
    createMany: (args: unknown) => Promise<unknown>;
  };
  organizationDatabaseMigration: {
    findMany: (args: unknown) => Promise<OrganizationDatabaseMigrationRow[]>;
    findFirst: (args: unknown) => Promise<OrganizationDatabaseMigrationRow | null>;
    create: (args: unknown) => Promise<OrganizationDatabaseMigrationRow>;
    update: (args: unknown) => Promise<OrganizationDatabaseMigrationRow>;
  };
};

interface OrganizationDatabaseRow {
  id: string;
  organizationId: string;
  name: string;
  provider: string;
  environment: string;
  host: string;
  port: number;
  databaseName: string;
  username: string;
  passwordEnc: unknown;
  ssl: boolean;
  schemaAllowlist: unknown;
  autoMigrate: boolean;
  requireConfirmToApply: boolean;
  lastIntrospectedAt: Date | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
  _count?: { tables: number };
}

interface OrganizationDatabaseTableRow {
  id: string;
  databaseId: string;
  schemaName: string;
  tableName: string;
  columns: unknown;
  primaryKeys: unknown;
  foreignKeys: unknown;
  indexes: unknown;
  rowEstimate: number | null;
  updatedAt: Date;
}

export interface OrganizationDatabaseMigrationRow {
  id: string;
  databaseId: string;
  pipelineId: string | null;
  sql: string;
  status: string;
  error: string | null;
  appliedAt: Date | null;
  createdAt: Date;
}

export interface CreateDatabaseInput {
  name: string;
  provider: CustomerDbProvider;
  environment: CustomerDbEnvironment;
  host: string;
  port?: number;
  databaseName: string;
  username: string;
  password: string;
  ssl?: boolean;
  schemaAllowlist?: string[];
  autoMigrate?: boolean;
  requireConfirmToApply?: boolean;
  connectionString?: string;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

export function parseConnectionString(raw: string): Partial<CreateDatabaseInput> {
  const trimmed = raw.trim();
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new ValidationError("Enter a valid postgres:// or mysql:// connection string");
  }
  const protocol = url.protocol.replace(":", "").toLowerCase();
  let provider: CustomerDbProvider = "postgresql";
  if (protocol === "mysql") provider = "mysql";
  else if (protocol === "postgres" || protocol === "postgresql") provider = "postgresql";
  else throw new ValidationError("Connection string must use postgres://, postgresql://, or mysql://");

  const databaseName = decodeURIComponent(url.pathname.replace(/^\//, "").split("/")[0] ?? "");
  const sslMode = url.searchParams.get("sslmode") ?? url.searchParams.get("ssl");
  const ssl = sslMode ? !["disable", "false", "0"].includes(sslMode.toLowerCase()) : true;
  return {
    provider,
    host: url.hostname,
    port: url.port ? Number(url.port) : defaultPortForProvider(provider),
    databaseName,
    username: decodeURIComponent(url.username || ""),
    password: decodeURIComponent(url.password || ""),
    ssl,
  };
}

function defaultsForEnvironment(environment: CustomerDbEnvironment): {
  autoMigrate: boolean;
  requireConfirmToApply: boolean;
} {
  if (environment === "production") {
    return { autoMigrate: false, requireConfirmToApply: true };
  }
  return { autoMigrate: true, requireConfirmToApply: false };
}

export function toPublicDatabase(
  row: OrganizationDatabaseRow,
  tableCount = row._count?.tables ?? 0
): PublicOrganizationDatabase {
  return {
    id: row.id,
    name: row.name,
    provider: row.provider as CustomerDbProvider,
    environment: row.environment as CustomerDbEnvironment,
    host: row.host,
    port: row.port,
    databaseName: row.databaseName,
    username: row.username,
    ssl: row.ssl,
    schemaAllowlist: asStringArray(row.schemaAllowlist),
    autoMigrate: row.autoMigrate,
    requireConfirmToApply: row.requireConfirmToApply,
    lastIntrospectedAt: row.lastIntrospectedAt?.toISOString() ?? null,
    lastError: row.lastError,
    tableCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function resolveCustomerDbOrganizationId(
  pipelineId?: string
): Promise<string | null> {
  const fromCtx = getActiveOrganizationId();
  if (fromCtx) return fromCtx;
  if (!pipelineId) return null;
  const pipeline = await prisma.pipeline.findUnique({
    where: { id: pipelineId },
    select: { organizationId: true },
  });
  return pipeline?.organizationId ?? null;
}

export async function listDatabases(
  organizationId: string
): Promise<PublicOrganizationDatabase[]> {
  const rows = await prismaDb.organizationDatabase.findMany({
    where: { organizationId },
    orderBy: [{ environment: "asc" }, { name: "asc" }],
    include: { _count: { select: { tables: true } } },
  });
  return rows.map((row) => toPublicDatabase(row));
}

export async function getDatabaseRow(
  organizationId: string,
  databaseId: string
): Promise<OrganizationDatabaseRow> {
  const row = await prismaDb.organizationDatabase.findFirst({
    where: { id: databaseId, organizationId },
    include: { _count: { select: { tables: true } } },
  });
  if (!row) throw new NotFoundError("Database connection not found");
  return row;
}

export async function getConnectionConfig(
  organizationId: string,
  databaseId: string
): Promise<{ row: OrganizationDatabaseRow; config: CustomerDbConnectionConfig }> {
  const row = await getDatabaseRow(organizationId, databaseId);
  const secrets = decryptSourceConfig(row.passwordEnc);
  const password = typeof secrets.password === "string" ? secrets.password : "";
  if (!password) {
    throw new ValidationError("Database password is missing — reconnect this database");
  }
  return {
    row,
    config: {
      provider: row.provider as CustomerDbProvider,
      host: row.host,
      port: row.port,
      database: row.databaseName,
      username: row.username,
      password,
      ssl: row.ssl,
    },
  };
}

function mergeCreateInput(input: CreateDatabaseInput): CreateDatabaseInput {
  if (!input.connectionString?.trim()) return input;
  const fromUri = parseConnectionString(input.connectionString);
  const usingUri = !input.host?.trim();
  const provider = input.provider || fromUri.provider || "postgresql";
  return {
    name: input.name,
    provider:
      provider === "postgresql" && /supabase/i.test(input.connectionString)
        ? "supabase"
        : provider,
    environment: input.environment,
    host: usingUri ? fromUri.host || "" : input.host.trim(),
    port: usingUri ? fromUri.port : input.port ?? fromUri.port,
    databaseName: usingUri
      ? fromUri.databaseName || ""
      : input.databaseName?.trim() || fromUri.databaseName || "",
    username: usingUri
      ? fromUri.username || ""
      : input.username?.trim() || fromUri.username || "",
    password: input.password || fromUri.password || "",
    ssl: input.ssl ?? fromUri.ssl,
    schemaAllowlist: input.schemaAllowlist,
    autoMigrate: input.autoMigrate,
    requireConfirmToApply: input.requireConfirmToApply,
  };
}

export async function createDatabase(
  organizationId: string,
  input: CreateDatabaseInput
): Promise<PublicOrganizationDatabase> {
  const parsed = mergeCreateInput(input);

  if (!isCustomerDbProvider(parsed.provider)) {
    throw new ValidationError("Provider must be postgresql, mysql, or supabase");
  }
  if (!isCustomerDbEnvironment(parsed.environment)) {
    throw new ValidationError("Environment must be development, staging, or production");
  }

  const name = parsed.name?.trim();
  const host = await assertSafeDatabaseHost(parsed.host ?? "");
  const databaseName = parsed.databaseName?.trim();
  const username = parsed.username?.trim();
  const password = parsed.password ?? "";
  if (!name) throw new ValidationError("Name is required");
  if (!databaseName) throw new ValidationError("Database name is required");
  if (!username) throw new ValidationError("Username is required");
  if (!password) throw new ValidationError("Password is required");

  const port = Number(parsed.port ?? defaultPortForProvider(parsed.provider));
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new ValidationError("Port must be between 1 and 65535");
  }

  const envDefaults = defaultsForEnvironment(parsed.environment);
  const ssl = parsed.ssl ?? (parsed.provider === "supabase" || parsed.environment === "production");
  const row = await prismaDb.organizationDatabase.create({
    data: {
      organizationId,
      name,
      provider: parsed.provider,
      environment: parsed.environment,
      host,
      port,
      databaseName,
      username,
      passwordEnc: encryptSourceConfig({ password }),
      ssl: Boolean(ssl),
      schemaAllowlist: asStringArray(parsed.schemaAllowlist),
      autoMigrate: parsed.autoMigrate ?? envDefaults.autoMigrate,
      requireConfirmToApply: parsed.requireConfirmToApply ?? envDefaults.requireConfirmToApply,
    },
    include: { _count: { select: { tables: true } } },
  });
  return toPublicDatabase(row);
}

export async function updateDatabase(
  organizationId: string,
  databaseId: string,
  input: Partial<CreateDatabaseInput>
): Promise<PublicOrganizationDatabase> {
  const existing = await getDatabaseRow(organizationId, databaseId);
  const nextProvider = input.provider ?? (existing.provider as CustomerDbProvider);
  const nextEnvironment = input.environment ?? (existing.environment as CustomerDbEnvironment);
  if (input.provider && !isCustomerDbProvider(input.provider)) {
    throw new ValidationError("Provider must be postgresql, mysql, or supabase");
  }
  if (input.environment && !isCustomerDbEnvironment(input.environment)) {
    throw new ValidationError("Environment must be development, staging, or production");
  }

  const host = input.host != null ? await assertSafeDatabaseHost(input.host) : existing.host;
  const data: Record<string, unknown> = {
    name: input.name?.trim() || existing.name,
    provider: nextProvider,
    environment: nextEnvironment,
    host,
    port: input.port ?? existing.port,
    databaseName: input.databaseName?.trim() || existing.databaseName,
    username: input.username?.trim() || existing.username,
    ssl: input.ssl ?? existing.ssl,
    schemaAllowlist:
      input.schemaAllowlist != null ? asStringArray(input.schemaAllowlist) : existing.schemaAllowlist,
    autoMigrate: input.autoMigrate ?? existing.autoMigrate,
    requireConfirmToApply: input.requireConfirmToApply ?? existing.requireConfirmToApply,
  };
  if (input.password?.trim()) {
    data.passwordEnc = encryptSourceConfig({ password: input.password });
  }
  const row = await prismaDb.organizationDatabase.update({
    where: { id: databaseId },
    data,
    include: { _count: { select: { tables: true } } },
  });
  return toPublicDatabase(row);
}

export async function deleteDatabase(organizationId: string, databaseId: string): Promise<void> {
  await getDatabaseRow(organizationId, databaseId);
  await prismaDb.organizationDatabase.delete({ where: { id: databaseId } });
}

export async function recordDatabaseError(
  databaseId: string,
  message: string | null
): Promise<void> {
  await prismaDb.organizationDatabase.update({
    where: { id: databaseId },
    data: { lastError: message },
  });
}

export async function replaceTableCatalog(
  databaseId: string,
  tables: CustomerDbTableCatalog[]
): Promise<void> {
  await prismaDb.organizationDatabaseTable.deleteMany({ where: { databaseId } });
  if (tables.length > 0) {
    await prismaDb.organizationDatabaseTable.createMany({
      data: tables.map((table) => ({
        databaseId,
        schemaName: table.schemaName,
        tableName: table.tableName,
        columns: table.columns,
        primaryKeys: table.primaryKeys,
        foreignKeys: table.foreignKeys,
        indexes: table.indexes,
        rowEstimate: table.rowEstimate,
      })),
    });
  }
  await prismaDb.organizationDatabase.update({
    where: { id: databaseId },
    data: { lastIntrospectedAt: new Date(), lastError: null },
  });
}

export async function listTableCatalog(
  organizationId: string,
  databaseId: string
): Promise<CustomerDbTableCatalog[]> {
  await getDatabaseRow(organizationId, databaseId);
  const rows = await prismaDb.organizationDatabaseTable.findMany({
    where: { databaseId },
    orderBy: [{ schemaName: "asc" }, { tableName: "asc" }],
  });
  return rows.map((row) => ({
    schemaName: row.schemaName,
    tableName: row.tableName,
    columns: Array.isArray(row.columns)
      ? (row.columns as unknown as CustomerDbTableCatalog["columns"])
      : [],
    primaryKeys: asStringArray(row.primaryKeys),
    foreignKeys: Array.isArray(row.foreignKeys)
      ? (row.foreignKeys as unknown as CustomerDbTableCatalog["foreignKeys"])
      : [],
    indexes: Array.isArray(row.indexes)
      ? (row.indexes as unknown as CustomerDbTableCatalog["indexes"])
      : [],
    rowEstimate: row.rowEstimate,
  }));
}

export async function createMigrationRecord(input: {
  databaseId: string;
  pipelineId?: string;
  sql: string;
  status: string;
  error?: string | null;
  appliedAt?: Date | null;
}): Promise<OrganizationDatabaseMigrationRow> {
  return prismaDb.organizationDatabaseMigration.create({
    data: {
      databaseId: input.databaseId,
      pipelineId: input.pipelineId ?? null,
      sql: input.sql,
      status: input.status,
      error: input.error ?? null,
      appliedAt: input.appliedAt ?? null,
    },
  });
}

export async function updateMigrationRecord(
  id: string,
  data: { status: string; error?: string | null; appliedAt?: Date | null }
): Promise<OrganizationDatabaseMigrationRow> {
  return prismaDb.organizationDatabaseMigration.update({
    where: { id },
    data,
  });
}

export async function listMigrations(
  organizationId: string,
  databaseId: string
): Promise<OrganizationDatabaseMigrationRow[]> {
  await getDatabaseRow(organizationId, databaseId);
  return prismaDb.organizationDatabaseMigration.findMany({
    where: { databaseId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function getMigration(
  organizationId: string,
  databaseId: string,
  migrationId: string
): Promise<OrganizationDatabaseMigrationRow> {
  await getDatabaseRow(organizationId, databaseId);
  const row = await prismaDb.organizationDatabaseMigration.findFirst({
    where: { id: migrationId, databaseId },
  });
  if (!row) throw new NotFoundError("Migration not found");
  return row;
}

export { driverForProvider };
