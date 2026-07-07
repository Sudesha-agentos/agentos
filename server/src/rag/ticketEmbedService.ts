import { prisma } from "../db/client";
import { requireActiveOrganizationId } from "../organization/orgScope";
import { logger } from "../utils/logger";
import { createEmbeddingVectors } from "../llm/embeddings";
import { prepareTextForEmbedding } from "./chunking";
import {
  buildTicketEmbedChunks,
  buildTicketEmbedHash,
  ticketFieldsFromFetched,
  ticketFieldsFromNormalized,
  type TicketEmbedFields,
} from "./ticketEmbeddingText";
import { markTicketEmbedSynced, shouldSkipTicketEmbed } from "./ticketEmbedCache";
import { buildEmbeddingMetadata } from "./embeddingMetadata";
import { vectorStore } from "./vectorStore";
import type { NormalizedTicket } from "../types/ticket";
import type { FetchedJiraIssue } from "../jira-sync/issueFetcher";

export const MAX_TICKET_EMBED_CHUNKS = 8;

async function fetchGitContext(jiraKey: string): Promise<string> {
  try {
    const commits = await prisma.commitHistory.findMany({
      where: { jiraKey },
      orderBy: { authoredAt: "desc" },
      take: 5,
    });
    if (!commits.length) return "";
    return [
      "RELATED COMMITS:",
      ...commits.map(
        (c) =>
          `- ${c.sha.slice(0, 8)} ${c.message} (${c.author}, ${c.authoredAt.toISOString().slice(0, 10)})`
      ),
    ].join("\n");
  } catch {
    return "";
  }
}

export async function embedTicketFields(
  jiraTicketId: string,
  fields: TicketEmbedFields,
  options?: { skipHashCheck?: boolean }
): Promise<boolean> {
  const organizationId = requireActiveOrganizationId();
  const contentHash = buildTicketEmbedHash(fields);

  if (
    !options?.skipHashCheck &&
    (await shouldSkipTicketEmbed(fields.jiraKey, contentHash, organizationId))
  ) {
    logger.info({ jiraKey: fields.jiraKey, contentHash }, "ticket embed skipped — content unchanged");
    return false;
  }

  const chunks = buildTicketEmbedChunks(fields, MAX_TICKET_EMBED_CHUNKS);
  await vectorStore.deleteByJiraKeyAndContentType(fields.jiraKey, "ticket", organizationId);

  const prepared = chunks.map((c) => prepareTextForEmbedding(c));
  const embeddings = await createEmbeddingVectors(prepared, {
    operation: "ticket_embedding",
    jiraKey: fields.jiraKey,
    chunkCount: chunks.length,
  });

  const upsertRecords = [];
  for (let i = 0; i < chunks.length; i++) {
    const embedding = embeddings[i];
    if (!embedding) continue;
    upsertRecords.push({
      jiraTicketId,
      jiraKey: fields.jiraKey,
      contentType: "ticket" as const,
      content: chunks[i]!,
      embedding,
      chunkIndex: i,
      organizationId,
      metadata: buildEmbeddingMetadata({
        source: "unified_ticket_embed",
        summary: fields.summary,
        issueType: fields.issueType,
        status: fields.status,
        priority: fields.priority,
        components: fields.components,
        labels: fields.labels ?? [],
        contentHash,
        chunkIndex: i,
        chunkCount: chunks.length,
      }),
    });
  }

  if (upsertRecords.length > 0) {
    await vectorStore.upsertBatch(upsertRecords);
  }

  await markTicketEmbedSynced(fields.jiraKey, contentHash, organizationId);

  logger.info({ jiraKey: fields.jiraKey, chunks: upsertRecords.length }, "ticket embedded (multi-chunk batch)");
  return true;
}

export async function embedSyncedIssueRecord(
  issue: FetchedJiraIssue,
  gitContext?: string
): Promise<boolean> {
  const organizationId = requireActiveOrganizationId();
  const git = gitContext ?? (await fetchGitContext(issue.jiraKey));
  const fields = ticketFieldsFromFetched(issue, git || undefined);
  const contentHash = buildTicketEmbedHash(fields);

  if (await shouldSkipTicketEmbed(issue.jiraKey, contentHash, organizationId)) {
    logger.info(
      { jiraKey: issue.jiraKey, contentHash },
      "ticket embed skipped — unchanged since last embed"
    );
    return false;
  }

  const embedded = await embedTicketFields(issue.jiraTicketId, fields, { skipHashCheck: true });

  if (embedded) {
    await prisma.jiraIssue.updateMany({
      where: { organizationId, jiraKey: issue.jiraKey },
      data: { gitContext: git || null },
    });
  }
  return embedded;
}

export async function embedNormalizedTicket(ticket: NormalizedTicket): Promise<boolean> {
  const git = await fetchGitContext(ticket.jiraKey);
  const fields: TicketEmbedFields = {
    ...ticketFieldsFromNormalized(ticket),
    gitContext: git || undefined,
  };
  return embedTicketFields(ticket.jiraTicketId, fields);
}
