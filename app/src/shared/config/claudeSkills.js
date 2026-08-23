export const ANTHROPIC_BUILTIN_SKILL_IDS = ["pptx", "xlsx", "docx", "pdf"];

export const ANTHROPIC_BUILTIN_SKILLS = [
  {
    id: "pptx",
    label: "PowerPoint",
    blurb: "Build and edit presentations when the run needs slides.",
  },
  {
    id: "xlsx",
    label: "Excel",
    blurb: "Create and analyze spreadsheets when the run needs tables.",
  },
  {
    id: "docx",
    label: "Word",
    blurb: "Draft Word documents when the run needs a formatted file.",
  },
  {
    id: "pdf",
    label: "PDF",
    blurb: "Read and produce PDFs when the run needs a portable file.",
  },
];

export function isAnthropicBuiltinSkillId(value) {
  return ANTHROPIC_BUILTIN_SKILL_IDS.includes(value);
}

export function skillIdsKeyForRole(roleId) {
  if (roleId === "tech") return "techSkillIds";
  if (roleId === "qa") return "qaSkillIds";
  return "productSkillIds";
}

export function newCustomSkillId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `skill_${crypto.randomUUID()}`;
  }
  return `skill_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
