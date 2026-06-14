import { getOpenAIPremiumModel } from "../llm/openaiClient";
import { chatCompletionText, parseDiscoveryJson } from "../llm/openaiCompletion";
import { logger } from "../utils/logger";
import type { CompetitorEntry } from "./types";
import { fetchCompanyWebContext } from "./webFetcher";

export type CompetitorApproachAnalysis = {
  competitorName: string;
  competitorWebsite: string;
  howTheySolveIt: string;
  strengths: string[];
  gaps: string[];
  sources: string[];
};

const COMPETITOR_PATHS = ["", "/product", "/products", "/features", "/solutions", "/platform"];

export async function analyzeCompetitorApproaches(input: {
  featureSummary: string;
  ticketSummary: string;
  competitors: CompetitorEntry[];
}): Promise<{
  analyses: CompetitorApproachAnalysis[];
  summaryMarkdown: string;
  usage: { costUsd: number };
  model: string;
}> {
  const targets = input.competitors.filter((c) => c.name?.trim()).slice(0, 6);
  if (!targets.length) {
    return {
      analyses: [],
      summaryMarkdown: "No competitors configured for analysis.",
      usage: { costUsd: 0 },
      model: "none",
    };
  }

  const scrapedBlocks: string[] = [];
  const perCompetitorSources: Record<string, string[]> = {};

  for (const competitor of targets) {
    if (!competitor.website?.trim()) continue;
    try {
      const origin = competitor.website.replace(/\/$/, "");
      const chunks: string[] = [];
      const urls: string[] = [];
      for (const path of COMPETITOR_PATHS) {
        try {
          const bundle = await fetchCompanyWebContext(`${origin}${path}`);
          if (bundle.combinedText.length > 100) {
            chunks.push(bundle.combinedText.slice(0, 6000));
            urls.push(...bundle.sources.filter((s) => s.ok).map((s) => s.url));
          }
        } catch {
          /* try next path */
        }
      }
      if (chunks.length) {
        scrapedBlocks.push(
          `=== ${competitor.name} (${origin}) ===\n${chunks.join("\n\n").slice(0, 14000)}`
        );
        perCompetitorSources[competitor.name] = [...new Set(urls)].slice(0, 8);
      }
    } catch (err) {
      logger.warn({ err, competitor: competitor.name }, "competitor scrape failed");
    }
  }

  const premiumModel = getOpenAIPremiumModel();
  const user = `Feature / problem being brainstormed:
${input.featureSummary}

Ticket summary: ${input.ticketSummary}

Competitors to analyze: ${targets.map((c) => c.name).join(", ")}

Scraped public content from competitor sites (Jina Reader + HTML meta):
${scrapedBlocks.join("\n\n") || "No competitor pages could be scraped."}

For EACH competitor with scraped content, explain how they approach this problem today.

Return JSON:
{
  "analyses": [
    {
      "competitorName": "Name",
      "competitorWebsite": "https://...",
      "howTheySolveIt": "2-4 sentences",
      "strengths": ["..."],
      "gaps": ["where they fall short for this use case"]
    }
  ],
  "summaryMarkdown": "Markdown comparison table or bullets: key patterns, whitespace opportunities, risks of parity"
}`;

  const { text, usage, model } = await chatCompletionText({
    system:
      "You are a competitive intelligence analyst. Ground claims in scraped content; note uncertainty when pages were thin.",
    user,
    maxTokens: 4500,
    jsonMode: true,
    model: premiumModel,
  });

  const parsed = parseDiscoveryJson<{
    analyses?: CompetitorApproachAnalysis[];
    summaryMarkdown?: string;
  }>(text, "competitor_approach_analysis");

  const analyses = (parsed.analyses ?? []).map((a) => ({
    competitorName: a.competitorName,
    competitorWebsite: a.competitorWebsite,
    howTheySolveIt: a.howTheySolveIt,
    strengths: a.strengths ?? [],
    gaps: a.gaps ?? [],
    sources: perCompetitorSources[a.competitorName] ?? [],
  }));

  return {
    analyses,
    summaryMarkdown: parsed.summaryMarkdown?.trim() ?? "",
    usage: { costUsd: usage.costUsd },
    model,
  };
}
