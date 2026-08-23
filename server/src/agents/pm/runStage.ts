import { completionJson } from "../../llm/openaiCompletion";
import { getModelIdForRole } from "../../billing/consumeAgentCredits";
import { applyClaudeSkillsToPrompt } from "../../llm/claudeSkills";
import type { LlmUsage } from "../../llm/openaiCompletion";
import type { PmStageId } from "./types";

export async function runPmStage<T>(input: {
  stage: PmStageId;
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
}): Promise<{ parsed: T; usage: LlmUsage; raw: string }> {
  const { parsed, usage, raw } = await completionJson<T>({
    source: `virin_${input.stage}`,
    systemPrompt: applyClaudeSkillsToPrompt(input.systemPrompt, "product"),
    userPrompt: input.userPrompt,
    maxTokens: input.maxTokens ?? 4000,
    providerId: getModelIdForRole("product"),
    role: "product",
  });

  return { parsed, usage, raw };
}
