const running = new Set<string>();

export function isPmAnalysisRunning(jiraKey: string): boolean {
  return running.has(jiraKey.trim().toUpperCase());
}

/** Fire-and-forget Virin stage runner (shared by API routes and Jira intake). */
export function startPmAnalysisInBackground(
  jiraKey: string,
  run: () => Promise<unknown>
): void {
  const key = jiraKey.trim().toUpperCase();
  if (running.has(key)) return;
  running.add(key);
  void run()
    .catch(() => {
      /* errors stored on pmAnalysisStore record */
    })
    .finally(() => {
      running.delete(key);
    });
}
