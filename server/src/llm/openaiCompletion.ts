import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { AgentParseError } from "../utils/errors";
import { logger } from "../utils/logger";
import { withRetry } from "../utils/retry";
import { getOpenAIChatModel } from "./openaiClient";
import { createProviderChatCompletion } from "./providerChat";
import { DEFAULT_AGENT_MODEL_ID, type AgentModelId, type AgentRole } from "./agentModels";
import { recoverJsonText } from "./parseJson";

// GPT-5.1 pricing placeholder — update when billing constants are finalized.
const INPUT_COST_PER_TOKEN = 0.00000125;
const OUTPUT_COST_PER_TOKEN = 0.00001;

export interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export function parseDiscoveryJson<T>(raw: string, source: string): T {
  const payload = recoverJsonText(raw);
  try {
    return JSON.parse(payload) as T;
  } catch {
    logger.error({ source, rawPreview: raw.slice(0, 300) }, "discovery JSON parse failed");
    throw new AgentParseError(source, raw);
  }
}

export async function chatCompletionText(params: {
  system: string;
  user: string;
  maxTokens?: number;
  jsonMode?: boolean;
  model?: string;
  providerId?: AgentModelId;
  role?: AgentRole;
}): Promise<{ text: string; usage: LlmUsage; model: string; finishReason?: string }> {
  const providerId = params.providerId ?? DEFAULT_AGENT_MODEL_ID;
  const response = await withRetry(
    () =>
      createProviderChatCompletion({
        providerId,
        role: params.role,
        maxTokens: params.maxTokens ?? 4000,
        jsonMode: params.jsonMode ?? false,
        messages: [
          { role: "system", content: params.system },
          { role: "user", content: params.user },
        ],
      }),
    { maxAttempts: 3, baseDelayMs: 2000, maxDelayMs: 30000 }
  );

  const text = response.choices[0]?.message?.content?.trim() ?? "";
  if (!text) {
    throw new Error("Chat completion returned empty content");
  }

  const inputTokens = response.usage?.prompt_tokens ?? 0;
  const outputTokens = response.usage?.completion_tokens ?? 0;
  const model = params.model ?? response.model ?? getOpenAIChatModel();

  return {
    text,
    model,
    finishReason: response.choices[0]?.finish_reason ?? undefined,
    usage: {
      inputTokens,
      outputTokens,
      costUsd:
        inputTokens * INPUT_COST_PER_TOKEN + outputTokens * OUTPUT_COST_PER_TOKEN,
    },
  };
}

export async function completionJson<T>(params: {
  source: string;
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  providerId?: AgentModelId;
  role?: AgentRole;
}): Promise<{ parsed: T; usage: LlmUsage; raw: string }> {
  const { text, usage } = await chatCompletionText({
    system: params.systemPrompt,
    user: params.userPrompt,
    maxTokens: params.maxTokens,
    jsonMode: true,
    providerId: params.providerId,
    role: params.role,
  });

  const parsed = parseDiscoveryJson<T>(text, params.source);
  return { parsed, raw: text, usage };
}

export function mergeUsage(usages: LlmUsage[]): LlmUsage {
  return usages.reduce(
    (acc, u) => ({
      inputTokens: acc.inputTokens + u.inputTokens,
      outputTokens: acc.outputTokens + u.outputTokens,
      costUsd: acc.costUsd + u.costUsd,
    }),
    { inputTokens: 0, outputTokens: 0, costUsd: 0 }
  );
}

export type AgenticMessage = ChatCompletionMessageParam;
