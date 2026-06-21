import { logger } from "../../utils/logger";
import { pmAnalysisStore } from "./store";

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
    .catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ err, jiraKey: key }, "Virin background run failed");
      const existing = pmAnalysisStore.get(key);
      if (existing?.status === "RUNNING") {
        pmAnalysisStore.setStatus(key, "FAILED", message);
      }
    })
    .finally(() => {
      running.delete(key);
    });
}
