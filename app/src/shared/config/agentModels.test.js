import { describe, expect, it } from "vitest";
import { getAgentModelForRole, getAgentModelRoleForDomain } from "./agentModels";

describe("agent model roles", () => {
  it("maps chat agents to Product, Tech, and QA model roles", () => {
    expect(getAgentModelRoleForDomain("virin").id).toBe("product");
    expect(getAgentModelRoleForDomain("ananta").id).toBe("tech");
    expect(getAgentModelRoleForDomain("neel").id).toBe("qa");
  });

  it("resolves the selected model for the chat agent", () => {
    const settings = {
      productModel: "claude",
      productModelName: "claude-sonnet-4-5",
      techModel: "chatgpt",
      techModelName: "gpt-5.1",
    };
    expect(getAgentModelForRole(settings, "product").modelLabel).toBe("Sonnet 4.5");
    expect(getAgentModelForRole(settings, "tech").modelLabel).toBe("GPT-5.1");
  });
});
