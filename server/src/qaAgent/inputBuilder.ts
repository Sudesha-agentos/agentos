import type {
  ImplementationOutput,
  PrdOutput,
} from "../types/agents";
import type { RetrievedContext } from "../types/pipeline";
import { resolveRepoScope } from "../codebaseIntelligence/repoScope";
import {
  resolveEngineeringBranchName,
  resolveFallbackApiPushBranch,
} from "../engineering/engineeringWorkspace";
import { resolveCodingBranchName } from "../engineeringCodingAgent/inputBuilder";
import { formatQaHandoffForPrompt, type QaHandoff } from "../engineering/qaHandoff";
import { buildQaAgentContext } from "../pipeline/contextBuilder";

export interface QaAgenticInput {
  pipelineId: string;
  jiraKey: string;
  prd: PrdOutput;
  implementation: ImplementationOutput;
  retrievedContext: RetrievedContext[];
  branchName: string;
  qaHandoff?: QaHandoff;
}

export function buildQaInitialUserMessage(input: QaAgenticInput): string {
  const context = buildQaAgentContext(
    input.prd,
    input.implementation,
    input.retrievedContext
  );

  return `
Jira: ${input.jiraKey}
Pipeline: ${input.pipelineId}
Implementation branch: ${input.branchName}

${input.qaHandoff ? formatQaHandoffForPrompt(input.qaHandoff) : "Ananta coding handoff: missing — do not invent a branch. Ask for status 200."}

${context}

User stories (cover with tests where applicable):
${(input.prd.userStories ?? []).length
  ? input.prd.userStories.map((s, i) => `${i + 1}. ${s}`).join("\n")
  : "(none listed)"}

Acceptance criteria (test every one — include in coverageReport):
${input.prd.acceptanceCriteria.map((c, i) => `${i + 1}. ${c}`).join("\n")}

Edge cases:
${(input.prd.edgeCases ?? []).length
  ? input.prd.edgeCases.map((c, i) => `${i + 1}. ${c}`).join("\n")
  : "(none listed)"}

Implementation criteria mapping:
${input.implementation.criteriaMapping
  .map((m) => `- ${m.criterion} → ${m.implementation}`)
  .join("\n")}

You MUST call run_security_scan and run_tests (or document why skipped) before generate_qa_report.
Begin PHASE 1: read implementation code on branch "${input.branchName}",
then proceed through all four phases. End with generate_qa_report and the
final JSON test plan.
  `.trim();
}

export function resolveQaBranchName(
  implementationBranch?: string,
  jiraKey?: string
): string {
  if (implementationBranch?.trim()) {
    return implementationBranch.trim();
  }
  const scope = resolveRepoScope();
  return (
    (jiraKey ? resolveEngineeringBranchName(jiraKey) : "") ||
    resolveFallbackApiPushBranch(jiraKey) ||
    process.env.QA_DEFAULT_BRANCH?.trim() ||
    process.env.GITHUB_DEFAULT_BRANCH?.trim() ||
    scope?.defaultBranch ||
    resolveCodingBranchName()
  );
}
