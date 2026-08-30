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

export type HumanDiscoveryAnswer = {
  question: string;
  answer: string;
  status?: "answered" | "approved" | "dismissed";
};

export function formatHumanAnswersJson(
  answers: HumanDiscoveryAnswer[] | undefined | null
): string {
  if (!answers?.length) return "";
  return JSON.stringify({ humanAnswers: answers }, null, 2);
}

export function humanAnswersPromptBlock(
  answers: HumanDiscoveryAnswer[] | undefined | null
): string {
  const json = formatHumanAnswersJson(answers);
  if (!json) return "";
  return `\n\nHUMAN_ANSWERS_JSON (source of truth for the questions already asked — use these answers in analysis):\n${json}\n`;
}

function normalizeQuestion(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

/** True only when every discovery question has a non-empty answer. */
export function answersCoverAllQuestions(
  questions: Array<string | Pick<DiscoveryQuestion, "question">> | undefined,
  answers: HumanDiscoveryAnswer[] | undefined | null
): boolean {
  const required = (questions ?? [])
    .map((item) => (typeof item === "string" ? item : item.question))
    .map((item) => item.trim())
    .filter(Boolean);
  if (!required.length) return true;
  const byQuestion = new Map(
    (answers ?? [])
      .filter((item) => item.status !== "dismissed" && Boolean(item.answer?.trim()))
      .map((item) => [normalizeQuestion(item.question), item.answer.trim()])
  );
  return required.every((question) => {
    const key = normalizeQuestion(question);
    if (byQuestion.has(key)) return true;
    for (const [answered] of byQuestion) {
      if (answered.includes(key) || key.includes(answered)) return true;
    }
    return false;
  });
}

export interface DiscoveryPauseSnapshot {
  ticketAnalysis?: import("./ticketAnalyser").TicketAnalysis;
  historicalIntelligence?: import("./historicalIntelligence").HistoricalIntelligence;
  gapAnalysis?: import("./gapAnalyser").GapAnalysis;
  retrievalContext: PersistedContextItem[];
  discoveryQuestions?: DiscoveryQuestion[];
  pauseReason: "ambiguities" | "blocking_gaps" | "needs_clarification";
  usageSoFar?: import("../llm/discoveryCompletion").LlmUsage;
}

const MAX_CONTENT_CHARS = 6000;

export function buildPersistedRetrievalContext(
  unified: UnifiedRetrievalResult
): PersistedContextItem[] {
  return (unified.items ?? []).map((item) => serializeContextItem(item));
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
