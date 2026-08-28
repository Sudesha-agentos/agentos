/** Workspace model choices for Virin (product), Ananta (tech), and Neel (QA). */

export const AGENT_MODEL_IDS = ["chatgpt", "grok", "claude"];

export const PROVIDER_MODELS = {
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

export const AGENT_MODELS = {
  chatgpt: {
    id: "chatgpt",
    label: "ChatGPT",
    vendor: "OpenAI",
    modelId: "gpt-5.1",
    creditsPerRun: 1,
    blurb: "OpenAI models provided by AgentOX.",
  },
  grok: {
    id: "grok",
    label: "Grok",
    vendor: "xAI",
    modelId: "grok-3",
    creditsPerRun: 2,
    blurb: "xAI models provided by AgentOX.",
  },
  claude: {
    id: "claude",
    label: "Claude",
    vendor: "Anthropic",
    modelId: "claude-sonnet-4-5",
    creditsPerRun: 3,
    blurb: "Anthropic models provided by AgentOX.",
  },
};

export const AGENT_MODEL_ROLES = [
  {
    id: "product",
    label: "Product",
    agent: "Virin",
    settingKey: "productModel",
    modelNameKey: "productModelName",
    skillIdsKey: "productSkillIds",
    description: "PRDs, discovery, and Virin product analysis.",
  },
  {
    id: "tech",
    label: "Tech",
    agent: "Ananta",
    settingKey: "techModel",
    modelNameKey: "techModelName",
    skillIdsKey: "techSkillIds",
    description: "Implementation, coding, and engineering agent work.",
  },
  {
    id: "qa",
    label: "QA",
    agent: "Neel",
    settingKey: "qaModel",
    modelNameKey: "qaModelName",
    skillIdsKey: "qaSkillIds",
    description: "Test plans, coverage, and QA agent runs.",
  },
];

export const DEFAULT_AGENT_MODEL_ID = "chatgpt";

export function isAgentModelId(value) {
  return AGENT_MODEL_IDS.includes(value);
}

export function getProviderModels(providerId) {
  const id = isAgentModelId(providerId) ? providerId : DEFAULT_AGENT_MODEL_ID;
  return PROVIDER_MODELS[id];
}

export function defaultModelNameForProvider(providerId) {
  return getAgentModel(providerId).modelId;
}

export function isProviderModelId(providerId, modelName) {
  return getProviderModels(providerId).some((item) => item.id === modelName);
}

export function resolveProviderModelName(providerId, modelName) {
  if (isProviderModelId(providerId, modelName)) return modelName;
  return defaultModelNameForProvider(providerId);
}

export function getProviderModelOption(providerId, modelName) {
  const resolved = resolveProviderModelName(providerId, modelName);
  return getProviderModels(providerId).find((item) => item.id === resolved);
}

export function getAgentModel(id) {
  if (isAgentModelId(id)) return AGENT_MODELS[id];
  return AGENT_MODELS[DEFAULT_AGENT_MODEL_ID];
}

export function creditsForModel(id) {
  return getAgentModel(id).creditsPerRun;
}

export function getAgentModelForRole(settings, roleId) {
  const role = AGENT_MODEL_ROLES.find((item) => item.id === roleId);
  if (!role) return getAgentModel(DEFAULT_AGENT_MODEL_ID);
  const provider = getAgentModel(settings?.[role.settingKey]);
  const option = getProviderModelOption(provider.id, settings?.[role.modelNameKey]);
  const modelLabel = option?.label ?? provider.modelId;
  return {
    ...provider,
    modelId: option?.id ?? provider.modelId,
    modelLabel,
    label: `${provider.label} · ${modelLabel}`,
  };
}

export const AGENT_DOMAIN_ROLES = {
  virin: "product",
  ananta: "tech",
  neel: "qa",
};

export function getAgentModelRoleForDomain(domain) {
  const roleId = AGENT_DOMAIN_ROLES[domain] ?? "product";
  return AGENT_MODEL_ROLES.find((item) => item.id === roleId) ?? AGENT_MODEL_ROLES[0];
}

export function getAgentModelForSurface(settings, surface) {
  const role = AGENT_MODEL_ROLES.find((item) => item.agent === surface);
  if (!role) return null;
  return getAgentModelForRole(settings, role.id);
}
