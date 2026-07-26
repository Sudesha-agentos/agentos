import { chatCompletionText, parseDiscoveryJson } from "../llm/openaiCompletion";
import { listActiveLibraryHypotheses } from "../logIntelligence/actions/canaryFeedback";
import { MAX_CANARY_HYPOTHESES } from "./config";
import type { ApplicationUnderstanding, CanaryHypothesis } from "./types";

export async function generateHypotheses(
  understanding: ApplicationUnderstanding,
  organizationId?: string
): Promise<CanaryHypothesis[]> {
  const { text } = await chatCompletionText({
    system: buildHypothesisSystemPrompt(),
    user: JSON.stringify(understanding, null, 2),
    maxTokens: 4000,
  });

  const parsed = parseDiscoveryJson<{ hypotheses: CanaryHypothesis[] }>(text, "canaryHypotheses");
  const list = (parsed.hypotheses ?? []).slice(0, MAX_CANARY_HYPOTHESES);

  const generated = list.map((h, index) => ({
    id: h.id || `H-${String(index + 1).padStart(3, "0")}`,
    priority: h.priority ?? "medium",
    title: h.title,
    reasoning: h.reasoning,
    evidence: h.evidence ?? [],
    probeScenario: h.probeScenario,
    status: "pending" as const,
  }));

  if (!organizationId) return generated;

  try {
    const library = await listActiveLibraryHypotheses(organizationId);
    const fromLibrary: CanaryHypothesis[] = library.map((row, i) => ({
      id: `LIB-${String(i + 1).padStart(3, "0")}`,
      priority: "high" as const,
      title: `Production QA gap: ${row.errorType}`,
      reasoning: `Log Intelligence QA gap — ${row.messageTemplate.slice(0, 200)}`,
      evidence: [
        row.endpoint ? `endpoint:${row.endpoint}` : null,
        row.service ? `service:${row.service}` : null,
        row.sourcePatternId ? `pattern:${row.sourcePatternId}` : null,
      ].filter(Boolean) as string[],
      probeScenario: row.probeScenario,
      status: "pending" as const,
    }));

    const merged = [...fromLibrary, ...generated];
    // Prefer library probes first; cap total
    return merged.slice(0, MAX_CANARY_HYPOTHESES);
  } catch {
    return generated;
  }
}

function buildHypothesisSystemPrompt(): string {
  return `
You are a Canary QA hypothesis generator. Produce directed, testable failure hypotheses.

Think simultaneously as:
1) A developer hunting boundary/null/race/constraint bugs
2) A malicious user hunting injection/auth bypass/data leakage
3) A chaos engineer probing dependency failure and unexpected state

Return ONLY JSON:
{
  "hypotheses": [
    {
      "id": "H-001",
      "priority": "critical|high|medium|low",
      "title": "short title",
      "reasoning": "why this might fail",
      "evidence": ["evidence from recon"],
      "probeScenario": "concrete steps to prove/disprove using HTTP tools"
    }
  ]
}

Prioritize critical paths: auth, payments, concurrency, pagination, exports.
Generate 8-15 hypotheses when possible.
  `.trim();
}
