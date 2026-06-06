import type { Request, Response } from "express";
import { logger } from "../../utils/logger";
import { getPipelineWebhookSecret } from "./credentialsStore";
import { isPipelineIntakeStatus } from "./intakeConfig";
import { mirrorEligibleStatus } from "./config";
import { type PipelineJiraWebhookPayload } from "./ticketNormalizer";
import { syncMirroredIssue } from "./mirror/syncService";
import { enqueueIntakeFromWebhook } from "./intakeEnqueueService";

function verifyPipelineWebhook(req: Request): boolean {
  const expected = getPipelineWebhookSecret();
  if (!expected) return true;
  const provided = req.header("x-agentos-secret");
  return provided === expected;
}

function enteredIntakeStatus(payload: PipelineJiraWebhookPayload): boolean {
  const changelog = (
    payload as {
      changelog?: {
        items?: Array<{ field?: string; toString?: string }>;
      };
    }
  ).changelog;

  if (changelog?.items?.length) {
    const statusChange = changelog.items.find((i) => i.field === "status");
    if (!statusChange) return false;
    return isPipelineIntakeStatus(statusChange.toString);
  }

  const currentStatus =
    (payload.issue.fields as { status?: { name?: string } }).status?.name ?? "";
  return isPipelineIntakeStatus(currentStatus);
}

/** issue_updated in AI Worker column → decompose + queued pipeline; closed/done → mirror. */
export async function handlePipelineJiraWebhook(
  req: Request,
  res: Response
): Promise<void> {
  if (!verifyPipelineWebhook(req)) {
    logger.warn({ ip: req.ip }, "rejected pipeline jira webhook — bad secret");
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  const payload = req.body as PipelineJiraWebhookPayload | undefined;
  const event = payload?.webhookEvent;

  if (!payload?.issue?.key || !event) {
    res.status(200).json({ ok: true, action: "ignored" });
    return;
  }

  res.status(200).json({ ok: true, event });

  if (event === "jira:issue_updated") {
    void handleIssueUpdated(payload).catch((err) =>
      logger.error({ err }, "pipeline issue_updated failed")
    );
  }
}

async function handleIssueUpdated(
  payload: PipelineJiraWebhookPayload
): Promise<void> {
  const jiraKey = payload.issue.key;
  const statusName =
    (payload.issue.fields as { status?: { name?: string } }).status?.name ?? "";

  logger.info({ jiraKey, statusName }, "pipeline jira webhook: issue_updated");

  if (enteredIntakeStatus(payload)) {
    const result = await enqueueIntakeFromWebhook(payload);
    if (result) {
      logger.info(
        {
          sourceKey: result.sourceKey,
          enqueued: result.enqueued,
          skipped: result.skipped,
          started: result.started,
          groups: result.groups,
        },
        result.started
          ? "pipeline intake started after decomposition"
          : "pipeline intake queued after decomposition"
      );
    }
  }

  if (mirrorEligibleStatus(statusName)) {
    const result = await syncMirroredIssue(jiraKey);
    if (result.synced) {
      logger.info({ jiraKey }, "mirror updated from webhook");
    }
  }
}
