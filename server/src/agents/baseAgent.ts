import { auditRepo } from "../db/repositories/auditRepo";
import { getModelIdForRole } from "../billing/consumeAgentCredits";
import type { AgentRole } from "../llm/agentModels";
import { chatCompletionText } from "../llm/openaiCompletion";
import { applyClaudeSkillsToPrompt } from "../llm/claudeSkills";
import { getOpenAIChatModel } from "../llm/openaiClient";
import type { AgentOutput } from "../types/agents";
import { AgentParseError } from "../utils/errors";
import { logger } from "../utils/logger";
import { retry } from "../utils/retry";

const INPUT_COST_PER_TOKEN = 0.00000125;
const OUTPUT_COST_PER_TOKEN = 0.00001;

export abstract class BaseAgent<TParsed = Record<string, unknown>> {
  abstract name: string;
  abstract systemPrompt: string;
  protected model = getOpenAIChatModel();
  protected maxTokens = 4000;
  protected role: AgentRole = "product";

  async run(
    pipelineId: string,
    userPrompt: string,
    options?: { systemPrompt?: string; jsonMode?: boolean; maxTokens?: number }
  ): Promise<AgentOutput<TParsed>> {
    const startTime = Date.now();
    const system = applyClaudeSkillsToPrompt(
      options?.systemPrompt ?? this.systemPrompt,
      this.role
    );

    await auditRepo.log(pipelineId, `${this.name}_STARTED`, {
      promptLength: userPrompt.length,
    });

    const { text, usage } = await retry(
      () =>
        chatCompletionText({
          system,
          user: userPrompt,
          maxTokens: options?.maxTokens ?? this.maxTokens,
          jsonMode: options?.jsonMode ?? false,
          providerId: getModelIdForRole(this.role),
          role: this.role,
        }),
      { attempts: 3, baseDelayMs: 1200 }
    );

    const parsed = this.parseOutput(text);
    const durationMs = Date.now() - startTime;
    const inputTokens = usage.inputTokens;
    const outputTokens = usage.outputTokens;
    const costUsd = usage.costUsd;

    await auditRepo.log(pipelineId, `${this.name}_COMPLETED`, {
      inputTokens,
      outputTokens,
      costUsd,
      durationMs,
      model: this.model,
    });

    logger.info(
      { agent: this.name, model: this.model, inputTokens, outputTokens, costUsd, durationMs },
      "agent run"
    );

    return {
      raw: text,
      parsed,
      metadata: { inputTokens, outputTokens, costUsd, durationMs },
    };
  }

  protected safeJsonParse(raw: string): unknown {
    const cleaned = raw.replace(/```json|```/g, "").trim();
    try {
      return JSON.parse(cleaned);
    } catch {
      throw new AgentParseError(this.name, raw);
    }
  }

  abstract parseOutput(raw: string): TParsed;
}
