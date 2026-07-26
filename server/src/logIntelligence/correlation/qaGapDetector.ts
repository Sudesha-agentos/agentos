import { prisma } from "../../db/client";
import { findRelatedCriteria } from "./criteriaCorrelator";
import { loadPipelineCorrelationContext } from "./pipelineCorrelator";

/**
 * Mark ErrorPattern.isQaGap when related acceptance criteria existed but QA did not cover them.
 */
export async function detectQaGap(patternId: string): Promise<boolean> {
  const pattern = await prisma.errorPattern.findUnique({
    where: { id: patternId },
  });
  if (!pattern?.pipelineId) return false;

  const ctx = await loadPipelineCorrelationContext(pattern.pipelineId);
  if (!ctx) return false;

  const related = await findRelatedCriteria({
    messageTemplate: pattern.messageTemplate,
    acceptanceCriteria: ctx.acceptanceCriteria,
    threshold: 0.75,
  });

  if (related.length === 0) {
    // Historical pattern: connection/auth errors often QA gaps
    const systematic =
      /ConnectionRefused|ConnectionTimeout|UniqueConstraint|auth/i.test(
        pattern.errorType
      );
    if (!systematic) return false;
    await prisma.errorPattern.update({
      where: { id: patternId },
      data: {
        isQaGap: true,
        qaGapReason:
          "Systematic error type historically missed by QA (no related criterion match)",
      },
    });
    return true;
  }

  const uncoveredSet = new Set(
    ctx.uncoveredCriteria.map((c) => c.toLowerCase().trim())
  );
  const relatedUncovered = related.filter(
    (r) =>
      uncoveredSet.has(r.criterion.toLowerCase().trim()) ||
      ctx.uncoveredCriteria.some((u) =>
        u.toLowerCase().includes(r.criterion.toLowerCase().slice(0, 40))
      )
  );

  // Also treat as gap if no QA stage coverage summary suggests testing
  const noQa =
    !ctx.qaCoverageSummary ||
    ctx.qaCoverageSummary === "Not tested" ||
    /covered=0\//.test(ctx.qaCoverageSummary);

  const isGap = relatedUncovered.length > 0 || noQa;
  if (isGap) {
    await prisma.errorPattern.update({
      where: { id: patternId },
      data: {
        isQaGap: true,
        qaGapReason: relatedUncovered[0]
          ? `Related criterion not covered: ${relatedUncovered[0].criterion.slice(0, 300)}`
          : `Related criteria exist but QA coverage missing (${ctx.qaCoverageSummary})`,
      },
    });
  }
  return isGap;
}
