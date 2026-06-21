import { execSync } from "child_process";
import { Pool } from "pg";
import { logger } from "../utils/logger";
import { migrationDatabaseUrl, pgPoolConfig } from "./pgPool";

const FAILED_MIGRATION_P3018 = /Migration name:\s*(\S+)/;
const FAILED_MIGRATION_P3009 = /The `([^`]+)` migration started at/i;

function migrationEnv(migrateUrl: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    DATABASE_URL: migrateUrl,
  };
}

function execPrisma(command: string, migrateUrl: string): string {
  return execSync(command, {
    encoding: "utf8",
    env: migrationEnv(migrateUrl),
  });
}

function formatExecError(err: unknown): string {
  if (typeof err === "object" && err) {
    const stdout = "stdout" in err ? String((err as { stdout?: string }).stdout ?? "") : "";
    const stderr = "stderr" in err ? String((err as { stderr?: string }).stderr ?? "") : "";
    const combined = [stdout, stderr].filter(Boolean).join("\n");
    if (combined) return combined;
  }
  if (err instanceof Error) return err.message;
  return String(err);
}

function extractFailedMigrationName(message: string): string | null {
  return (
    message.match(FAILED_MIGRATION_P3018)?.[1] ??
    message.match(FAILED_MIGRATION_P3009)?.[1] ??
    null
  );
}

function isFailedMigrationError(message: string): boolean {
  return (
    message.includes("P3018") ||
    message.includes("P3009") ||
    message.includes("A migration failed to apply") ||
    message.includes("failed migrations in the target database")
  );
}

function resolveRolledBack(migrationName: string, migrateUrl: string): void {
  logger.warn({ migrationName }, "marking failed migration as rolled back before retry");
  execPrisma(`npx prisma migrate resolve --rolled-back "${migrationName}"`, migrateUrl);
}

async function listFailedMigrationNames(migrateUrl: string): Promise<string[]> {
  const pool = new Pool(pgPoolConfig(migrateUrl));
  try {
    const result = await pool.query<{ migration_name: string }>(
      `SELECT migration_name
       FROM "_prisma_migrations"
       WHERE started_at IS NOT NULL
         AND finished_at IS NULL
         AND rolled_back_at IS NULL`
    );
    return result.rows.map((row) => row.migration_name);
  } catch (err) {
    logger.warn({ err }, "could not query failed migrations — continuing with migrate deploy");
    return [];
  } finally {
    await pool.end();
  }
}

async function recoverFailedMigrations(migrateUrl: string): Promise<void> {
  const failed = await listFailedMigrationNames(migrateUrl);
  if (!failed.length) return;

  logger.warn({ failed }, "found failed prisma migrations — resolving as rolled back");
  for (const migrationName of failed) {
    resolveRolledBack(migrationName, migrateUrl);
  }
}

function runMigrateDeploy(migrateUrl: string): void {
  logger.info("running prisma migrate deploy");
  const output = execPrisma("npx prisma migrate deploy", migrateUrl);
  if (output.trim()) {
    logger.info({ output: output.trim() }, "prisma migrate deploy output");
  }
  logger.info("prisma migrate deploy complete");
}

/** Apply pending Prisma migrations before the API accepts traffic. */
export async function runMigrationsOnStartup(): Promise<void> {
  const migrateUrl = migrationDatabaseUrl();
  if (!migrateUrl) {
    logger.warn("DATABASE_URL not set — skipping prisma migrate deploy");
    return;
  }
  if (process.env.SKIP_PRISMA_MIGRATE === "true") {
    logger.info("SKIP_PRISMA_MIGRATE=true — skipping prisma migrate deploy");
    return;
  }

  await recoverFailedMigrations(migrateUrl);

  try {
    runMigrateDeploy(migrateUrl);
  } catch (err) {
    const message = formatExecError(err);
    if (isFailedMigrationError(message)) {
      const migrationName = extractFailedMigrationName(message);
      if (migrationName) {
        try {
          resolveRolledBack(migrationName, migrateUrl);
          runMigrateDeploy(migrateUrl);
          logger.info("prisma migrate deploy complete after failed-migration recovery");
          return;
        } catch (retryErr) {
          const retryMessage = formatExecError(retryErr);
          logger.error({ err: retryMessage, migrationName }, "prisma migrate deploy retry failed");
          throw new Error(`Database migration failed after recovery attempt: ${retryMessage}`);
        }
      }
    }

    logger.error({ err: message }, "prisma migrate deploy failed");
    throw new Error(`Database migration failed: ${message}`);
  }
}
