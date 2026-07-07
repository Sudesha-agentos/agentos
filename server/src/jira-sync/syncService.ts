import { searchIssues } from "../jira-intake/jiraApiClient";
import { withRetry } from "../utils/retry";
import { logger } from "../utils/logger";
import { getJiraSyncConfig } from "./config";
import { embedSyncedIssue } from "./embedder";
import {
  fetchJiraIssueByKey,
  mapJiraApiIssue,
  type FetchedJiraIssue,
} from "./issueFetcher";
import { upsertJiraIssueRecord } from "./issueRepository";
import { requireActiveOrganizationId } from "../organization/orgScope";
import { buildFullSyncJql, buildIncrementalSyncJql } from "./jql";
import {
  completeSyncRun,
  createSyncRun,
  getLastSuccessfulWatermark,
  isJiraSyncRunning,
  setJiraSyncRunning,
} from "./syncState";
import { scanIntakeFromSyncedIssues } from "./intakeScan";
import { SyncCircuitBreaker } from "../rag/supabaseErrors";

interface JiraSearchIssue {
  id: string;
  key: string;
  fields: Record<string, unknown>;
}

async function processIssue(
  issue: FetchedJiraIssue,
  breaker: SyncCircuitBreaker
): Promise<{ synced: boolean; embedded: boolean }> {
  if (breaker.tripped) {
    return { synced: false, embedded: false };
  }

  await upsertJiraIssueRecord(issue);
  let embedded = false;
  try {
    embedded = await embedSyncedIssue(issue);
    breaker.recordSuccess();
  } catch (err) {
    logger.warn({ err, jiraKey: issue.jiraKey }, "jira sync embed failed");
    if (await breaker.recordFailure(err)) {
      logger.error("Jira sync embed aborting after repeated 402/429 responses");
    }
  }
  return { synced: true, embedded };
}

async function paginatedSync(jql: string): Promise<{
  issuesSynced: number;
  issuesSkipped: number;
  errors: number;
  latestUpdated: Date | null;
}> {
  const cfg = getJiraSyncConfig();
  const breaker = new SyncCircuitBreaker();
  let nextPageToken: string | undefined;
  let isLast = false;
  let issuesSynced = 0;
  let issuesSkipped = 0;
  let errors = 0;
  let latestUpdated: Date | null = null;

  while (!isLast && !breaker.tripped) {
    const page = await withRetry(
      () =>
        searchIssues<JiraSearchIssue>(jql, {
          maxResults: cfg.pageSize,
          nextPageToken,
        }),
      {
        maxAttempts: 3,
        baseDelayMs: 1000,
        maxDelayMs: 10000,
        context: { operation: "jira-sync-search" },
      }
    );

    for (const raw of page.issues) {
      if (breaker.tripped) break;

      try {
        const mapped = mapJiraApiIssue(raw, cfg.maxComments);
        if (mapped.jiraUpdatedAt) {
          if (!latestUpdated || mapped.jiraUpdatedAt > latestUpdated) {
            latestUpdated = mapped.jiraUpdatedAt;
          }
        }
        const result = await processIssue(mapped, breaker);
        if (result.synced) issuesSynced += 1;
        else issuesSkipped += 1;
      } catch (err) {
        errors += 1;
        logger.warn({ err, jiraKey: raw.key }, "jira sync issue failed");
        if (await breaker.recordFailure(err)) {
          logger.error("Jira sync aborting after repeated 402/429 responses");
          break;
        }
      }
    }

    isLast = page.isLast;
    nextPageToken = page.nextPageToken;
    if (!page.issues.length) break;
  }

  return { issuesSynced, issuesSkipped, errors, latestUpdated };
}

export async function runJiraFullSync(options?: {
  projectKeys?: string[];
}): Promise<{
  runId: string;
  issuesSynced: number;
  issuesSkipped: number;
  errors: number;
}> {
  const organizationId = requireActiveOrganizationId();
  if (isJiraSyncRunning(organizationId)) {
    throw new Error("Jira sync already running");
  }

  setJiraSyncRunning(true, organizationId);
  const run = await createSyncRun("FULL", organizationId);
  const jql = buildFullSyncJql(options?.projectKeys);

  try {
    const result = await paginatedSync(jql);
    await completeSyncRun(run.id, {
      status: result.errors > 0 && result.issuesSynced === 0 ? "FAILED" : "COMPLETED",
      issuesSynced: result.issuesSynced,
      issuesSkipped: result.issuesSkipped,
      errors: result.errors,
      watermark: result.latestUpdated ?? new Date(),
    });

    await scanIntakeFromSyncedIssues().catch((err) =>
      logger.warn({ err }, "intake scan after full sync failed")
    );

    logger.info({ runId: run.id, ...result, jql }, "jira full sync complete");
    return { runId: run.id, ...result };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await completeSyncRun(run.id, {
      status: "FAILED",
      issuesSynced: 0,
      issuesSkipped: 0,
      errors: 1,
      errorMessage: message,
    });
    throw err;
  } finally {
    setJiraSyncRunning(false, organizationId);
  }
}

export async function runJiraIncrementalSync(options?: {
  projectKeys?: string[];
}): Promise<{
  runId: string;
  issuesSynced: number;
  issuesSkipped: number;
  errors: number;
}> {
  const organizationId = requireActiveOrganizationId();
  if (isJiraSyncRunning(organizationId)) {
    throw new Error("Jira sync already running");
  }

  setJiraSyncRunning(true, organizationId);
  const run = await createSyncRun("INCREMENTAL", organizationId);
  const watermark =
    (await getLastSuccessfulWatermark(organizationId)) ??
    new Date(Date.now() - 24 * 60 * 60 * 1000);
  const jql = buildIncrementalSyncJql(watermark, options?.projectKeys);

  try {
    const result = await paginatedSync(jql);
    await completeSyncRun(run.id, {
      status: result.errors > 0 && result.issuesSynced === 0 ? "FAILED" : "COMPLETED",
      issuesSynced: result.issuesSynced,
      issuesSkipped: result.issuesSkipped,
      errors: result.errors,
      watermark: result.latestUpdated ?? new Date(),
    });

    await scanIntakeFromSyncedIssues().catch((err) =>
      logger.warn({ err }, "intake scan after incremental sync failed")
    );

    logger.info({ runId: run.id, ...result, jql }, "jira incremental sync complete");
    return { runId: run.id, ...result };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await completeSyncRun(run.id, {
      status: "FAILED",
      issuesSynced: 0,
      issuesSkipped: 0,
      errors: 1,
      errorMessage: message,
    });
    throw err;
  } finally {
    setJiraSyncRunning(false, organizationId);
  }
}

export async function syncSingleJiraIssueFromWebhook(
  jiraKey: string
): Promise<void> {
  const issue = await fetchJiraIssueByKey(jiraKey);
  if (!issue) return;
  const breaker = new SyncCircuitBreaker();
  await processIssue(issue, breaker);
}

export async function syncSingleJiraIssueFromWebhookWithRetry(
  jiraKey: string
): Promise<void> {
  await withRetry(() => syncSingleJiraIssueFromWebhook(jiraKey), {
    maxAttempts: 2,
    baseDelayMs: 500,
    maxDelayMs: 3000,
    context: { operation: "jira-sync-webhook", jiraKey },
  });
}

export { getJiraIssueStats } from "./issueRepository";
export { getLatestSyncRun, isJiraSyncRunning } from "./syncState";
