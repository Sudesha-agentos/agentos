import { VIRIN_NAME } from "../../entities/pm-agents";

export const PM_PIPELINE_PREFIX = "pm:";

/** Map Virin statuses to pipeline explorer tab filters. */
export function mapExplorerStatus(pmStatus) {
  switch (pmStatus) {
    case "AWAITING_INPUT":
    case "AWAITING_CONFIRMATION":
      return "PAUSED";
    case "RUNNING":
      return "RUNNING";
    case "COMPLETED":
      return "COMPLETED";
    case "FAILED":
      return "FAILED";
    default:
      return pmStatus;
  }
}

export function isPmPipelineId(id) {
  return typeof id === "string" && id.startsWith(PM_PIPELINE_PREFIX);
}

export function pmPipelineId(jiraKey) {
  return `${PM_PIPELINE_PREFIX}${jiraKey}`;
}

export function jiraKeyFromPmPipelineId(id) {
  return id.slice(PM_PIPELINE_PREFIX.length);
}

export function mapPmAnalysisToPipelineSummary(pm) {
  return {
    id: pmPipelineId(pm.jiraKey),
    kind: "pm",
    ticketId: pm.jiraKey,
    jiraKey: pm.jiraKey,
    summary: pm.summary ?? `${VIRIN_NAME} analysis`,
    currentStage: pm.currentStage,
    status: mapExplorerStatus(pm.status),
    virinStatus: pm.status,
    startedAt: pm.startedAt,
    completedAt: pm.completedAt ?? null,
    recommendation: pm.recommendation ?? null,
    severity: pm.severity ?? null,
    costUsd: pm.costUsd ?? null,
    raw: pm,
  };
}

/** One card per jiraKey — prefer Virin PM record over classic pipeline. */
export function mergePipelineExplorerItems(pmSummaries, classicItems, queuedItems) {
  const byKey = new Map();

  for (const item of classicItems) {
    if (item.jiraKey) byKey.set(item.jiraKey, item);
  }

  for (const item of queuedItems) {
    if (item.jiraKey && !byKey.has(item.jiraKey)) {
      byKey.set(item.jiraKey, item);
    }
  }

  for (const item of pmSummaries) {
    byKey.set(item.jiraKey, item);
  }

  return [...byKey.values()].sort((a, b) =>
    (b.startedAt ?? "").localeCompare(a.startedAt ?? "")
  );
}

export function resolveQueuedSelection(selectedId, items) {
  if (!selectedId?.startsWith("queued-")) return selectedId ?? null;
  const jiraKey = selectedId.slice("queued-".length);
  const match = items.find((p) => p.jiraKey === jiraKey && p.kind !== "queued");
  return match?.id ?? selectedId;
}
