-- Batch upsert for vector_store — one RPC per ticket instead of one per chunk.

CREATE OR REPLACE FUNCTION upsert_vectors_batch(p_vectors JSONB)
RETURNS VOID AS $$
BEGIN
  INSERT INTO vector_store (
    jira_ticket_id,
    jira_key,
    content_type,
    content,
    embedding,
    metadata,
    chunk_index,
    organization_id
  )
  SELECT
    v.jira_ticket_id,
    v.jira_key,
    v.content_type,
    v.content,
    v.embedding::vector,
    v.metadata,
    COALESCE(v.chunk_index, 0),
    v.organization_id
  FROM jsonb_to_recordset(p_vectors) AS v(
    jira_ticket_id TEXT,
    jira_key TEXT,
    content_type TEXT,
    content TEXT,
    embedding TEXT,
    metadata JSONB,
    chunk_index INT,
    organization_id TEXT
  )
  ON CONFLICT (jira_ticket_id, content_type, chunk_index)
  DO UPDATE SET
    jira_key = EXCLUDED.jira_key,
    content = EXCLUDED.content,
    embedding = EXCLUDED.embedding,
    metadata = EXCLUDED.metadata,
    organization_id = COALESCE(EXCLUDED.organization_id, vector_store.organization_id),
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;
