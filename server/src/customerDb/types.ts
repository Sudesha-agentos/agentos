export const CUSTOMER_DB_PROVIDERS = ["postgresql", "mysql", "supabase"] as const;
export type CustomerDbProvider = (typeof CUSTOMER_DB_PROVIDERS)[number];

export const CUSTOMER_DB_ENVIRONMENTS = ["development", "staging", "production"] as const;
export type CustomerDbEnvironment = (typeof CUSTOMER_DB_ENVIRONMENTS)[number];

export const CUSTOMER_DB_MIGRATION_STATUSES = [
  "pending",
  "applied",
  "failed",
  "awaiting_confirm",
] as const;
export type CustomerDbMigrationStatus = (typeof CUSTOMER_DB_MIGRATION_STATUSES)[number];

export type CustomerDbDriver = "postgresql" | "mysql";

export interface CustomerDbConnectionConfig {
  provider: CustomerDbProvider;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
}

export interface CustomerDbColumn {
  name: string;
  type: string;
  nullable: boolean;
  default: string | null;
}

export interface CustomerDbForeignKey {
  column: string;
  referencedSchema: string;
  referencedTable: string;
  referencedColumn: string;
}

export interface CustomerDbIndex {
  name: string;
  columns: string[];
  unique: boolean;
}

export interface CustomerDbTableCatalog {
  schemaName: string;
  tableName: string;
  columns: CustomerDbColumn[];
  primaryKeys: string[];
  foreignKeys: CustomerDbForeignKey[];
  indexes: CustomerDbIndex[];
  rowEstimate: number | null;
}

export interface PublicOrganizationDatabase {
  id: string;
  name: string;
  provider: CustomerDbProvider;
  environment: CustomerDbEnvironment;
  host: string;
  port: number;
  databaseName: string;
  username: string;
  ssl: boolean;
  schemaAllowlist: string[];
  autoMigrate: boolean;
  requireConfirmToApply: boolean;
  lastIntrospectedAt: string | null;
  lastError: string | null;
  tableCount: number;
  createdAt: string;
  updatedAt: string;
}

export function isCustomerDbProvider(value: unknown): value is CustomerDbProvider {
  return (
    typeof value === "string" &&
    (CUSTOMER_DB_PROVIDERS as readonly string[]).includes(value)
  );
}

export function isCustomerDbEnvironment(value: unknown): value is CustomerDbEnvironment {
  return (
    typeof value === "string" &&
    (CUSTOMER_DB_ENVIRONMENTS as readonly string[]).includes(value)
  );
}

export function driverForProvider(provider: CustomerDbProvider): CustomerDbDriver {
  return provider === "mysql" ? "mysql" : "postgresql";
}

export function defaultPortForProvider(provider: CustomerDbProvider): number {
  return provider === "mysql" ? 3306 : 5432;
}
