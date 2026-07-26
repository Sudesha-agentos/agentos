import { createEmbeddingVectors } from "../../llm/embeddings";
import { logger } from "../../utils/logger";

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/**
 * Semantic similarity between error message template and acceptance criteria.
 * Returns criteria with similarity > threshold.
 */
export async function findRelatedCriteria(input: {
  messageTemplate: string;
  acceptanceCriteria: string[];
  threshold?: number;
}): Promise<Array<{ criterion: string; similarity: number }>> {
  const threshold = input.threshold ?? 0.75;
  const criteria = input.acceptanceCriteria.filter((c) => c.trim().length > 0);
  if (!criteria.length || !input.messageTemplate.trim()) return [];

  try {
    const vectors = await createEmbeddingVectors([
      input.messageTemplate.slice(0, 2000),
      ...criteria.map((c) => c.slice(0, 2000)),
    ]);
    const [errorVec, ...critVecs] = vectors;
    if (!errorVec) return [];

    const hits: Array<{ criterion: string; similarity: number }> = [];
    for (let i = 0; i < criteria.length; i++) {
      const sim = cosine(errorVec, critVecs[i] ?? []);
      if (sim >= threshold) {
        hits.push({ criterion: criteria[i]!, similarity: sim });
      }
    }
    return hits.sort((a, b) => b.similarity - a.similarity);
  } catch (err) {
    logger.warn({ err }, "criteria correlator embedding failed");
    // Fallback: simple keyword overlap
    const tokens = new Set(
      input.messageTemplate.toLowerCase().split(/\W+/).filter((t) => t.length > 3)
    );
    return criteria
      .map((criterion) => {
        const words = criterion.toLowerCase().split(/\W+/).filter((t) => t.length > 3);
        const overlap = words.filter((w) => tokens.has(w)).length;
        const similarity = words.length ? overlap / words.length : 0;
        return { criterion, similarity };
      })
      .filter((h) => h.similarity >= 0.35)
      .sort((a, b) => b.similarity - a.similarity);
  }
}
