/**
 * Remove vector SQL objects so Prisma migrate deploy can run on a fresh DB (fixes P3005).
 * Usage: npx tsx scripts/reset-public-for-prisma.ts
 */
import "dotenv/config";
import pg from "pg";
import { pgPoolConfig } from "../src/db/pgPool";

const DROP_SQL = `
DROP TABLE IF EXISTS vector_store CASCADE;
DROP TABLE IF EXISTS codebase_embeddings CASCADE;
DROP FUNCTION IF EXISTS upsert_vectors_batch(text, text, text, text, text, jsonb, int, text);
DROP FUNCTION IF EXISTS upsert_vector(text, text, text, text, text, jsonb, int, text);
DROP FUNCTION IF EXISTS delete_vectors_for_ticket_type(text, text, text);
DROP FUNCTION IF EXISTS similarity_search(text, text[], int, float, text[], text);
DROP FUNCTION IF EXISTS hybrid_similarity_search(text, text, text[], int, float, text[], text);
DROP FUNCTION IF EXISTS search_codebase(text, text, text, text, int, float, text);
DROP FUNCTION IF EXISTS hybrid_search_codebase(text, text, text, text, text, int, float, text);
`;

async function main() {
  const url = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DIRECT_DATABASE_URL or DATABASE_URL required");
  const pool = new pg.Pool(pgPoolConfig(url));
  try {
    await pool.query(DROP_SQL);
    const tables = await pool.query<{ tablename: string }>(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY 1`
    );
    console.log(
      "[ok] vector objects dropped. public tables now:",
      tables.rows.map((r) => r.tablename).join(", ") || "(none)"
    );
  } finally {
    await pool.end().catch(() => undefined);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
