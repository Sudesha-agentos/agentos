import { prisma } from "../db/client";
import { logger } from "../utils/logger";

const prismaAny = prisma as any;

/**
 * Mark index runs left "running" after a crash. Do not restart them here —
 * a full index plus GitNexus in the web process is what OOMs Render and
 * then loops (crash → recover → crash).
 */
export async function recoverStaleIndexRuns(): Promise<void> {
  const stuck = await prismaAny.codebaseIndexRun.findMany({
    where: { status: { in: ["running", "queued"] } },
    orderBy: { startedAt: "asc" },
  });

  if (stuck.length === 0) return;

  logger.warn(
    { count: stuck.length },
    "marking interrupted codebase index runs failed — re-index from the UI when the API is stable"
  );

  for (const run of stuck) {
    const kind = run.runType === "full" ? "Full" : "Incremental";
    await prismaAny.codebaseIndexRun.update({
      where: { id: run.id },
      data: {
        status: "failed",
        error: `${kind} index interrupted by server restart — trigger a full re-index when the API has headroom.`,
        completedAt: new Date(),
      },
    });
  }
}
