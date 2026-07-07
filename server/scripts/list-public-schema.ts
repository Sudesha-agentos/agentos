import "dotenv/config";
import pg from "pg";
import { pgPoolConfig } from "../src/db/pgPool";

async function main() {
  const url = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DIRECT_DATABASE_URL or DATABASE_URL required");
  const pool = new pg.Pool(pgPoolConfig(url));
  try {
    const tables = await pool.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY 1`
    );
    console.log("public tables:", tables.rows.map((r) => r.tablename).join(", ") || "(none)");

    const types = await pool.query<{ typname: string }>(
      `SELECT t.typname
       FROM pg_type t
       JOIN pg_namespace n ON n.oid = t.typnamespace
       WHERE n.nspname = 'public' AND t.typtype = 'e'
       ORDER BY 1`
    );
    console.log("public enums:", types.rows.map((r) => r.typname).join(", ") || "(none)");

    const fns = await pool.query<{ proname: string }>(
      `SELECT p.proname
       FROM pg_proc p
       JOIN pg_namespace n ON p.pronamespace = n.oid
       WHERE n.nspname = 'public'
       ORDER BY 1`
    );
    console.log("public functions:", fns.rows.map((r) => r.proname).join(", ") || "(none)");
  } finally {
    await pool.end().catch(() => undefined);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
