export const DEFAULT_JIRA_INTAKE_STATUSES = ["AI Worker"];

/**
 * Map a Jira status name onto the AgentOS work-board column slug.
 * Jira remains source of truth; this is a best-effort layout for the Kanban.
 */
export function mapJiraStatusToColumnSlug(
  status: string,
  intakeStatuses: string[] = DEFAULT_JIRA_INTAKE_STATUSES
): string {
  const needle = status.trim().toLowerCase();
  if (!needle) return "backlog";

  if (intakeStatuses.some((s) => s.trim().toLowerCase() === needle)) {
    return "ai_worker";
  }
  if (needle.includes("ai worker") || needle === "ai_worker" || needle === "aiworker") {
    return "ai_worker";
  }

  if (
    /\b(done|closed|resolved|cancelled|canceled|complete|completed|won't do|wont do|duplicate)\b/.test(
      needle
    )
  ) {
    return "done";
  }

  if (/\b(review|qa|awaiting human|in qa|code review)\b/.test(needle) || needle.includes("in review")) {
    return "review";
  }

  if (
    /\b(in progress|in development|doing|in dev|started|working)\b/.test(needle) ||
    needle === "in-progress"
  ) {
    return "in_progress";
  }

  if (
    /\b(ready|to do|todo|to-do|selected for development)\b/.test(needle) ||
    needle === "selected for development"
  ) {
    return "ready";
  }

  return "backlog";
}

export function isJiraMirroredWorkItem(item: { source?: string | null }): boolean {
  return (item.source ?? "").trim().toLowerCase() === "jira";
}

/** Spreadsheet / manually created WB-n cards — not a live Jira ticket. */
export function isLocalOnlyWorkItem(item: {
  source?: string | null;
  key?: string | null;
}): boolean {
  return !isJiraMirroredWorkItem(item);
}
