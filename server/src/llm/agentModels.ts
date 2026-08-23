export const AGENT_MODEL_IDS = ["chatgpt", "grok", "claude"] as const;
export type AgentModelId = (typeof AGENT_MODEL_IDS)[number];
export type AgentRole = "product" | "tech" | "qa";

export interface AgentModelDef {
  id: AgentModelId;
  label: string;
  vendor: string;
  modelId: string;
  creditsPerRun: number;
  blurb: string;
}

export interface ProviderModelOption {
  id: string;
  label: string;
  blurb: string;
}

export const PROVIDER_MODELS: Record<AgentModelId, ProviderModelOption[]> = {
  chatgpt: [
    { id: "gpt-5.6", label: "GPT-5.6", blurb: "Current flagship for hard reasoning and coding." },
    { id: "gpt-5.5", label: "GPT-5.5", blurb: "Strong all-rounder for product and implementation work." },
    { id: "gpt-5.1", label: "GPT-5.1", blurb: "Default for everyday product, coding, and QA work." },
    { id: "gpt-5", label: "GPT-5", blurb: "Previous GPT-5 generation." },
    { id: "gpt-4.1", label: "GPT-4.1", blurb: "Reliable GPT-4-class model." },
    { id: "o3", label: "o3", blurb: "Deep reasoning for difficult analysis." },
    { id: "o4-mini", label: "o4-mini", blurb: "Faster reasoning at lower cost." },
  ],
  grok: [
    { id: "grok-4.6", label: "Grok 4.6", blurb: "Latest Grok for coding and agentic work." },
    { id: "grok-4.5", label: "Grok 4.5", blurb: "Frontier Grok for knowledge and implementation." },
    { id: "grok-4", label: "Grok 4", blurb: "Previous Grok 4 generation." },
    { id: "grok-3", label: "Grok 3", blurb: "Fast reasoning and code at a mid credit cost." },
    { id: "grok-3-mini", label: "Grok 3 Mini", blurb: "Lighter Grok for quicker turns." },
  ],
  claude: [
    { id: "claude-opus-5", label: "Opus 5", blurb: "Highest-capability Claude for complex agent work." },
    { id: "claude-sonnet-5", label: "Sonnet 5", blurb: "Best speed and quality mix for production." },
    { id: "claude-opus-4-8", label: "Opus 4.8", blurb: "Prior Opus for careful coding and specs." },
    { id: "claude-sonnet-4-6", label: "Sonnet 4.6", blurb: "Previous Sonnet generation." },
    { id: "claude-sonnet-4-5", label: "Sonnet 4.5", blurb: "Default Claude for product specs and implementations." },
    { id: "claude-haiku-4-5", label: "Haiku 4.5", blurb: "Fast, economical Claude for lighter tasks." },
  ],
};

export const AGENT_MODELS: Record<AgentModelId, AgentModelDef> = {
  chatgpt: {
    id: "chatgpt",
    label: "ChatGPT",
    vendor: "OpenAI",
    modelId: process.env.OPENAI_CHAT_MODEL?.trim() || "gpt-5.1",
    creditsPerRun: 1,
    blurb: "OpenAI models provided by AgentOX.",
  },
  grok: {
    id: "grok",
    label: "Grok",
    vendor: "xAI",
    modelId: process.env.XAI_MODEL?.trim() || "grok-3",
    creditsPerRun: 2,
    blurb: "xAI models provided by AgentOX.",
  },
  claude: {
    id: "claude",
    label: "Claude",
    vendor: "Anthropic",
    modelId: process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-4-5",
    creditsPerRun: 3,
    blurb: "Anthropic models provided by AgentOX.",
  },
};

export const DEFAULT_AGENT_MODEL_ID: AgentModelId = "chatgpt";

export function isAgentModelId(value: unknown): value is AgentModelId {
  return typeof value === "string" && (AGENT_MODEL_IDS as readonly string[]).includes(value);
}

export function getAgentModel(id: unknown): AgentModelDef {
  if (isAgentModelId(id)) return AGENT_MODELS[id];
  return AGENT_MODELS[DEFAULT_AGENT_MODEL_ID];
}

export function creditsForModel(id: unknown): number {
  return getAgentModel(id).creditsPerRun;
}

export function isProviderModelId(providerId: AgentModelId, modelName: unknown): boolean {
  return (
    typeof modelName === "string" &&
    PROVIDER_MODELS[providerId].some((item) => item.id === modelName)
  );
}

export function defaultApiModel(providerId: AgentModelId): string {
  const configured = AGENT_MODELS[providerId].modelId;
  if (isProviderModelId(providerId, configured)) return configured;
  return PROVIDER_MODELS[providerId][0]?.id ?? configured;
}

export function resolveApiModel(providerId: unknown, modelName?: string | null): string {
  const provider = isAgentModelId(providerId) ? providerId : DEFAULT_AGENT_MODEL_ID;
  if (isProviderModelId(provider, modelName)) return modelName as string;
  return defaultApiModel(provider);
}
