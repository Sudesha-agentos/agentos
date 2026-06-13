import { getOpenAIPremiumModel } from "../llm/openaiClient";
import { chatCompletionText, parseDiscoveryJson } from "../llm/openaiCompletion";
import type { CompetitorEntry } from "./types";
import { fetchCompanyWebContext } from "./webFetcher";

export async function discoverCompetitorsFromWeb(input: {
  website: string;
  companyName?: string;
  productSummary?: string;
}): Promise<{
  competitors: CompetitorEntry[];
  usage: { costUsd: number };
  model: string;
  sources: Awaited<ReturnType<typeof fetchCompanyWebContext>>["sources"];
}> {
  const bundle = await fetchCompanyWebContext(input.website);
  const premiumModel = getOpenAIPremiumModel();

  const user = `Company: ${input.companyName || "Unknown"}
Website: ${bundle.website}
${input.productSummary ? `Product: ${input.productSummary}` : ""}

Public web content from company site and common pages:
${bundle.combinedText}

Extract direct and indirect competitors mentioned or implied for this product category.
Include well-known rivals even if not named on the site when category is clear.

Return JSON:
{
  "competitors": [
    {
      "name": "Competitor Inc",
      "website": "https://competitor.com",
      "description": "one-line what they offer",
      "source": "why listed — e.g. mentioned on pricing page / category peer"
    }
  ],
  "notes": "confidence and gaps"
}`;

  const { text, usage, model } = await chatCompletionText({
    system:
      "You identify B2B/SaaS competitors from public marketing content. Only include real companies with plausible websites. Max 12 entries, ranked by relevance.",
    user,
    maxTokens: 2400,
    jsonMode: true,
    model: premiumModel,
  });

  const parsed = parseDiscoveryJson<{
    competitors?: CompetitorEntry[];
  }>(text, "competitor_discovery");

  const competitors = (parsed.competitors ?? [])
    .map((c) => ({
      name: String(c.name ?? "").trim(),
      website: normalizeCompetitorUrl(String(c.website ?? "")),
      description: String(c.description ?? "").trim(),
      source: String(c.source ?? "web discovery").trim(),
    }))
    .filter((c) => c.name.length > 0)
    .slice(0, 12);

  return {
    competitors,
    usage: { costUsd: usage.costUsd },
    model,
    sources: bundle.sources,
  };
}

function normalizeCompetitorUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}
