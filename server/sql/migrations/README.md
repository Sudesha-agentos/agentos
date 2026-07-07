# Vector SQL migrations

Run in order via `npx tsx scripts/setup-supabase.ts` or manually in Supabase SQL Editor.

| File | Purpose |
|------|---------|
| `001_vector_bootstrap.sql` | Tables, org-scoped RPCs (`upsert_vector`, `similarity_search`, `search_codebase`) |
| `002_hnsw_indexes.sql` | HNSW vector indexes (replaces IVFFlat) + `ANALYZE` |
| `003_hybrid_search.sql` | `tsvector` columns + RRF hybrid RPCs |
| `004_upsert_vectors_batch.sql` | Batch ticket vector upserts |

## Fresh Supabase (no app data yet)

1. Enable **vector** extension in dashboard (or let `001` create it).
2. Run SQL migrations **001 → 004** in SQL Editor.
3. Run Prisma app schema: `cd server && npx prisma migrate deploy`
4. Optionally re-run **001** (org backfills are no-ops on empty DB) or `npx tsx scripts/backfill-vector-org-ids.ts` later.

Or use one command (after `server/.env` points at the new project):

```bash
npx tsx scripts/setup-supabase.ts --skip-index --skip-jira
```

## Ops runbook

- After **>30% row growth** or **embedding model change**: re-run `002_hnsw_indexes.sql` and re-embed affected rows.
- Tune recall: increase `hnsw.ef_search` (100–200) in RPC `set_config` calls.
- Backfill missing `organization_id`: `npx tsx scripts/backfill-vector-org-ids.ts`
