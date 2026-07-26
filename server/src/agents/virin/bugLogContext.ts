/**
 * Pull Log Intelligence context for bug tickets so Virin can hand Ananta a real diagnosis.
 */

import { prisma } from "../../db/client";
import { logger } from "../../utils/logger";
import { analyseErrorPattern } from "../../logIntelligence/intelligence/rootCauseEngine";
import { getActiveOrganizationId } from "../../organization/context";

export type BugLogContext = {
  jiraKey: string;
  organizationId: string | null;
  patterns: Array<{
    id: string;
    errorType: string;
    messageTemplate: string;
    occurrenceCount: number;
    lastSeen: string;
    affectedServices: unknown;
    affectedEndpoints: unknown;
    rootCauseHypothesis?: string | null;
    remediationSteps?: string | null;
    confidenceScore?: number | null;
  }>;
  recentEntries: Array<{
    id: string;
    timestamp: string;
    severity: string;
    message: string;
    serviceName?: string | null;
    stackTrace?: string | null;
  }>;
  engineeringBrief: string;
  needsLogSourceLink: boolean;
};

export async function gatherBugLogContext(input: {
  jiraKey: string;
  organizationId?: string | null;
  ticketSummary?: string;
}): Promise<BugLogContext> {
  const jiraKey = input.jiraKey.toUpperCase();
  const organizationId =
    input.organizationId || getActiveOrganizationId() || null;

  const empty: BugLogContext = {
    jiraKey,
    organizationId,
    patterns: [],
    recentEntries: [],
    engineeringBrief: "",
    needsLogSourceLink: false,
  };

  try {
    const patternWhere = organizationId
      ? {
          organizationId,
          OR: [{ jiraKey }, { bugJiraKey: jiraKey }],
        }
      : { OR: [{ jiraKey }, { bugJiraKey: jiraKey }] };

    let patterns = await prisma.errorPattern.findMany({
      where: patternWhere as any,
      orderBy: { lastSeen: "desc" },
      take: 5,
    });

    if (!patterns.length && organizationId && input.ticketSummary) {
      const tokens = input.ticketSummary
        .toLowerCase()
        .replace(/[^\w\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 4)
        .slice(0, 4);
      if (tokens.length) {
        patterns = await prisma.errorPattern.findMany({
          where: {
            organizationId,
            OR: tokens.map((t) => ({
              messageTemplate: { contains: t, mode: "insensitive" as const },
            })),
          },
          orderBy: { lastSeen: "desc" },
          take: 3,
        });
      }
    }

    for (const p of patterns.slice(0, 2)) {
      if (!p.rootCauseHypothesis && process.env.LOG_AI_ANALYSIS_ENABLED !== "0") {
        try {
          await analyseErrorPattern(p.id);
        } catch (err) {
          logger.debug({ err, patternId: p.id }, "virin on-demand RCA skipped");
        }
      }
    }

    const refreshed = patterns.length
      ? await prisma.errorPattern.findMany({
          where: { id: { in: patterns.map((p) => p.id) } },
        })
      : [];

    const recentEntries = organizationId
      ? await prisma.logEntry.findMany({
          where: {
            source: { organizationId },
            OR: [
              { jiraKey },
              ...(refreshed[0]?.patternHash
                ? [{ patternHash: refreshed[0].patternHash }]
                : []),
            ],
          },
          orderBy: { timestamp: "desc" },
          take: 8,
          select: {
            id: true,
            timestamp: true,
            severity: true,
            message: true,
            serviceName: true,
            stackTrace: true,
          },
        })
      : [];

    const sourceCount = organizationId
      ? await prisma.logSource.count({ where: { organizationId, isActive: true } })
      : 0;

    const mapped = refreshed.map((p) => ({
      id: p.id,
      errorType: p.errorType,
      messageTemplate: p.messageTemplate,
      occurrenceCount: p.occurrenceCount,
      lastSeen: p.lastSeen.toISOString(),
      affectedServices: p.affectedServices,
      affectedEndpoints: p.affectedEndpoints,
      rootCauseHypothesis: p.rootCauseHypothesis,
      remediationSteps: p.remediationSteps,
      confidenceScore: p.confidenceScore,
    }));

    const briefParts: string[] = [];
    if (!mapped.length) {
      briefParts.push(
        sourceCount === 0
          ? "No log sources linked for this org — ask human to link Logs → Sources, or paste stack traces."
          : "No correlated error patterns for this Jira key yet — ask for environment, timestamps, and stack traces."
      );
    } else {
      briefParts.push("Production log correlation for engineering:");
      for (const p of mapped) {
        briefParts.push(
          `- [${p.errorType}] ${p.messageTemplate.slice(0, 160)} (n=${p.occurrenceCount}, last=${p.lastSeen})\n  Root cause: ${(p.rootCauseHypothesis ?? "pending analysis").slice(0, 500)}\n  Remediation: ${(p.remediationSteps ?? "n/a").slice(0, 400)}`
        );
      }
    }
    if (recentEntries.length) {
      briefParts.push("Recent log lines:");
      for (const e of recentEntries.slice(0, 5)) {
        briefParts.push(
          `- ${e.timestamp.toISOString()} [${e.severity}] ${e.serviceName ?? "?"}: ${e.message.slice(0, 200)}`
        );
      }
    }

    return {
      jiraKey,
      organizationId,
      patterns: mapped,
      recentEntries: recentEntries.map((e) => ({
        id: e.id,
        timestamp: e.timestamp.toISOString(),
        severity: e.severity,
        message: e.message,
        serviceName: e.serviceName,
        stackTrace: e.stackTrace?.slice(0, 1500) ?? null,
      })),
      engineeringBrief: briefParts.join("\n"),
      needsLogSourceLink: sourceCount === 0,
    };
  } catch (err) {
    logger.warn({ err, jiraKey }, "gatherBugLogContext failed");
    return {
      ...empty,
      engineeringBrief: "Log Intelligence query failed — ask human for logs/stack traces.",
      needsLogSourceLink: true,
    };
  }
}

export function formatBugLogForPrompt(ctx: BugLogContext | null | undefined): string {
  if (!ctx) return "Bug log context: not gathered.";
  return ctx.engineeringBrief || "Bug log context: empty.";
}
