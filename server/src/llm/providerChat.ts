import type Anthropic from "@anthropic-ai/sdk";
import type {
  ChatCompletion,
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions";
import { resolveApiModel, type AgentModelId, type AgentRole } from "./agentModels";
import { getApiModelForRole } from "../billing/consumeAgentCredits";
import { createChatCompletion } from "./openaiClient";
import { getAnthropicClient, getOpenAICompatibleClient } from "./providerClients";
import {
  ANTHROPIC_CODE_EXECUTION_BETA,
  ANTHROPIC_CODE_EXECUTION_TOOL,
  ANTHROPIC_SKILLS_BETA,
  anthropicContainerSkills,
} from "./claudeSkills";

function openaiToolsToAnthropic(tools: ChatCompletionTool[]): Anthropic.Tool[] {
  return tools.map((tool) => ({
    name: tool.function.name,
    description: tool.function.description ?? "",
    input_schema: (tool.function.parameters ?? {
      type: "object",
      properties: {},
    }) as Anthropic.Tool.InputSchema,
  }));
}

function asText(content: ChatCompletionMessageParam["content"]): string {
  if (typeof content === "string") return content;
  if (!content) return "";
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part) {
          return String((part as { text?: string }).text ?? "");
        }
        return "";
      })
      .join("\n");
  }
  return "";
}

function mergeAnthropicMessages(messages: Anthropic.MessageParam[]): Anthropic.MessageParam[] {
  const merged: Anthropic.MessageParam[] = [];
  for (const message of messages) {
    const prev = merged[merged.length - 1];
    if (prev && prev.role === message.role) {
      const prevContent = Array.isArray(prev.content) ? prev.content : [{ type: "text" as const, text: String(prev.content) }];
      const nextContent = Array.isArray(message.content)
        ? message.content
        : [{ type: "text" as const, text: String(message.content) }];
      prev.content = [...prevContent, ...nextContent];
    } else {
      merged.push(message);
    }
  }
  if (merged[0] && merged[0].role !== "user") {
    merged.unshift({ role: "user", content: "Continue." });
  }
  return merged;
}

function toAnthropicPayload(messages: ChatCompletionMessageParam[]): {
  system: string;
  messages: Anthropic.MessageParam[];
} {
  let system = "";
  const out: Anthropic.MessageParam[] = [];

  for (const message of messages) {
    if (message.role === "system") {
      system += `${asText(message.content)}\n`;
      continue;
    }
    if (message.role === "tool") {
      out.push({
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: message.tool_call_id,
            content: asText(message.content) || "",
          },
        ],
      });
      continue;
    }
    if (message.role === "assistant") {
      const blocks: Anthropic.ContentBlockParam[] = [];
      const text = asText(message.content);
      if (text) blocks.push({ type: "text", text });
      for (const toolCall of message.tool_calls ?? []) {
        let input: Record<string, unknown> = {};
        try {
          input = JSON.parse(toolCall.function.arguments || "{}") as Record<string, unknown>;
        } catch {
          input = {};
        }
        blocks.push({
          type: "tool_use",
          id: toolCall.id,
          name: toolCall.function.name,
          input,
        });
      }
      out.push({
        role: "assistant",
        content: blocks.length > 0 ? blocks : [{ type: "text", text: "" }],
      });
      continue;
    }
    if (message.role === "user") {
      out.push({ role: "user", content: asText(message.content) });
    }
  }

  return { system: system.trim(), messages: mergeAnthropicMessages(out) };
}

function anthropicToChatCompletion(response: Anthropic.Message, model: string): ChatCompletion {
  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
  const toolCalls = response.content
    .filter((block): block is Anthropic.ToolUseBlock => block.type === "tool_use")
    .filter((block) => block.name !== ANTHROPIC_CODE_EXECUTION_TOOL.name)
    .map((block) => ({
      id: block.id,
      type: "function" as const,
      function: {
        name: block.name,
        arguments: JSON.stringify(block.input ?? {}),
      },
    }));

  const finishReason = toolCalls.length > 0 ? "tool_calls" : "stop";
  return {
    id: response.id,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        finish_reason: finishReason,
        logprobs: null,
        message: {
          role: "assistant",
          content: text || null,
          refusal: null,
          tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
        },
      },
    ],
    usage: {
      prompt_tokens: response.usage?.input_tokens ?? 0,
      completion_tokens: response.usage?.output_tokens ?? 0,
      total_tokens:
        (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0),
    },
  };
}

export async function createProviderChatCompletion(params: {
  providerId: AgentModelId;
  messages: ChatCompletionMessageParam[];
  maxTokens?: number;
  tools?: ChatCompletionTool[];
  jsonMode?: boolean;
  role?: AgentRole;
}): Promise<ChatCompletion> {
  const maxTokens = params.maxTokens ?? 4000;
  const apiModel = params.role
    ? getApiModelForRole(params.role)
    : resolveApiModel(params.providerId);

  if (params.providerId === "claude") {
    const { system, messages } = toAnthropicPayload(params.messages);
    const tools: Array<Anthropic.Tool | typeof ANTHROPIC_CODE_EXECUTION_TOOL> = params.tools?.length
      ? openaiToolsToAnthropic(params.tools)
      : [];
    const containerSkills = params.role ? anthropicContainerSkills(params.role) : [];
    if (containerSkills.length > 0) {
      tools.push(ANTHROPIC_CODE_EXECUTION_TOOL);
    }

    const body: Record<string, unknown> = {
      model: apiModel,
      max_tokens: maxTokens,
      system: system || undefined,
      messages,
      ...(tools.length ? { tools } : {}),
    };
    if (containerSkills.length > 0) {
      body.container = { skills: containerSkills };
    }

    const response = await getAnthropicClient().messages.create(
      body as unknown as Anthropic.MessageCreateParamsNonStreaming,
      containerSkills.length > 0
        ? {
            headers: {
              "anthropic-beta": `${ANTHROPIC_SKILLS_BETA},${ANTHROPIC_CODE_EXECUTION_BETA}`,
            },
          }
        : undefined
    );
    return anthropicToChatCompletion(response, apiModel);
  }

  const client = getOpenAICompatibleClient(params.providerId === "grok" ? "grok" : "chatgpt");
  if (params.providerId === "chatgpt") {
    return createChatCompletion({
      model: apiModel,
      maxTokens,
      messages: params.messages,
      ...(params.jsonMode ? { response_format: { type: "json_object" as const } } : {}),
      ...(params.tools?.length ? { tools: params.tools, tool_choice: "auto" as const } : {}),
    });
  }

  return client.chat.completions.create({
    model: apiModel,
    max_tokens: maxTokens,
    messages: params.messages,
    ...(params.jsonMode ? { response_format: { type: "json_object" as const } } : {}),
    ...(params.tools?.length ? { tools: params.tools, tool_choice: "auto" as const } : {}),
  });
}
