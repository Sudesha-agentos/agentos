import { prisma } from "../../db/client";
import { logger } from "../../utils/logger";

async function getOrCreateConfig(organizationId: string) {
  return prisma.logIntelligenceConfig.upsert({
    where: { organizationId },
    create: { organizationId },
    update: {},
  });
}

export async function runAnomalyDetection(
  organizationId: string
): Promise<number> {
  const config = await getOrCreateConfig(organizationId);
  let created = 0;
  const now = new Date();

  try {
    // A. Error rate spike (10-minute window vs yesterday)
    const windowMs = 10 * 60 * 1000;
    const currentStart = new Date(now.getTime() - windowMs);
    const baselineStart = new Date(currentStart.getTime() - 24 * 60 * 60 * 1000);
    const baselineEnd = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [currentErrors, baselineErrors, currentTotal, baselineTotal] =
      await Promise.all([
        prisma.logEntry.count({
          where: {
            source: { organizationId },
            timestamp: { gte: currentStart, lte: now },
            severity: { in: ["error", "fatal"] },
          },
        }),
        prisma.logEntry.count({
          where: {
            source: { organizationId },
            timestamp: { gte: baselineStart, lte: baselineEnd },
            severity: { in: ["error", "fatal"] },
          },
        }),
        prisma.logEntry.count({
          where: {
            source: { organizationId },
            timestamp: { gte: currentStart, lte: now },
          },
        }),
        prisma.logEntry.count({
          where: {
            source: { organizationId },
            timestamp: { gte: baselineStart, lte: baselineEnd },
          },
        }),
      ]);

    const currentRate =
      currentTotal > 0 ? (currentErrors / currentTotal) * 100 : 0;
    const baselineRate =
      baselineTotal > 0 ? (baselineErrors / baselineTotal) * 100 : 0;

    if (
      currentErrors >= 5 &&
      baselineRate > 0 &&
      currentRate > baselineRate * config.errorSpikeMultiplier
    ) {
      const deviation =
        baselineRate > 0
          ? ((currentRate - baselineRate) / baselineRate) * 100
          : 100;
      await prisma.anomalyDetection.create({
        data: {
          organizationId,
          anomalyType: "error_rate_spike",
          severity: currentRate > config.errorRateThresholdPercent ? "critical" : "high",
          description: `Error rate ${currentRate.toFixed(1)}% vs baseline ${baselineRate.toFixed(1)}% (${deviation.toFixed(0)}% deviation)`,
          baselineValue: baselineRate,
          observedValue: currentRate,
          deviationPercent: deviation,
          environment: "production",
        },
      });
      created += 1;
    }

    // B. New error type in production
    if (config.newErrorTypeAlert) {
      const recentPatterns = await prisma.errorPattern.findMany({
        where: {
          organizationId,
          firstSeen: { gte: new Date(now.getTime() - 15 * 60 * 1000) },
          occurrenceCount: { gt: 3 },
        },
        take: 20,
      });
      for (const p of recentPatterns) {
        const exists = await prisma.anomalyDetection.findFirst({
          where: {
            organizationId,
            patternId: p.id,
            anomalyType: "new_error_type",
            detectedAt: { gte: new Date(now.getTime() - 60 * 60 * 1000) },
          },
        });
        if (exists) continue;
        await prisma.anomalyDetection.create({
          data: {
            organizationId,
            anomalyType: "new_error_type",
            severity: p.isQaGap ? "critical" : "high",
            description: `New error type ${p.errorType}: ${p.messageTemplate.slice(0, 200)}`,
            patternId: p.id,
            environment: "production",
            observedValue: p.occurrenceCount,
          },
        });
        created += 1;
      }
    }

    // C. Auth failure spike
    const authWindowStart = new Date(now.getTime() - 5 * 60 * 1000);
    const authCount = await prisma.logEntry.count({
      where: {
        source: { organizationId },
        timestamp: { gte: authWindowStart },
        OR: [
          { errorType: { contains: "auth", mode: "insensitive" } },
          { httpStatus: { in: [401, 403] } },
        ],
      },
    });
    if (authCount > 50) {
      await prisma.anomalyDetection.create({
        data: {
          organizationId,
          anomalyType: "auth_failure_spike",
          severity: "critical",
          description: `${authCount} auth failures in the last 5 minutes`,
          observedValue: authCount,
          environment: "production",
        },
      });
      created += 1;
    }

    // D. Connection failure cluster
    const connCount = await prisma.logEntry.groupBy({
      by: ["serviceName"],
      where: {
        source: { organizationId },
        timestamp: { gte: authWindowStart },
        errorType: { in: ["ConnectionRefused", "ConnectionTimeout"] },
      },
      _count: { _all: true },
    });
    for (const row of connCount) {
      if (row._count._all <= 20) continue;
      await prisma.anomalyDetection.create({
        data: {
          organizationId,
          anomalyType: "connection_failure",
          severity: "high",
          description: `${row._count._all} connection failures for ${row.serviceName}`,
          affectedService: row.serviceName,
          observedValue: row._count._all,
          environment: "production",
        },
      });
      created += 1;
    }
  } catch (err) {
    logger.warn({ err, organizationId }, "anomaly detection failed");
  }

  return created;
}
