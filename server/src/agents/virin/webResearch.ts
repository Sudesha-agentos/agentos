/**
 * Lightweight web research for Virin (no paid Search API required).
 * Uses DuckDuckGo Instant Answer + optional Jina Reader page fetch.
 * Kill: VIRIN_WEB_RESEARCH=0
 */

import { logger } from "../../utils/logger";

export type WebSearchHit = {
  title: string;
  url: string;
  snippet: string;
};

export type WebResearchBundle = {
  query: string;
  hits: WebSearchHit[];
  browsed?: { url: string; excerpt: string } | null;
  error?: string;
};

const TIMEOUT_MS = 12_000;

function webResearchEnabled(): boolean {
  const v = process.env.VIRIN_WEB_RESEARCH?.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "off") return false;
  return true;
}

async function fetchText(url: string, timeoutMs = TIMEOUT_MS): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "AgentOX-Virin/1.0", Accept: "text/plain, application/json, */*" },
    });
    if (!res.ok) return null;
    return (await res.text()).trim();
  } catch (err) {
    logger.debug({ err, url }, "virin web fetch failed");
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** DuckDuckGo Instant Answer — free, no key; sparse for some queries. */
async function duckDuckGoSearch(query: string): Promise<WebSearchHit[]> {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
  const raw = await fetchText(url);
  if (!raw) return [];
  try {
    const data = JSON.parse(raw) as {
      AbstractText?: string;
      AbstractURL?: string;
      Heading?: string;
      RelatedTopics?: Array<{ Text?: string; FirstURL?: string; Topics?: Array<{ Text?: string; FirstURL?: string }> }>;
      Results?: Array<{ Text?: string; FirstURL?: string }>;
    };
    const hits: WebSearchHit[] = [];
    if (data.AbstractText && data.AbstractURL) {
      hits.push({
        title: data.Heading || "Summary",
        url: data.AbstractURL,
        snippet: data.AbstractText.slice(0, 400),
      });
    }
    for (const r of data.Results ?? []) {
      if (r.Text && r.FirstURL) {
        hits.push({ title: r.Text.slice(0, 80), url: r.FirstURL, snippet: r.Text.slice(0, 300) });
      }
    }
    const flatten = (
      topics: Array<{ Text?: string; FirstURL?: string; Topics?: Array<{ Text?: string; FirstURL?: string }> }>
    ) => {
      for (const t of topics) {
        if (t.Text && t.FirstURL) {
          hits.push({ title: t.Text.slice(0, 80), url: t.FirstURL, snippet: t.Text.slice(0, 300) });
        }
        if (t.Topics) flatten(t.Topics);
      }
    };
    flatten(data.RelatedTopics ?? []);
    return hits.slice(0, 6);
  } catch {
    return [];
  }
}

/** Jina Reader — markdown excerpt of a URL (best-effort). */
export async function browseUrlForVirin(pageUrl: string): Promise<{ url: string; excerpt: string } | null> {
  if (!webResearchEnabled()) return null;
  if (!/^https?:\/\//i.test(pageUrl)) return null;
  const text = await fetchText(`https://r.jina.ai/${pageUrl}`, 22_000);
  if (!text || text.length < 80) return null;
  return { url: pageUrl, excerpt: text.slice(0, 4000) };
}

export async function webSearchForVirin(
  query: string,
  options?: { browseTopUrl?: boolean }
): Promise<WebResearchBundle> {
  const q = query.trim().slice(0, 240);
  if (!q) return { query: "", hits: [], error: "empty_query" };
  if (!webResearchEnabled()) {
    return { query: q, hits: [], error: "VIRIN_WEB_RESEARCH=0" };
  }

  try {
    const hits = await duckDuckGoSearch(q);
    let browsed: WebResearchBundle["browsed"] = null;
    if (options?.browseTopUrl && hits[0]?.url) {
      browsed = await browseUrlForVirin(hits[0].url);
    }
    return { query: q, hits, browsed };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn({ err, query: q }, "virin web search failed");
    return { query: q, hits: [], error: message };
  }
}

export function formatWebResearchForPrompt(bundle: WebResearchBundle | null | undefined): string {
  if (!bundle) return "Web research: not run.";
  if (bundle.error && !bundle.hits.length) {
    return `Web research unavailable (${bundle.error}). Do not invent external facts — ask the human if needed.`;
  }
  const lines = [`Web research query: ${bundle.query}`];
  if (!bundle.hits.length) {
    lines.push("No Instant Answer hits — treat external standards as needing human confirmation.");
  }
  for (const h of bundle.hits.slice(0, 5)) {
    lines.push(`- ${h.title}: ${h.snippet} (${h.url})`);
  }
  if (bundle.browsed?.excerpt) {
    lines.push(`Top page excerpt (${bundle.browsed.url}):\n${bundle.browsed.excerpt.slice(0, 2000)}`);
  }
  return lines.join("\n");
}
