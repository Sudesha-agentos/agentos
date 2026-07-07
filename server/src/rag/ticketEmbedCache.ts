import { prisma } from "../db/client";
import { hashContent, chunkTextByParagraphs } from "./contentHash";

export { hashContent, chunkTextByParagraphs };

import { requireActiveOrganizationId } from "../organization/orgScope";

/** Skip re-embed when ticket content hash unchanged (org-scoped, Postgres — no vector_store read). */
export async function shouldSkipTicketEmbed(
  jiraKey: string,
  contentHash: string,
  organizationId?: string
): Promise<boolean> {
  try {
    const orgId = organizationId ?? requireActiveOrganizationId();
    const row = await prisma.jiraIssue.findFirst({
      where: { organizationId: orgId, jiraKey },
      select: { embedContentHash: true },
    });
    return row?.embedContentHash === contentHash;
  } catch {
    return false;
  }
}

export async function markTicketEmbedSynced(
  jiraKey: string,
  contentHash: string,
  organizationId?: string
): Promise<void> {
  const orgId = organizationId ?? requireActiveOrganizationId();
  await prisma.jiraIssue.updateMany({
    where: { organizationId: orgId, jiraKey },
    data: {
      embeddedAt: new Date(),
      embedContentHash: contentHash,
    },
  });
}
