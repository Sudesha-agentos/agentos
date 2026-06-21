import type { Prisma } from "../../generated/prisma/client";
import { prisma } from "../client";
import type { PmAnalysisRecord } from "../../agents/pm/types";

export async function upsertPmAnalysisRecord(
  organizationId: string,
  jiraKey: string,
  record: PmAnalysisRecord
): Promise<void> {
  if (!process.env.DATABASE_URL?.trim()) return;

  await prisma.pmAnalysisRecord.upsert({
    where: {
      organizationId_jiraKey: { organizationId, jiraKey },
    },
    create: {
      organizationId,
      jiraKey,
      recordJson: record as unknown as Prisma.InputJsonValue,
      updatedAt: new Date(record.updatedAt),
    },
    update: {
      recordJson: record as unknown as Prisma.InputJsonValue,
      updatedAt: new Date(record.updatedAt),
    },
  });
}

export async function loadAllPmAnalysisRecords(): Promise<
  Array<{ organizationId: string; jiraKey: string; record: PmAnalysisRecord }>
> {
  if (!process.env.DATABASE_URL?.trim()) return [];

  const rows = await prisma.pmAnalysisRecord.findMany({
    orderBy: { updatedAt: "desc" },
  });

  const out: Array<{ organizationId: string; jiraKey: string; record: PmAnalysisRecord }> = [];
  for (const row of rows) {
    try {
      out.push({
        organizationId: row.organizationId,
        jiraKey: row.jiraKey,
        record: row.recordJson as unknown as PmAnalysisRecord,
      });
    } catch {
      /* skip malformed row */
    }
  }
  return out;
}

export async function listPmAnalysisRecordsForOrg(
  organizationId: string,
  limit = 50
): Promise<PmAnalysisRecord[]> {
  if (!process.env.DATABASE_URL?.trim()) return [];

  const rows = await prisma.pmAnalysisRecord.findMany({
    where: { organizationId },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });

  return rows.map((row) => row.recordJson as unknown as PmAnalysisRecord);
}

export async function getPmAnalysisRecordForOrg(
  organizationId: string,
  jiraKey: string
): Promise<PmAnalysisRecord | null> {
  if (!process.env.DATABASE_URL?.trim()) return null;

  const row = await prisma.pmAnalysisRecord.findUnique({
    where: {
      organizationId_jiraKey: { organizationId, jiraKey },
    },
  });
  if (!row) return null;
  return row.recordJson as unknown as PmAnalysisRecord;
}
