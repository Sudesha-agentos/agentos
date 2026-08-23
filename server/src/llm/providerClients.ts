import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { getOpenAIClient } from "./openaiClient";

let grokClient: OpenAI | undefined;
let anthropicClient: Anthropic | undefined;

export function isGrokConfigured(): boolean {
  return Boolean(process.env.XAI_API_KEY?.trim());
}

export function isAnthropicConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

export function getGrokClient(): OpenAI {
  if (grokClient) return grokClient;
  const apiKey = process.env.XAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Grok is not configured on this AgentOX instance yet. Switch this process to ChatGPT, or ask your admin to enable Grok.");
  }
  grokClient = new OpenAI({
    apiKey,
    baseURL: process.env.XAI_BASE_URL?.trim() || "https://api.x.ai/v1",
    timeout: 120_000,
    maxRetries: 0,
  });
  return grokClient;
}

export function getAnthropicClient(): Anthropic {
  if (anthropicClient) return anthropicClient;
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "Claude is not configured on this AgentOX instance yet. Switch this process to ChatGPT, or ask your admin to enable Claude."
    );
  }
  anthropicClient = new Anthropic({ apiKey, timeout: 120_000, maxRetries: 0 });
  return anthropicClient;
}

export function getOpenAICompatibleClient(providerId: "chatgpt" | "grok"): OpenAI {
  if (providerId === "grok") return getGrokClient();
  return getOpenAIClient();
}
