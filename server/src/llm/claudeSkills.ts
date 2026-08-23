import type { AgentRole } from "./agentModels";
import { getPipelineSettings, type ClaudeCustomSkill } from "../pipeline/settingsStore";

export const ANTHROPIC_BUILTIN_SKILL_IDS = ["pptx", "xlsx", "docx", "pdf"] as const;
export type AnthropicBuiltinSkillId = (typeof ANTHROPIC_BUILTIN_SKILL_IDS)[number];

export function isAnthropicBuiltinSkillId(value: unknown): value is AnthropicBuiltinSkillId {
  return typeof value === "string" && (ANTHROPIC_BUILTIN_SKILL_IDS as readonly string[]).includes(value);
}

function skillIdsForRole(role: AgentRole): string[] {
  const settings = getPipelineSettings();
  if (role === "tech") return settings.techSkillIds;
  if (role === "qa") return settings.qaSkillIds;
  return settings.productSkillIds;
}

function modelForRole(role: AgentRole) {
  const settings = getPipelineSettings();
  if (role === "tech") return settings.techModel;
  if (role === "qa") return settings.qaModel;
  return settings.productModel;
}

export function getSkillsForRole(role: AgentRole): {
  custom: ClaudeCustomSkill[];
  builtin: AnthropicBuiltinSkillId[];
} {
  const settings = getPipelineSettings();
  const ids = skillIdsForRole(role);
  const customById = new Map(settings.claudeSkills.map((skill) => [skill.id, skill]));
  const custom: ClaudeCustomSkill[] = [];
  const builtin: AnthropicBuiltinSkillId[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    if (isAnthropicBuiltinSkillId(id)) {
      builtin.push(id);
      continue;
    }
    const skill = customById.get(id);
    if (skill) custom.push(skill);
  }
  return {
    custom,
    builtin: modelForRole(role) === "claude" ? builtin : [],
  };
}

export function formatCustomSkillsPrompt(skills: ClaudeCustomSkill[]): string {
  if (skills.length === 0) return "";
  const blocks = skills.map((skill) => {
    const body = skill.body.trim();
    return [`## ${skill.name}`, skill.description.trim(), body].filter(Boolean).join("\n\n");
  });
  return [
    "# Attached skills",
    "Follow these attached skills when they apply to the current task. Ignore any that are not relevant.",
    ...blocks,
  ].join("\n\n");
}

export function applyClaudeSkillsToPrompt(systemPrompt: string, role: AgentRole): string {
  const { custom } = getSkillsForRole(role);
  const block = formatCustomSkillsPrompt(custom);
  if (!block) return systemPrompt;
  return `${systemPrompt.trim()}\n\n${block}`;
}

export const ANTHROPIC_SKILLS_BETA = "skills-2025-10-02";
export const ANTHROPIC_CODE_EXECUTION_BETA = "code-execution-2025-08-25";
export const ANTHROPIC_CODE_EXECUTION_TOOL = {
  type: "code_execution_20250825",
  name: "code_execution",
} as const;

export function anthropicContainerSkills(
  role: AgentRole
): Array<{ type: "anthropic"; skill_id: AnthropicBuiltinSkillId; version: "latest" }> {
  return getSkillsForRole(role).builtin.map((skill_id) => ({
    type: "anthropic" as const,
    skill_id,
    version: "latest" as const,
  }));
}
