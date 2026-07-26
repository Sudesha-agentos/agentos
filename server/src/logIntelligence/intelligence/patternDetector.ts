import { prisma } from "../../db/client";
import type { NormalizedLogEntry } from "../ingestion/schema";
import { generateFingerprint } from "./classifier";

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(String);
}

export async function upsertErrorPattern(input: {
  organizationId: string;
  entry: NormalizedLogEntry;
  pipelineId?: string | null;
  jiraKey?: string | null;
}): Promise<{ patternId: string; patternHash: string; isNew: boolean }> {
  const fp = generateFingerprint(input.entry);
  const now = input.entry.timestamp;

  const existing = await prisma.errorPattern.findUnique({
    where: {
      organizationId_patternHash: {
        organizationId: input.organizationId,
        patternHash: fp.hash,
      },
    },
  });

  if (existing) {
    const services = new Set(asStringArray(existing.affectedServices));
    const endpoints = new Set(asStringArray(existing.affectedEndpoints));
    if (input.entry.serviceName) services.add(input.entry.serviceName);
    if (input.entry.endpoint) endpoints.add(input.entry.endpoint);

    await prisma.errorPattern.update({
      where: { id: existing.id },
      data: {
        lastSeen: now > existing.lastSeen ? now : existing.lastSeen,
        occurrenceCount: { increment: 1 },
        affectedServices: [...services],
        affectedEndpoints: [...endpoints],
        pipelineId: existing.pipelineId ?? input.pipelineId ?? undefined,
        jiraKey: existing.jiraKey ?? input.jiraKey ?? undefined,
        deploymentId:
          existing.deploymentId ?? input.entry.deploymentId ?? undefined,
      },
    });
    return {
      patternId: existing.id,
      patternHash: fp.hash,
      isNew: false,
    };
  }

  const created = await prisma.errorPattern.create({
    data: {
      organizationId: input.organizationId,
      patternHash: fp.hash,
      errorType: fp.errorType,
      messageTemplate: fp.messageTemplate.slice(0, 8000),
      firstSeen: now,
      lastSeen: now,
      occurrenceCount: 1,
      affectedServices: input.entry.serviceName
        ? [input.entry.serviceName]
        : [],
      affectedEndpoints: input.entry.endpoint ? [input.entry.endpoint] : [],
      pipelineId: input.pipelineId ?? undefined,
      jiraKey: input.jiraKey ?? undefined,
      deploymentId: input.entry.deploymentId ?? undefined,
      status: "open",
    },
  });

  return {
    patternId: created.id,
    patternHash: fp.hash,
    isNew: true,
  };
}
