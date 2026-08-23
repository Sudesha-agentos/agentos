import { SettingsSchema } from "../../contracts";
import { DATA_MODE, DATA_MODES } from "../../shared/config/app";
import { isAgentModelId } from "../../shared/config/agentModels";
import { apiPath } from "../../shared/config/apiBase";
import { fetchJson } from "../../shared/lib/fetchJson";
import { useResource } from "../../shared/lib/useResource";

const STORAGE_KEY = "agentos.settings";

export const DEFAULT_SETTINGS = SettingsSchema.parse({
  jiraBaseUrl: "",
  jiraEmail: "",
  jiraApiToken: "",
  webhookSecret: "",
  model: "gpt-5.1",
  prdConfidenceThreshold: 0.7,
  implementationConfidenceThreshold: 0.7,
  qaCoverageThreshold: 95,
  systemDesignComplexityThreshold: 5,
  canaryStagingBaseUrl: "",
  canaryProductionBaseUrl: "",
  canaryAuthToken: "",
  productModel: "chatgpt",
  techModel: "chatgpt",
  qaModel: "chatgpt",
});

function readLocalSettings() {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return DEFAULT_SETTINGS;
  try {
    return SettingsSchema.parse({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) });
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function writeLocalSettings(settings) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }
}

async function fetchServerCanarySettings() {
  if (DATA_MODE !== DATA_MODES.REST) return null;
  try {
    const data = await fetchJson(apiPath("/api/settings"));
    return data?.canary ?? null;
  } catch {
    return null;
  }
}

async function saveServerSettings(settings) {
  if (DATA_MODE !== DATA_MODES.REST) return null;
  const body = {
    canaryStagingBaseUrl: settings.canaryStagingBaseUrl,
    canaryProductionBaseUrl: settings.canaryProductionBaseUrl,
  };
  if (settings.canaryAuthToken?.trim()) {
    body.canaryAuthToken = settings.canaryAuthToken;
  }
  await fetchJson(apiPath("/api/settings"), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (settings.systemDesignComplexityThreshold !== undefined) {
    await fetchJson(apiPath("/api/settings/pipeline"), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemDesignComplexityThreshold: settings.systemDesignComplexityThreshold,
        prdConfidenceThreshold: settings.prdConfidenceThreshold,
        implementationConfidenceThreshold: settings.implementationConfidenceThreshold,
        qaCoverageThreshold: settings.qaCoverageThreshold,
        productModel: settings.productModel,
        techModel: settings.techModel,
        qaModel: settings.qaModel,
        productModelName: settings.productModelName,
        techModelName: settings.techModelName,
        qaModelName: settings.qaModelName,
        claudeSkills: settings.claudeSkills ?? [],
        productSkillIds: settings.productSkillIds ?? [],
        techSkillIds: settings.techSkillIds ?? [],
        qaSkillIds: settings.qaSkillIds ?? [],
      }),
    });
  }
  return null;
}

const settingsAdapter = {
  async get() {
    const local = readLocalSettings();
    const serverCanary = await fetchServerCanarySettings();
    if (!serverCanary) return local;

    let pipelineThreshold = local.systemDesignComplexityThreshold;
    let serverPipeline = null;
    try {
      const serverSettings = await fetchJson(apiPath("/api/settings"));
      if (serverSettings?.pipeline?.systemDesignComplexityThreshold != null) {
        pipelineThreshold = serverSettings.pipeline.systemDesignComplexityThreshold;
      }
      serverPipeline = serverSettings?.pipeline ?? null;
    } catch {
      /* optional */
    }

    return SettingsSchema.parse({
      ...local,
      canaryStagingBaseUrl: serverCanary.stagingBaseUrl ?? local.canaryStagingBaseUrl,
      canaryProductionBaseUrl:
        serverCanary.productionBaseUrl ?? local.canaryProductionBaseUrl,
      canaryAuthToken: local.canaryAuthToken,
      systemDesignComplexityThreshold: pipelineThreshold,
      prdConfidenceThreshold:
        serverPipeline?.prdConfidenceThreshold ?? local.prdConfidenceThreshold,
      implementationConfidenceThreshold:
        serverPipeline?.implementationConfidenceThreshold ??
        local.implementationConfidenceThreshold,
      qaCoverageThreshold:
        serverPipeline?.qaCoverageThreshold ?? local.qaCoverageThreshold,
      productModel: isAgentModelId(serverPipeline?.productModel)
        ? serverPipeline.productModel
        : local.productModel,
      techModel: isAgentModelId(serverPipeline?.techModel)
        ? serverPipeline.techModel
        : local.techModel,
      qaModel: isAgentModelId(serverPipeline?.qaModel)
        ? serverPipeline.qaModel
        : local.qaModel,
      productModelName:
        typeof serverPipeline?.productModelName === "string"
          ? serverPipeline.productModelName
          : local.productModelName,
      techModelName:
        typeof serverPipeline?.techModelName === "string"
          ? serverPipeline.techModelName
          : local.techModelName,
      qaModelName:
        typeof serverPipeline?.qaModelName === "string"
          ? serverPipeline.qaModelName
          : local.qaModelName,
      claudeSkills: Array.isArray(serverPipeline?.claudeSkills)
        ? serverPipeline.claudeSkills
        : local.claudeSkills,
      productSkillIds: Array.isArray(serverPipeline?.productSkillIds)
        ? serverPipeline.productSkillIds
        : local.productSkillIds,
      techSkillIds: Array.isArray(serverPipeline?.techSkillIds)
        ? serverPipeline.techSkillIds
        : local.techSkillIds,
      qaSkillIds: Array.isArray(serverPipeline?.qaSkillIds)
        ? serverPipeline.qaSkillIds
        : local.qaSkillIds,
    });
  },
  async save(settings) {
    const parsed = SettingsSchema.parse(settings);
    writeLocalSettings(parsed);
    await saveServerSettings(parsed);
    return parsed;
  },
};

export { settingsAdapter };

export function useSettings() {
  return useResource(() => settingsAdapter.get(), [], {});
}
