import { prisma } from "../../db/client";
import { logger } from "../../utils/logger";

/**
 * Persist a QA-gap error pattern into the canary hypothesis library
 * so future canary runs explicitly probe for it.
 */
export async function feedCanaryHypothesisLibrary(patternId: string): Promise<boolean> {
  const pattern = await prisma.errorPattern.findUnique({
    where: { id: patternId },
  });
  if (!pattern || !pattern.isQaGap) return false;

  const config = await prisma.logIntelligenceConfig.findUnique({
    where: { organizationId: pattern.organizationId },
  });
  if (config && !config.autoFeedCanary) return false;

  const endpoints = Array.isArray(pattern.affectedEndpoints)
    ? (pattern.affectedEndpoints as string[])
    : [];
  const services = Array.isArray(pattern.affectedServices)
    ? (pattern.affectedServices as string[])
    : [];
  const endpoint = endpoints[0] ?? null;
  const service = services[0] ?? null;

  const existing = await prisma.canaryHypothesisLibrary.findFirst({
    where: {
      organizationId: pattern.organizationId,
      sourcePatternId: pattern.id,
    },
  });

  const probeScenario = [
    `Reproduce production error type: ${pattern.errorType}`,
    endpoint ? `Target endpoint: ${endpoint}` : null,
    `Message template: ${pattern.messageTemplate.slice(0, 300)}`,
    "Confirm the failure mode and capture evidence (status, body, stack).",
    pattern.remediationSteps
      ? `Remediation hint: ${pattern.remediationSteps.slice(0, 400)}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  if (existing) {
    await prisma.canaryHypothesisLibrary.update({
      where: { id: existing.id },
      data: {
        active: true,
        messageTemplate: pattern.messageTemplate.slice(0, 4000),
        endpoint,
        service,
        probeScenario,
        remediationHint: pattern.remediationSteps?.slice(0, 2000),
      },
    });
  } else {
    await prisma.canaryHypothesisLibrary.create({
      data: {
        organizationId: pattern.organizationId,
        errorType: pattern.errorType,
        messageTemplate: pattern.messageTemplate.slice(0, 4000),
        endpoint,
        service,
        probeScenario,
        remediationHint: pattern.remediationSteps?.slice(0, 2000),
        sourcePatternId: pattern.id,
        active: true,
      },
    });
  }

  // Mark related anomalies as canary-notified
  await prisma.anomalyDetection.updateMany({
    where: {
      organizationId: pattern.organizationId,
      patternId: pattern.id,
      canaryNotified: false,
    },
    data: { canaryNotified: true },
  });

  logger.info(
    { patternId, organizationId: pattern.organizationId },
    "canary hypothesis library updated from QA gap"
  );
  return true;
}

export async function listActiveLibraryHypotheses(organizationId: string) {
  return prisma.canaryHypothesisLibrary.findMany({
    where: { organizationId, active: true },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });
}
