import { EngineeringAgent } from "../agents/engineeringAgent";
import { buildEngineeringAgentSystemPrompt } from "../agents/engineeringAgentPrompt";
import { normalizeImplementationOutput } from "../agents/normalizeImplementationOutput";
import { onEngineeringCodingEvent } from "../engineering/codingEventsHub";
import {
  createEngWorkspace,
  destroyEngWorkspace,
  resolveEngineeringBranchName,
  workspaceCommitAndPush,
} from "../engineering/engineeringWorkspace";
import { buildReadyQaHandoff } from "../engineering/qaHandoff";
import { runEngineeringCodingAgentic } from "../engineeringCodingAgent";
import { getPublicGitCredentials } from "../git-integration/gitCredentialsStore";
import { resolveRepoIndexBranch } from "../git-integration/resolveRepoBranch";
import { chatCompletionText, parseDiscoveryJson } from "../llm/openaiCompletion";
import { resolveRepoScope } from "../codebaseIntelligence/repoScope";
import { buildEngineeringAgentContext } from "../pipeline/contextBuilder";
import { buildPipelineRunSummary } from "../pipeline/runSummary";
import { runQaAgentic } from "../qaAgent";
import type { ImplementationOutput, PrdOutput } from "../types/agents";
import { logger } from "../utils/logger";
import {
  completeSimRun,
  emitSimEvent,
  failSimRun,
  getSimRun,
  markSimRunning,
} from "./hub";

async function timed<T>(
  runId: string,
  agent: "system" | "virin" | "ananta" | "neel",
  label: string,
  fn: () => Promise<T>
): Promise<T> {
  const started = Date.now();
  emitSimEvent(runId, { agent, kind: "stage", label: `${label} started` });
  try {
    const result = await fn();
    const durationMs = Date.now() - started;
    emitSimEvent(runId, {
      agent,
      kind: "stage",
      label: `${label} finished`,
      detail: `${(durationMs / 1000).toFixed(1)}s`,
      durationMs,
    });
    return result;
  } catch (err) {
    const durationMs = Date.now() - started;
    const message = err instanceof Error ? err.message : String(err);
    emitSimEvent(runId, {
      agent,
      kind: "error",
      label: `${label} failed`,
      detail: message,
      durationMs,
    });
    throw err;
  }
}

async function runVirin(runId: string, requirement: string): Promise<PrdOutput> {
  return timed(runId, "virin", "Virin PRD", async () => {
    const { text, usage, model } = await chatCompletionText({
      role: "product",
      jsonMode: true,
      maxTokens: 3000,
      system: `You are Virin. Return ONLY JSON:
{
  "title": string,
  "problemStatement": string,
  "proposedSolution": string,
  "userStories": string[],
  "acceptanceCriteria": string[],
  "outOfScope": string[],
  "edgeCases": string[],
  "dependencies": string[],
  "successMetrics": string[],
  "openQuestions": string[],
  "confidenceScore": number,
  "confidenceReason": string
}
Write a real PRD. Include at least 6 testable acceptance criteria.`,
      user: requirement,
    });
    const prd = parseDiscoveryJson<PrdOutput>(text, "simVirin");
    emitSimEvent(runId, {
      agent: "virin",
      kind: "artifact",
      label: `PRD · ${prd.title}`,
      detail: `${prd.acceptanceCriteria?.length ?? 0} criteria · ${model} in=${usage.inputTokens} out=${usage.outputTokens}`,
      data: { prd: prd as unknown as Record<string, unknown> },
    });
    return prd;
  });
}

async function runAnantaPlan(runId: string, prd: PrdOutput): Promise<ImplementationOutput> {
  return timed(runId, "ananta", "Ananta plan", async () => {
    const agent = new EngineeringAgent();
    const context = buildEngineeringAgentContext(
      prd,
      [],
      "Use the connected GitHub checkout. Match existing repo style."
    );
    const output = await agent.run(
      runId,
      JSON.stringify({
        context,
        prd,
        instruction: "Produce an implementation plan mapped to every acceptance criterion.",
        implementationMode: "code",
      }),
      {
        systemPrompt: buildEngineeringAgentSystemPrompt("code"),
        jsonMode: true,
        maxTokens: 6000,
      }
    );
    const plan = normalizeImplementationOutput(output.parsed, "code", []);
    plan.implementationMode = "code";
    emitSimEvent(runId, {
      agent: "ananta",
      kind: "artifact",
      label: "Implementation plan",
      detail: plan.summary,
      data: { plan: plan as unknown as Record<string, unknown> },
    });
    return plan;
  });
}

