import { Router } from "express";
import { prisma } from "../../db/client";
import {
  requireOrganizationUser,
  withOrganizationContext,
} from "../../api/orgRequestContext";
import {
  decryptSourceConfig,
  encryptSourceConfig,
} from "../crypto/sourceSecrets";
import { getAdapter, listSupportedSourceTypes } from "../adapters/registry";
import { processNormalisedEntry } from "../ingestion/processEntry";
import { analyseErrorPattern } from "../intelligence/rootCauseEngine";
import {
  handleCustomIngest,
  handleOtlpIngest,
  handleSentryWebhook,
} from "./webhookReceiver";

const router = Router();

// Public / weakly-auth webhooks (source-scoped)
router.post("/webhooks/sentry", (req, res) => {
  void handleSentryWebhook(req, res);
});
router.post("/ingest/otlp", (req, res) => {
  void handleOtlpIngest(req, res);
});
router.post("/ingest/custom", (req, res) => {
  void handleCustomIngest(req, res);
});

router.get("/source-types", (_req, res) => {
  res.json({ types: listSupportedSourceTypes() });
});

router.get("/sources", async (req, res, next) => {
  try {
    const user = requireOrganizationUser(req, res);
    if (!user?.organizationId) return;
    await withOrganizationContext(user.organizationId, async () => {
      const sources = await prisma.logSource.findMany({
        where: { organizationId: user.organizationId! },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          sourceType: true,
          displayName: true,
          isActive: true,
          lastPulledAt: true,
          createdAt: true,
        },
      });
      res.json({ sources });
    });
  } catch (err) {
    next(err);
  }
});

router.post("/sources", async (req, res, next) => {
  try {
    const user = requireOrganizationUser(req, res);
    if (!user?.organizationId) return;
    const sourceType = String(req.body?.sourceType ?? "").trim();
    const displayName = String(req.body?.displayName ?? sourceType).trim();
    const config = (req.body?.config ?? {}) as Record<string, unknown>;
    if (!sourceType) {
      res.status(400).json({ error: "sourceType_required" });
      return;
    }

    await withOrganizationContext(user.organizationId, async () => {
      const adapter = getAdapter(sourceType);
      const validation = await adapter.validate(config);
      if (!validation.valid) {
        res.status(400).json({
          error: "invalid_source_config",
          message: validation.error,
        });
        return;
      }

      const encrypted = encryptSourceConfig(config);
      const created = await prisma.logSource.create({
        data: {
          organizationId: user.organizationId!,
          sourceType,
          displayName: displayName || sourceType,
          config: encrypted as object,
          isActive: true,
        },
        select: {
          id: true,
          sourceType: true,
          displayName: true,
          isActive: true,
          createdAt: true,
        },
      });
      res.status(201).json({ source: created });
    });
  } catch (err) {
    next(err);
  }
});

router.delete("/sources/:id", async (req, res, next) => {
  try {
    const user = requireOrganizationUser(req, res);
    if (!user?.organizationId) return;
    await withOrganizationContext(user.organizationId, async () => {
      const existing = await prisma.logSource.findFirst({
        where: { id: req.params.id, organizationId: user.organizationId! },
      });
      if (!existing) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      await prisma.logSource.delete({ where: { id: existing.id } });
      res.json({ ok: true });
    });
  } catch (err) {
    next(err);
  }
});

router.post("/sources/:id/test", async (req, res, next) => {
  try {
    const user = requireOrganizationUser(req, res);
    if (!user?.organizationId) return;
    await withOrganizationContext(user.organizationId, async () => {
      const source = await prisma.logSource.findFirst({
        where: { id: req.params.id, organizationId: user.organizationId! },
      });
      if (!source) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      const adapter = getAdapter(source.sourceType);
      const config = decryptSourceConfig(source.config);
      const until = new Date();
      const since = new Date(until.getTime() - 3_600_000);
      const entries = await adapter.pull({
        config,
        since,
        until,
        limit: 10,
        sourceId: source.id,
      });
      res.json({
        ok: true,
        sample: entries.map((e) => ({
          timestamp: e.timestamp,
          severity: e.severity,
          message: e.message.slice(0, 300),
          errorType: e.errorType,
          serviceName: e.serviceName,
          deploymentId: e.deploymentId,
        })),
      });
    });
  } catch (err) {
    next(err);
  }
});

