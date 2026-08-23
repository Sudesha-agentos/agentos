import { creditsForModel, resolveApiModel, type AgentRole } from "../llm/agentModels";
import { getPipelineSettings } from "../pipeline/settingsStore";
import { workspaceBillingStore } from "./workspaceBillingStore";

export function getModelIdForRole(role: AgentRole) {
  const settings = getPipelineSettings();
  if (role === "tech") return settings.techModel;
  if (role === "qa") return settings.qaModel;
  return settings.productModel;
}

export function getApiModelForRole(role: AgentRole): string {
  const settings = getPipelineSettings();
  const provider = getModelIdForRole(role);
  const name =
    role === "tech"
      ? settings.techModelName
      : role === "qa"
        ? settings.qaModelName
        : settings.productModelName;
  return resolveApiModel(provider, name);
}

export async function consumeAgentCredits(role: AgentRole): Promise<number> {
  const modelId = getModelIdForRole(role);
  const credits = creditsForModel(modelId);
  await workspaceBillingStore.incrementRunsUsed(credits);
  return credits;
}
