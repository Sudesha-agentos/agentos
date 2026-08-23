import { getDb } from "../jira-intake/sqliteStore";
import { isAgentModelId, resolveApiModel, type AgentModelId } from "../llm/agentModels";
import { logger } from "../utils/logger";

export interface ClaudeCustomSkill {
  id: string;
  name: string;
  description: string;
  body: string;
}

export interface PipelineSettings {
  systemDesignComplexityThreshold: number;
  prdConfidenceThreshold: number;
  implementationConfidenceThreshold: number;
  qaCoverageThreshold: number;
  productModel: AgentModelId;
  techModel: AgentModelId;
  qaModel: AgentModelId;
  productModelName: string;
  techModelName: string;
  qaModelName: string;
  claudeSkills: ClaudeCustomSkill[];
  productSkillIds: string[];
  techSkillIds: string[];
  qaSkillIds: string[];
}

const DEFAULTS: PipelineSettings = {
  systemDesignComplexityThreshold: 5,
  prdConfidenceThreshold: 0.7,
  implementationConfidenceThreshold: 0.7,
  qaCoverageThreshold: 95,
  productModel: "chatgpt",
  techModel: "chatgpt",
  qaModel: "chatgpt",
  productModelName: "gpt-5.1",
  techModelName: "gpt-5.1",
  qaModelName: "gpt-5.1",
  claudeSkills: [],
  productSkillIds: [],
  techSkillIds: [],
  qaSkillIds: [],
};

const SKILL_ID_RE = /^[a-zA-Z0-9._-]{1,80}$/;
const BUILTIN_SKILL_IDS = new Set(["pptx", "xlsx", "docx", "pdf"]);
const MAX_CUSTOM_SKILLS = 50;
const MAX_ATTACHED_SKILLS = 40;
const MAX_SKILL_NAME = 120;
const MAX_SKILL_DESCRIPTION = 500;
const MAX_SKILL_BODY = 32_000;

function parseModel(value: unknown, fallback: AgentModelId): AgentModelId {
  return isAgentModelId(value) ? value : fallback;
}

function parseSkillId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const id = value.trim();
  if (!SKILL_ID_RE.test(id)) return null;
  return id;
}

function parseClaudeSkills(value: unknown): ClaudeCustomSkill[] {
  if (!Array.isArray(value)) return [];
  const out: ClaudeCustomSkill[] = [];
  const seen = new Set<string>();
  for (const raw of value) {
    if (out.length >= MAX_CUSTOM_SKILLS) break;
    if (!raw || typeof raw !== "object") continue;
    const rec = raw as Record<string, unknown>;
    const id = parseSkillId(rec.id);
    if (!id || BUILTIN_SKILL_IDS.has(id) || seen.has(id)) continue;
    const name = typeof rec.name === "string" ? rec.name.trim().slice(0, MAX_SKILL_NAME) : "";
    const description =
      typeof rec.description === "string"
        ? rec.description.trim().slice(0, MAX_SKILL_DESCRIPTION)
        : "";
    const body = typeof rec.body === "string" ? rec.body.slice(0, MAX_SKILL_BODY) : "";
    if (!name) continue;
    seen.add(id);
    out.push({ id, name, description, body });
  }
  return out;
}

