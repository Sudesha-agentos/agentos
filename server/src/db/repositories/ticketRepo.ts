import type { Prisma, Ticket, TicketStatus } from "../prisma";
import { prisma } from "../client";
import { activeOrganizationFilter, requireActiveOrganizationId } from "../../organization/orgScope";

export const ticketRepo = {
  async create(input: {
    jiraTicketId: string;
    jiraKey: string;
    rawPayload: Prisma.InputJsonValue;
    normalizedData: Prisma.InputJsonValue;
    status: TicketStatus;
    organizationId?: string;
  }): Promise<Ticket> {
    const organizationId = input.organizationId ?? requireActiveOrganizationId();
    return prisma.ticket.upsert({
      where: {
        organizationId_jiraTicketId: {
          organizationId,
          jiraTicketId: input.jiraTicketId,
        },
      },
      update: {
        rawPayload: input.rawPayload,
        normalizedData: input.normalizedData,
        status: input.status,
      },
      create: {
        organizationId,
        jiraTicketId: input.jiraTicketId,
        jiraKey: input.jiraKey,
        rawPayload: input.rawPayload,
        normalizedData: input.normalizedData,
        status: input.status,
      },
    });
  },

  async findById(id: string): Promise<Ticket | null> {
    const org = activeOrganizationFilter();
    return prisma.ticket.findFirst({ where: { id, ...org } });
  },

  async findByJiraKey(jiraKey: string): Promise<Ticket | null> {
    const org = activeOrganizationFilter();
    return prisma.ticket.findFirst({ where: { jiraKey, ...org } });
  },

  async setStatus(id: string, status: TicketStatus): Promise<void> {
    const org = activeOrganizationFilter();
    await prisma.ticket.updateMany({ where: { id, ...org }, data: { status } });
  },

  async patchNormalizedData(
    id: string,
    patch: Record<string, unknown>
  ): Promise<void> {
    const org = activeOrganizationFilter();
    const existing = await prisma.ticket.findFirst({
      where: { id, ...org },
      select: { normalizedData: true },
    });
    if (!existing) return;
    const current =
      existing.normalizedData && typeof existing.normalizedData === "object"
        ? (existing.normalizedData as Record<string, unknown>)
        : {};
    await prisma.ticket.updateMany({
      where: { id, ...org },
      data: { normalizedData: { ...current, ...patch } as Prisma.InputJsonValue },
    });
  },
};
