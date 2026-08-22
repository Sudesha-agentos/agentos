/** Derive pipeline tab counts from list summaries. */

export function derivePipelineCounts(pipelines = []) {
  const active = pipelines.filter((p) => ["RUNNING", "QUEUED"].includes(p.status)).length;
  const review = pipelines.filter((p) =>
    ["PAUSED", "AWAITING_HUMAN"].includes(p.status)
  ).length;
  const running = pipelines.filter((p) => p.status === "RUNNING").length;
  const completedToday = pipelines.filter((p) => {
    if (p.status !== "COMPLETED" || !p.completedAt) return false;
    const d = new Date(p.completedAt);
    const now = new Date();
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  }).length;

  return { active, review, running, completedToday };
}

export function deriveReviewQueueItems(pipelines = [], orgPath = (...segments) => {
  const tail = segments.filter(Boolean).join("/");
  return tail ? `/app/${tail}` : "/app";
}) {
  return pipelines
    .filter((p) => ["PAUSED", "AWAITING_HUMAN"].includes(p.status))
    .map((p) => {
      const stage = p.currentStage ?? "PRODUCT_AGENT";
      const isPrd = stage === "PRD_VALIDATION" || stage === "PRODUCT_AGENT";
      const isEng =
        stage === "ENGINEERING_AGENT" || stage === "IMPLEMENTATION_VALIDATION";
      const issues = (p.latestValidation?.issues ?? []).filter(
        (issue) => issue.severity === "error"
      );
      const reason =
        issues[0]?.message ??
        (isPrd
          ? "PRD gate requires human review"
          : isEng
            ? "Implementation gate requires human review"
            : "QA gate requires human review");
      const severity = issues.some((issue) =>
        ["INTENT_DRIFT", "COMPILE_FAILED", "TESTS_FAILED", "SECURITY_GATE"].includes(
          issue.code
        )
      )
        ? "critical"
        : isPrd
          ? "critical"
          : "warning";
      const actionLabel = isPrd ? "Review PRD" : isEng ? "Review plan" : "Review";
      const actionTo = isPrd
        ? orgPath("pipelines", p.id, "prd")
        : orgPath("pipelines", p.id, "override");
      const started = p.startedAt ? new Date(p.startedAt).getTime() : Date.now();
      const waitingMinutes = Math.max(1, Math.round((Date.now() - started) / 60_000));

      return {
        id: p.id,
        jiraKey: p.jiraKey,
        summary: p.summary,
        stage,
        severity,
        reason,
        waitingMinutes,
        actionLabel,
        actionTo,
      };
    })
    .sort((a, b) => b.waitingMinutes - a.waitingMinutes);
}

export function deriveRecentCompletions(pipelines = [], limit = 5) {
  return pipelines
    .filter((p) => p.status === "COMPLETED")
    .sort((a, b) => new Date(b.completedAt ?? 0) - new Date(a.completedAt ?? 0))
    .slice(0, limit)
    .map((p) => ({
      id: p.id,
      jiraKey: p.jiraKey,
      summary: p.summary,
      completedAt: p.completedAt,
      qaPassed: true,
    }));
}
