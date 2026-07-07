/**
 * Apply server/sql/migrations/*.sql after Prisma migrate deploy.
 * Usage: npx tsx scripts/run-vector-sql.ts
 */
import "dotenv/config";
import pg from "pg";
import { pgPoolConfig } from "../src/db/pgPool";
import { runSqlMigrations } from "./runSqlMigrations";

async function main() {
  const url = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DIRECT_DATABASE_URL or DATABASE_URL required");
  const pool = new pg.Pool(pgPoolConfig(url));
  try {
    await runSqlMigrations(pool);
    console.log("[ok] vector SQL migrations");
  } finally {
    await pool.end().catch(() => undefined);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