function parseSkillIds(value: unknown, customIds: Set<string>): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of value) {
    if (out.length >= MAX_ATTACHED_SKILLS) break;
    const id = parseSkillId(raw);
    if (!id || seen.has(id)) continue;
    if (!BUILTIN_SKILL_IDS.has(id) && !customIds.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function normalizeSettings(raw: Partial<PipelineSettings> | null | undefined): PipelineSettings {
  const normalized: PipelineSettings = {
    systemDesignComplexityThreshold: clampNumber(
      raw?.systemDesignComplexityThreshold,
      1,
      10,
      DEFAULTS.systemDesignComplexityThreshold
    ),
    prdConfidenceThreshold: clampNumber(
      raw?.prdConfidenceThreshold,
      0,
      1,
      DEFAULTS.prdConfidenceThreshold
    ),
    implementationConfidenceThreshold: clampNumber(
      raw?.implementationConfidenceThreshold,
      0,
      1,
      DEFAULTS.implementationConfidenceThreshold
    ),
    qaCoverageThreshold: clampNumber(
      raw?.qaCoverageThreshold,
      0,
      100,
      DEFAULTS.qaCoverageThreshold
    ),
    productModel: parseModel(raw?.productModel, DEFAULTS.productModel),
    techModel: parseModel(raw?.techModel, DEFAULTS.techModel),
    qaModel: parseModel(raw?.qaModel, DEFAULTS.qaModel),
    productModelName: "",
    techModelName: "",
    qaModelName: "",
    claudeSkills: parseClaudeSkills(raw?.claudeSkills),
    productSkillIds: [],
    techSkillIds: [],
    qaSkillIds: [],
  };
  const customIds = new Set(normalized.claudeSkills.map((skill) => skill.id));
  normalized.productModelName = resolveApiModel(normalized.productModel, raw?.productModelName);
  normalized.techModelName = resolveApiModel(normalized.techModel, raw?.techModelName);
  normalized.qaModelName = resolveApiModel(normalized.qaModel, raw?.qaModelName);
  normalized.productSkillIds = parseSkillIds(raw?.productSkillIds, customIds);
  normalized.techSkillIds = parseSkillIds(raw?.techSkillIds, customIds);
  normalized.qaSkillIds = parseSkillIds(raw?.qaSkillIds, customIds);
  return normalized;
}

let settings: PipelineSettings = { ...DEFAULTS };

function persistSettings(next: PipelineSettings): void {
  try {
    getDb()
      .prepare(
        `INSERT INTO pipeline_runtime_settings (singleton_id, settings_json, updated_at)
         VALUES (1, @settings_json, @updated_at)
         ON CONFLICT(singleton_id) DO UPDATE SET
           settings_json = excluded.settings_json,
           updated_at = excluded.updated_at`
      )
      .run({
        settings_json: JSON.stringify(next),
        updated_at: new Date().toISOString(),
      });
  } catch (err) {
    logger.warn({ err }, "Failed to persist pipeline settings");
  }
}

export function loadPipelineSettingsFromStore(): PipelineSettings {
  try {
    const row = getDb()
      .prepare(
        `SELECT settings_json FROM pipeline_runtime_settings WHERE singleton_id = 1`
      )
      .get() as { settings_json?: string } | undefined;
    if (row?.settings_json) {
      settings = normalizeSettings(JSON.parse(row.settings_json) as Partial<PipelineSettings>);
    }
  } catch (err) {
    logger.warn({ err }, "Failed to load pipeline settings; using in-memory values");
  }
  return settings;
}

export function getPipelineSettings(): PipelineSettings {
  return settings;
}

export function savePipelineSettings(patch: Partial<PipelineSettings>): PipelineSettings {
  settings = {
    systemDesignComplexityThreshold:
      patch.systemDesignComplexityThreshold !== undefined
        ? clampNumber(
            patch.systemDesignComplexityThreshold,
            1,
            10,
            settings.systemDesignComplexityThreshold
          )
        : settings.systemDesignComplexityThreshold,
    prdConfidenceThreshold:
      patch.prdConfidenceThreshold !== undefined
        ? clampNumber(patch.prdConfidenceThreshold, 0, 1, settings.prdConfidenceThreshold)
        : settings.prdConfidenceThreshold,
    implementationConfidenceThreshold:
      patch.implementationConfidenceThreshold !== undefined
        ? clampNumber(
            patch.implementationConfidenceThreshold,
            0,
            1,
            settings.implementationConfidenceThreshold
          )
        : settings.implementationConfidenceThreshold,
    qaCoverageThreshold:
      patch.qaCoverageThreshold !== undefined
        ? clampNumber(patch.qaCoverageThreshold, 0, 100, settings.qaCoverageThreshold)
        : settings.qaCoverageThreshold,
    productModel: parseModel(patch.productModel, settings.productModel),
    techModel: parseModel(patch.techModel, settings.techModel),
    qaModel: parseModel(patch.qaModel, settings.qaModel),
    productModelName: settings.productModelName,
    techModelName: settings.techModelName,
    qaModelName: settings.qaModelName,
    claudeSkills:
      patch.claudeSkills !== undefined
        ? parseClaudeSkills(patch.claudeSkills)
        : settings.claudeSkills,
    productSkillIds: settings.productSkillIds,
    techSkillIds: settings.techSkillIds,
    qaSkillIds: settings.qaSkillIds,
  };
  const customIds = new Set(settings.claudeSkills.map((skill) => skill.id));
  settings.productModelName = resolveApiModel(
    settings.productModel,
    patch.productModelName !== undefined ? patch.productModelName : settings.productModelName
  );
  settings.techModelName = resolveApiModel(
    settings.techModel,
    patch.techModelName !== undefined ? patch.techModelName : settings.techModelName
  );
  settings.qaModelName = resolveApiModel(
    settings.qaModel,
    patch.qaModelName !== undefined ? patch.qaModelName : settings.qaModelName
  );
  settings.productSkillIds = parseSkillIds(
    patch.productSkillIds !== undefined ? patch.productSkillIds : settings.productSkillIds,
    customIds
  );
  settings.techSkillIds = parseSkillIds(
    patch.techSkillIds !== undefined ? patch.techSkillIds : settings.techSkillIds,
    customIds
  );
  settings.qaSkillIds = parseSkillIds(
    patch.qaSkillIds !== undefined ? patch.qaSkillIds : settings.qaSkillIds,
    customIds
  );
  persistSettings(settings);
  return settings;
}

export function getPublicPipelineSettings(): PipelineSettings {
  return getPipelineSettings();
}