export async function executeSimRun(runId: string): Promise<void> {
  const run = getSimRun(runId);
  if (!run) return;
  markSimRunning(runId);

  const jiraKey = `SIM-${runId.slice(4, 12)}`.toUpperCase();
  const branchName = resolveEngineeringBranchName(jiraKey);
  emitSimEvent(runId, {
    agent: "system",
    kind: "log",
    label: "Sim started",
    detail: `${jiraKey} · branch ${branchName}`,
  });

  const git = getPublicGitCredentials();
  if (!git.configured) {
    failSimRun(runId, "GitHub is not connected. Connect a repo in Settings → Integrations.");
    return;
  }
  emitSimEvent(runId, {
    agent: "system",
    kind: "log",
    label: "GitHub connected",
    detail: `${git.workspace}/${git.repoSlug} @ ${git.defaultBranch}`,
  });

  const sourceBranch = await resolveRepoIndexBranch(
    resolveRepoScope()?.defaultBranch ?? git.defaultBranch ?? "main"
  );

  let workspaceDir: string | undefined;
  const unsubCoding = onEngineeringCodingEvent((event) => {
    if (event.pipelineId !== runId) return;
    if (event.type === "tool_started" || event.type === "tool_completed") {
      emitSimEvent(runId, {
        agent: "ananta",
        kind: "tool",
        label: event.displayLabel || event.tool,
        detail: event.type === "tool_completed" ? `${event.durationMs}ms` : "running",
        durationMs: event.type === "tool_completed" ? event.durationMs : undefined,
        data: { tool: event.tool, filePath: "filePath" in event ? event.filePath : undefined },
      });
    }
  });

  try {
    const workspace = await timed(runId, "system", "Clone GitHub repo", async () =>
      createEngWorkspace(runId, jiraKey, sourceBranch, { skipDependencyInstall: true })
    );
    workspaceDir = workspace.workspaceDir;
    emitSimEvent(runId, {
      agent: "system",
      kind: "log",
      label: "Checkout ready",
      detail: `${workspace.workspaceDir} · ${workspace.branchName}`,
    });

    const prd = await runVirin(runId, run.requirement);
    const plan = await runAnantaPlan(runId, prd);

    const coding = await timed(runId, "ananta", "Ananta coding", async () =>
      runEngineeringCodingAgentic({
        pipelineId: runId,
        jiraKey,
        prd,
        implementation: plan,
        enrichedPrdDocument: {},
        implementationMode: "code",
        retainArtifacts: true,
      })
    );
    emitSimEvent(runId, {
      agent: "ananta",
      kind: "artifact",
      label: "Code written",
      detail: `${coding.codeChanges.length} file(s) · ${coding.toolCallLog.length} tools`,
      data: {
        codingSummary: coding.codingSummary,
        codeChanges: coding.codeChanges as unknown as Record<string, unknown>,
        toolCallLog: coding.toolCallLog,
      },
    });

    const push = await timed(runId, "ananta", "Push branch to GitHub", async () => {
      const result = await workspaceCommitAndPush(
        workspace.workspaceDir,
        `[${jiraKey}] ${coding.codingSummary.slice(0, 72)}`
      );
      if (!result) {
        throw new Error("Nothing to commit — Ananta made no file changes.");
      }
      return result;
    });

    const handoff = buildReadyQaHandoff({
      jiraKey,
      implementationBranch: push.pushedBranch,
      commitSha: push.sha,
      filesChanged: coding.codeChanges.length,
      codingSummary: coding.codingSummary,
    });
    emitSimEvent(runId, {
      agent: "ananta",
      kind: "artifact",
      label: "Status 200 → Neel",
      detail: `${handoff.implementationBranch} @ ${handoff.commitSha.slice(0, 8)}`,
      data: handoff as unknown as Record<string, unknown>,
    });

    const implementation: ImplementationOutput = {
      ...plan,
      codeChanges: coding.codeChanges,
      codingSummary: coding.codingSummary,
    };

    const qa = await timed(runId, "neel", "Neel QA (tools + test cases)", async () =>
      runQaAgentic({
        pipelineId: runId,
        jiraKey,
        prd,
        implementation,
        retrievedContext: [],
        implementationMode: "code",
        implementationBranch: handoff.implementationBranch,
        qaHandoff: handoff,
      })
    );

    const testCases = qa.agentOutput.parsed.testCases ?? [];
    emitSimEvent(runId, {
      agent: "neel",
      kind: "artifact",
      label: "QA report",
      detail: `${testCases.length} test cases · ${qa.toolCallLog.length} tools · ${qa.agentOutput.parsed.coverageReport?.coveragePercent ?? "?"}% coverage`,
      data: {
        qa: qa.agentOutput.parsed as unknown as Record<string, unknown>,
        toolCallLog: qa.toolCallLog,
      },
    });
    for (const call of qa.toolCallLog) {
      emitSimEvent(runId, {
        agent: "neel",
        kind: "tool",
        label: call.tool,
        detail: `${call.query} · hits=${call.resultsFound}`,
        data: call as unknown as Record<string, unknown>,
      });
    }

    const summary = buildPipelineRunSummary({
      jiraKey,
      prd,
      implementation,
      qa: qa.agentOutput.parsed,
      implementationBranch: handoff.implementationBranch,
      executionReport: qa.executionReport as Record<string, unknown> | undefined,
    });

    completeSimRun(runId, {
      jiraKey,
      branch: handoff.implementationBranch,
      commitSha: handoff.commitSha,
      qaHandoffStatus: 200,
      prdTitle: prd.title,
      codingSummary: coding.codingSummary,
      filesChanged: coding.codeChanges.map((change) => change.filePath),
      qaTestCases: testCases.length,
      qaToolCalls: qa.toolCallLog.length,
      qaSummary: qa.agentOutput.parsed.testSummary,
      whatWasDone: summary.whatWasDone,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn({ err, runId }, "sim testing run failed");
    failSimRun(runId, message);
  } finally {
    unsubCoding();
    if (workspaceDir) {
      destroyEngWorkspace(runId);
    }
  }
}
