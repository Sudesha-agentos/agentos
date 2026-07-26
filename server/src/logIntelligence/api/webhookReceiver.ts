import type { Request, Response } from "express";
import { prisma } from "../../db/client";
import { decryptSourceConfig } from "../crypto/sourceSecrets";
import { SentryAdapter } from "../adapters/sentryAdapter";
import { OtlpAdapter } from "../adapters/otlpAdapter";
import { parseVectorPayload } from "../ingestion/vectorAdapter";
import { processNormalisedEntry } from "../ingestion/processEntry";
import { logger } from "../../utils/logger";

/**
 * Resolve the target source without cross-tenant ambiguity:
 * - with an organizationId hint, scope to that org;
 * - without a hint, only match when exactly ONE active source of this type
 *   exists across all orgs (single-tenant convenience). Otherwise return
 *   "ambiguous" so the caller demands sourceId / organizationId.
 */
async function findSource(
  sourceType: string,
  organizationId?: string | null
): Promise<
  | { kind: "found"; source: { id: string; organizationId: string; config: unknown } }
  | { kind: "not_found" }
  | { kind: "ambiguous" }
> {
  const matches = await prisma.logSource.findMany({
    where: {
      sourceType,
      isActive: true,
      ...(organizationId ? { organizationId } : {}),
    },
    orderBy: { createdAt: "asc" },
    take: 2,
  });
  if (matches.length === 0) return { kind: "not_found" };
  if (!organizationId && matches.length > 1) return { kind: "ambiguous" };
  return { kind: "found", source: matches[0]! };
}

function orgHintFrom(req: Request): string | undefined {
  if (typeof req.query.organizationId === "string") {
    return req.query.organizationId;
  }
  const header = req.headers["x-organization-id"];
  return typeof header === "string" ? header : undefined;
}

export async function handleSentryWebhook(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const lookup = await findSource("sentry", orgHintFrom(req));
    if (lookup.kind === "ambiguous") {
      res.status(400).json({
        error: "organization_required",
        message:
          "Multiple Sentry sources exist. Append ?organizationId=<orgId> to the webhook URL.",
      });
      return;
    }
    if (lookup.kind === "not_found") {
      res.status(404).json({ error: "no_active_sentry_source" });
      return;
    }
    const source = lookup.source;

    const adapter = new SentryAdapter();
    const config = decryptSourceConfig(source.config);
    const entry = adapter.fromWebhookPayload(
      (req.body ?? {}) as Record<string, unknown>,
      source.id,
      config
    );
    if (!entry) {
      res.status(400).json({ error: "unrecognised_sentry_payload" });
      return;
    }

    const result = await processNormalisedEntry({
      organizationId: source.organizationId,
      entry,
      runActions: true,
    });
    res.json({ ok: true, entryId: result?.entryId ?? null });
  } catch (err) {
    logger.error({ err }, "sentry webhook failed");
    res.status(500).json({ error: "sentry_webhook_failed" });
  }
}

export async function handleOtlpIngest(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const sourceId =
      typeof req.query.sourceId === "string" ? req.query.sourceId : undefined;

    let source: { id: string; organizationId: string } | null = null;
    if (sourceId) {
      source = await prisma.logSource.findFirst({
        where: { id: sourceId, isActive: true },
      });
    } else {
      const lookup = await findSource("otlp", orgHintFrom(req));
      if (lookup.kind === "ambiguous") {
        res.status(400).json({
          error: "source_required",
          message:
            "Multiple OTLP sources exist. Append ?sourceId=<id> or ?organizationId=<orgId>.",
        });
        return;
      }
      source = lookup.kind === "found" ? lookup.source : null;
    }

    if (!source) {
      res.status(404).json({ error: "no_active_otlp_source" });
      return;
    }

    const adapter = new OtlpAdapter();
    const entries = adapter.parseOtlpJson(
      (req.body ?? {}) as Record<string, unknown>,
      source.id
    );
    let n = 0;
    for (const entry of entries) {
      const result = await processNormalisedEntry({
        organizationId: source.organizationId,
        entry,
      });
      if (result) n += 1;
    }
    res.json({ ok: true, ingested: n });
  } catch (err) {
    logger.error({ err }, "otlp ingest failed");
    res.status(500).json({ error: "otlp_ingest_failed" });
  }
}

export async function handleCustomIngest(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const sourceId =
      typeof req.query.sourceId === "string" ? req.query.sourceId : undefined;

    let source: { id: string; organizationId: string } | null = null;
    if (sourceId) {
      source = await prisma.logSource.findFirst({
        where: { id: sourceId, isActive: true },
      });
    } else {
      const lookup = await findSource("custom", orgHintFrom(req));
      if (lookup.kind === "ambiguous") {
        res.status(400).json({
          error: "source_required",
          message:
            "Multiple custom sources exist. Append ?sourceId=<id> or ?organizationId=<orgId>.",
        });
        return;
      }
      source = lookup.kind === "found" ? lookup.source : null;
    }

    if (!source) {
      res.status(404).json({ error: "no_active_custom_source" });
      return;
    }

    const entries = parseVectorPayload(req.body, source.id);
    let n = 0;
    for (const entry of entries) {
      const result = await processNormalisedEntry({
        organizationId: source.organizationId,
        entry,
      });
      if (result) n += 1;
    }
    res.json({ ok: true, ingested: n });
  } catch (err) {
    logger.error({ err }, "custom ingest failed");
    res.status(500).json({ error: "custom_ingest_failed" });
  }
}
