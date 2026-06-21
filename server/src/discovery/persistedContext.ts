import type { UnifiedContextItem, UnifiedRetrievalResult } from "../rag/unifiedRetriever";

/** Serializable RAG hits for pipeline stage output and UI. */
export interface PersistedContextItem {
  kind: "ticket" | "codebase";
  jiraKey?: string;
  filePath?: string;
  contentType?: string;
  content: string;
  similarity: number;
}

export interface DiscoveryQuestion {
  question: string;
  description: string;
  impact: string;
}

export interface DiscoveryPauseSnapshot {
  ticketAnalysis?: import("./ticketAnalyser").TicketAnalysis;
  historicalIntelligence?: import("./historicalIntelligence").HistoricalIntelligence;
  gapAnalysis?: import("./gapAnalyser").GapAnalysis;
  retrievalContext: PersistedContextItem[];
  discoveryQuestions?: DiscoveryQuestion[];
  pauseReason: "ambiguities" | "blocking_gaps" | "needs_clarification";
}

const MAX_CONTENT_CHARS = 6000;

export function buildPersistedRetrievalContext(
  unified: UnifiedRetrievalResult
): PersistedContextItem[] {
  return unified.items.map((item) => serializeContextItem(item));
}

function serializeContextItem(item: UnifiedContextItem): PersistedContextItem {
  return {
    kind: item.kind,
    jiraKey: item.jiraKey,
    filePath: item.filePath,
    contentType: item.contentType,
    content: item.content.slice(0, MAX_CONTENT_CHARS),
    similarity: item.similarity,
  };
}