router.get("/entries", async (req, res, next) => {
  try {
    const user = requireOrganizationUser(req, res);
    if (!user?.organizationId) return;
    await withOrganizationContext(user.organizationId, async () => {
      const limit = Math.min(Number(req.query.limit ?? 50) || 50, 200);
      const offset = Number(req.query.offset ?? 0) || 0;
      const severity = String(req.query.severity ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const where = {
        source: { organizationId: user.organizationId! },
        ...(req.query.source
          ? { sourceId: String(req.query.source) }
          : {}),
        ...(severity.length ? { severity: { in: severity } } : {}),
        ...(req.query.service
          ? { serviceName: String(req.query.service) }
          : {}),
        ...(req.query.environment
          ? { environment: String(req.query.environment) }
          : {}),
        ...(req.query.patternHash
          ? { patternHash: String(req.query.patternHash) }
          : {}),
        ...(req.query.jiraKey ? { jiraKey: String(req.query.jiraKey) } : {}),
        ...(req.query.since || req.query.until
          ? {
              timestamp: {
                ...(req.query.since
                  ? { gte: new Date(String(req.query.since)) }
                  : {}),
                ...(req.query.until
                  ? { lte: new Date(String(req.query.until)) }
                  : {}),
              },
            }
          : {}),
      };
      const [entries, total] = await Promise.all([
        prisma.logEntry.findMany({
          where,
          orderBy: { timestamp: "desc" },
          take: limit,
          skip: offset,
        }),
        prisma.logEntry.count({ where }),
      ]);
      res.json({ entries, total, limit, offset });
    });
  } catch (err) {
    next(err);
  }
});

router.get("/patterns", async (req, res, next) => {
  try {
    const user = requireOrganizationUser(req, res);
    if (!user?.organizationId) return;
    await withOrganizationContext(user.organizationId, async () => {
      const limit = Math.min(Number(req.query.limit ?? 20) || 20, 100);
      const status = String(req.query.status ?? "open");
      const isQaGap =
        req.query.isQaGap === "true"
          ? true
          : req.query.isQaGap === "false"
            ? false
            : undefined;
      const patterns = await prisma.errorPattern.findMany({
        where: {
          organizationId: user.organizationId!,
          ...(status ? { status } : {}),
          ...(isQaGap !== undefined ? { isQaGap } : {}),
          ...(req.query.since
            ? { lastSeen: { gte: new Date(String(req.query.since)) } }
            : {}),
        },
        orderBy: { lastSeen: "desc" },
        take: limit,
      });
      res.json({ patterns });
    });
  } catch (err) {
    next(err);
  }
});

router.get("/patterns/:id", async (req, res, next) => {
  try {
    const user = requireOrganizationUser(req, res);
    if (!user?.organizationId) return;
    await withOrganizationContext(user.organizationId, async () => {
      const pattern = await prisma.errorPattern.findFirst({
        where: {
          id: req.params.id,
          organizationId: user.organizationId!,
        },
        include: { anomalies: { orderBy: { detectedAt: "desc" }, take: 10 } },
      });
      if (!pattern) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      const entries = await prisma.logEntry.findMany({
        where: {
          patternHash: pattern.patternHash,
          source: { organizationId: user.organizationId! },
        },
        orderBy: { timestamp: "desc" },
        take: 50,
      });
      res.json({ pattern, entries });
    });
  } catch (err) {
    next(err);
  }
});

router.post("/patterns/:id/acknowledge", async (req, res, next) => {
  try {
    const user = requireOrganizationUser(req, res);
    if (!user?.organizationId) return;
    await withOrganizationContext(user.organizationId, async () => {
      const pattern = await prisma.errorPattern.findFirst({
        where: {
          id: req.params.id,
          organizationId: user.organizationId!,
        },
      });
      if (!pattern) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      await prisma.anomalyDetection.updateMany({
        where: { patternId: pattern.id, acknowledged: false },
        data: {
          acknowledged: true,
          acknowledgedBy: user.id,
          acknowledgedAt: new Date(),
        },
      });
      await prisma.errorPattern.update({
        where: { id: pattern.id },
        data: { status: "investigating" },
      });
      res.json({ ok: true });
    });
  } catch (err) {
    next(err);
  }
});

router.post("/patterns/:id/resolve", async (req, res, next) => {
  try {
    const user = requireOrganizationUser(req, res);
    if (!user?.organizationId) return;
    await withOrganizationContext(user.organizationId, async () => {
      const bugJiraKey =
        typeof req.body?.bugJiraKey === "string"
          ? req.body.bugJiraKey
          : undefined;
      const pattern = await prisma.errorPattern.findFirst({
        where: {
          id: req.params.id,
          organizationId: user.organizationId!,
        },
      });
      if (!pattern) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      const updated = await prisma.errorPattern.update({
        where: { id: pattern.id },
        data: {
          status: "resolved",
          resolvedAt: new Date(),
          ...(bugJiraKey ? { bugJiraKey } : {}),
        },
      });
      res.json({ pattern: updated });
    });
  } catch (err) {
    next(err);
  }
});

router.post("/patterns/:id/analyse", async (req, res, next) => {
  try {
    const user = requireOrganizationUser(req, res);
    if (!user?.organizationId) return;
    await withOrganizationContext(user.organizationId, async () => {
      const pattern = await prisma.errorPattern.findFirst({
        where: {
          id: req.params.id,
          organizationId: user.organizationId!,
        },
      });
      if (!pattern) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      const analysis = await analyseErrorPattern(pattern.id);
      const refreshed = await prisma.errorPattern.findUnique({
        where: { id: pattern.id },
      });
      res.json({ pattern: refreshed, analysis });
    });
  } catch (err) {
    next(err);
  }
});

router.get("/anomalies", async (req, res, next) => {
  try {
    const user = requireOrganizationUser(req, res);
    if (!user?.organizationId) return;
    await withOrganizationContext(user.organizationId, async () => {
      const severity = String(req.query.severity ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const anomalies = await prisma.anomalyDetection.findMany({
        where: {
          organizationId: user.organizationId!,
          ...(severity.length ? { severity: { in: severity } } : {}),
          ...(req.query.acknowledged === "true"
            ? { acknowledged: true }
            : req.query.acknowledged === "false"
              ? { acknowledged: false }
              : {}),
          ...(req.query.since
            ? { detectedAt: { gte: new Date(String(req.query.since)) } }
            : {}),
        },
        orderBy: { detectedAt: "desc" },
        take: 50,
        include: { pattern: true },
      });
      res.json({ anomalies });
    });
  } catch (err) {
    next(err);
  }
});

router.post("/acknowledge/:anomalyId", async (req, res, next) => {
  try {
    const user = requireOrganizationUser(req, res);
    if (!user?.organizationId) return;
    await withOrganizationContext(user.organizationId, async () => {
      const anomaly = await prisma.anomalyDetection.findFirst({
        where: {
          id: req.params.anomalyId,
          organizationId: user.organizationId!,
        },
      });
      if (!anomaly) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      const updated = await prisma.anomalyDetection.update({
        where: { id: anomaly.id },
        data: {
          acknowledged: true,
          acknowledgedBy: user.id,
          acknowledgedAt: new Date(),
        },
      });
      res.json({ anomaly: updated });
    });
  } catch (err) {
    next(err);
  }
});

router.get("/summary", async (req, res, next) => {
  try {
    const user = requireOrganizationUser(req, res);
    if (!user?.organizationId) return;
    await withOrganizationContext(user.organizationId, async () => {
      const orgId = user.organizationId!;
      const startOfDay = new Date();
      startOfDay.setUTCHours(0, 0, 0, 0);

      const [
        totalErrorsToday,
        newErrorTypesToday,
        criticalAnomalies,
        qaGapsFound,
        topTypes,
        recentAnomalies,
        prevDayErrors,
      ] = await Promise.all([
        prisma.logEntry.count({
          where: {
            source: { organizationId: orgId },
            severity: { in: ["error", "fatal"] },
            timestamp: { gte: startOfDay },
          },
        }),
        prisma.errorPattern.count({
          where: { organizationId: orgId, firstSeen: { gte: startOfDay } },
        }),
        prisma.anomalyDetection.count({
          where: {
            organizationId: orgId,
            severity: "critical",
            acknowledged: false,
          },
        }),
        prisma.errorPattern.count({
          where: { organizationId: orgId, isQaGap: true, status: "open" },
        }),
        prisma.errorPattern.groupBy({
          by: ["errorType"],
          where: { organizationId: orgId },
          _sum: { occurrenceCount: true },
          orderBy: { _sum: { occurrenceCount: "desc" } },
          take: 8,
        }),
        prisma.anomalyDetection.findMany({
          where: { organizationId: orgId },
          orderBy: { detectedAt: "desc" },
          take: 8,
        }),
        prisma.logEntry.count({
          where: {
            source: { organizationId: orgId },
            severity: { in: ["error", "fatal"] },
            timestamp: {
              gte: new Date(startOfDay.getTime() - 86_400_000),
              lt: startOfDay,
            },
          },
        }),
      ]);

      const errorRateTrend =
        totalErrorsToday > prevDayErrors * 1.15
          ? "increasing"
          : totalErrorsToday < prevDayErrors * 0.85
            ? "decreasing"
            : "stable";

      res.json({
        totalErrorsToday,
        newErrorTypesToday,
        criticalAnomalies,
        qaGapsFound,
        errorRateTrend,
        topErrorTypes: topTypes.map((t) => ({
          type: t.errorType,
          count: t._sum.occurrenceCount ?? 0,
          trend: "stable",
        })),
        recentAnomalies,
      });
    });
  } catch (err) {
    next(err);
  }
});

router.get("/config", async (req, res, next) => {
  try {
    const user = requireOrganizationUser(req, res);
    if (!user?.organizationId) return;
    await withOrganizationContext(user.organizationId, async () => {
      const config = await prisma.logIntelligenceConfig.upsert({
        where: { organizationId: user.organizationId! },
        create: { organizationId: user.organizationId! },
        update: {},
      });
      res.json({ config });
    });
  } catch (err) {
    next(err);
  }
});

router.put("/config", async (req, res, next) => {
  try {
    const user = requireOrganizationUser(req, res);
    if (!user?.organizationId) return;
    const body = req.body ?? {};
    await withOrganizationContext(user.organizationId, async () => {
      const config = await prisma.logIntelligenceConfig.upsert({
        where: { organizationId: user.organizationId! },
        create: {
          organizationId: user.organizationId!,
          ...(typeof body.errorSpikeMultiplier === "number"
            ? { errorSpikeMultiplier: body.errorSpikeMultiplier }
            : {}),
          ...(typeof body.autoCreateJiraOnCritical === "boolean"
            ? { autoCreateJiraOnCritical: body.autoCreateJiraOnCritical }
            : {}),
          ...(typeof body.autoNotifySlack === "boolean"
            ? { autoNotifySlack: body.autoNotifySlack }
            : {}),
          ...(typeof body.autoFeedCanary === "boolean"
            ? { autoFeedCanary: body.autoFeedCanary }
            : {}),
          ...(typeof body.logRetentionDays === "number"
            ? { logRetentionDays: body.logRetentionDays }
            : {}),
        },
        update: {
          ...(typeof body.errorSpikeMultiplier === "number"
            ? { errorSpikeMultiplier: body.errorSpikeMultiplier }
            : {}),
          ...(typeof body.autoCreateJiraOnCritical === "boolean"
            ? { autoCreateJiraOnCritical: body.autoCreateJiraOnCritical }
            : {}),
          ...(typeof body.autoNotifySlack === "boolean"
            ? { autoNotifySlack: body.autoNotifySlack }
            : {}),
          ...(typeof body.autoFeedCanary === "boolean"
            ? { autoFeedCanary: body.autoFeedCanary }
            : {}),
          ...(typeof body.logRetentionDays === "number"
            ? { logRetentionDays: body.logRetentionDays }
            : {}),
        },
      });
      res.json({ config });
    });
  } catch (err) {
    next(err);
  }
});

// Manual ingest for authenticated testing
router.post("/ingest/sample", async (req, res, next) => {
  try {
    const user = requireOrganizationUser(req, res);
    if (!user?.organizationId) return;
    await withOrganizationContext(user.organizationId, async () => {
      let source = await prisma.logSource.findFirst({
        where: {
          organizationId: user.organizationId!,
          sourceType: "custom",
          isActive: true,
        },
      });
      if (!source) {
        source = await prisma.logSource.create({
          data: {
            organizationId: user.organizationId!,
            sourceType: "custom",
            displayName: "Manual sample",
            config: encryptSourceConfig({}) as object,
            isActive: true,
          },
        });
      }
      const message = String(req.body?.message ?? "Sample error");
      const { randomUUID } = await import("node:crypto");
      const result = await processNormalisedEntry({
        organizationId: user.organizationId!,
        entry: {
          id: randomUUID(),
          sourceId: source.id,
          sourceType: "custom",
          timestamp: new Date(),
          severity: "error",
          message,
          errorType: String(req.body?.errorType ?? "SampleError"),
          errorCode: null,
          stackTrace: typeof req.body?.stackTrace === "string"
            ? req.body.stackTrace
            : null,
          stackTraceHash: null,
          httpMethod: null,
          httpStatus: null,
          endpoint: typeof req.body?.endpoint === "string" ? req.body.endpoint : null,
          requestId: null,
          userId: null,
          serviceName: String(req.body?.serviceName ?? "sample"),
          serviceVersion: null,
          deploymentId:
            typeof req.body?.deploymentId === "string"
              ? req.body.deploymentId
              : null,
          environment: "production",
          region: null,
          instanceId: null,
          rawPayload: (req.body as Record<string, unknown>) ?? {},
        },
        runActions: true,
      });
      res.json({ ok: true, result });
    });
  } catch (err) {
    next(err);
  }
});

export default router;
