/**
 * Debug window on the production pipeline. Stages here must call the same
 * functions as PipelineOrchestrator — extra logs only, no sim-only agent path.
 */
import { EngineeringAgent } from "../agents/engineeringAgent";
import { buildEngineeringAgentSystemPrompt } from "../agents/engineeringAgentPrompt";
import { normalizeImplementationOutput } from "../agents/normalizeImplementationOutput";
import { onEngineeringCodingEvent } from "../engineering/codingEventsHub";
import {
  createEngWorkspace,
  destroyEngWorkspace,
  resolveEngineeringBranchName,
  shouldSkipEngineeringDependencyInstall,
  workspaceCommitAndPush,
} from "../engineering/engineeringWorkspace";
import { buildReadyQaHandoff } from "../engineering/qaHandoff";
import { runEngineeringCodingAgentic } from "../engineeringCodingAgent";
import { getPublicGitCredentials } from "../git-integration/gitCredentialsStore";
import { resolveRepoIndexBranch } from "../git-integration/resolveRepoBranch";
import { getApiModelForRole } from "../billing/consumeAgentCredits";
import { DiscoveryPausedError, runDiscovery } from "../discovery/discoveryOrchestrator";
import { answersCoverAllQuestions } from "../discovery/persistedContext";
import { resolveRepoScope } from "../codebaseIntelligence/repoScope";
import type { NormalizedTicket } from "../types/ticket";
import { buildEngineeringAgentContext } from "../pipeline/contextBuilder";
import { buildPipelineRunSummary } from "../pipeline/runSummary";
import { runQaAgentic } from "../qaAgent";
import type { ImplementationOutput, PrdOutput } from "../types/agents";
import { logger } from "../utils/logger";
import {
  addSimPrompt,
  completeSimRun,
  emitSimEvent,
  failSimRun,
  collectSimAnswers,
  formatAnsweredPrompts,
  getSimRun,
  markSimRunning,
  recordSimUsage,
  waitForSimPromptsClear,
} from "./hub";

async function timed<T>(
  runId: string,
  agent: "system" | "virin" | "ananta" | "neel",
  label: string,
  fn: () => Promise<T>
): Promise<T> {
  const started = Date.now();
  emitSimEvent(runId, { agent, kind: "stage", label: `${label} started` });
  const beat = setInterval(() => {
    const elapsed = Math.round((Date.now() - started) / 1000);
    emitSimEvent(runId, {
      agent,
      kind: "log",
      label: `${label} in progress`,
      detail: `${elapsed}s elapsed — still working`,
    });
  }, 7000);
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
  } finally {
    clearInterval(beat);
  }
}

function publishQuestions(
  runId: string,
  agent: "virin" | "ananta" | "neel",
  questions: string[] | undefined,
  approval?: { title: string; body: string }
): void {
  const existing = new Set(
    (getSimRun(runId)?.prompts ?? [])
      .filter((prompt) => prompt.kind === "question")
      .map((prompt) => (prompt.body || prompt.title).trim().toLowerCase())
      .filter(Boolean)
  );
  for (const question of questions ?? []) {
    const text = String(question ?? "").trim();
    if (!text) continue;
    const key = text.toLowerCase();
    if (existing.has(key)) continue;
    existing.add(key);
    addSimPrompt(runId, {
      agent,
      kind: "question",
      title: text.length > 72 ? `${text.slice(0, 72)}…` : text,
      body: text,
    });
  }
  if (approval) {
    addSimPrompt(runId, {
      agent,
      kind: "approval",
      title: approval.title,
      body: approval.body,
    });
  }
}

function requirementToTicket(
  runId: string,
  requirement: string,
  answers?: import("../discovery/persistedContext").HumanDiscoveryAnswer[]
): NormalizedTicket {
  const jiraKey = `SIM-${runId.slice(4, 12)}`.toUpperCase();
  return {
    jiraTicketId: runId,
    jiraKey,
    summary: requirement.trim().slice(0, 120) || jiraKey,
    description: requirement.trim(),
    humanAnswers: answers?.length ? answers : undefined,
    issueType: "Story",
    priority: "Medium",
    reporter: "sim",
    assignee: null,
    labels: ["sim-testing"],
    epicLink: null,
    storyPoints: null,
    components: [],
    createdAt: new Date(),
    projectKey: "SIM",
  };
}

async function runVirin(runId: string, requirement: string): Promise<PrdOutput> {
  return timed(runId, "virin", "Virin discovery", async () => {
    emitSimEvent(runId, {
      agent: "virin",
      kind: "log",
      label: "Running product discovery",
      detail: getApiModelForRole("product"),
    });

    let resume: import("../discovery/persistedContext").DiscoveryPauseSnapshot | undefined;
    let recordedInput = 0;
    let recordedOutput = 0;
    const maxVirinAttempts = 8;
    for (let attempt = 0; attempt < maxVirinAttempts; attempt += 1) {
      const answers = collectSimAnswers(runId);
      const ticket = requirementToTicket(runId, requirement, answers);
      try {
        if (answers.length) {
          emitSimEvent(runId, {
            agent: "virin",
            kind: "log",
            label: "Sending answers JSON to codebase analysis",
            detail: JSON.stringify({ humanAnswers: answers }),
          });
        }
        const discovery = await runDiscovery(ticket, runId, {
          resume,
          humanAnswers: answers,
        });
        recordSimUsage(runId, {
          agent: "virin",
          stage: "Virin discovery",
          model: getApiModelForRole("product"),
          inputTokens: Math.max(0, discovery.inputTokens - recordedInput),
          outputTokens: Math.max(0, discovery.outputTokens - recordedOutput),
        });
        const prd = discovery.prdOutput;
        emitSimEvent(runId, {
          agent: "virin",
          kind: "artifact",
          label: `PRD · ${prd.title}`,
          detail: `${prd.acceptanceCriteria?.length ?? 0} criteria · ${prd.openQuestions?.length ?? 0} questions`,
          data: {
            title: prd.title,
            acceptanceCriteria: prd.acceptanceCriteria,
            openQuestions: prd.openQuestions,
          },
        });
        return prd;
      } catch (err) {
        if (!(err instanceof DiscoveryPausedError) || attempt >= maxVirinAttempts - 1) throw err;
        const questions = (err.snapshot?.discoveryQuestions ?? []).map((item) => item.question);
        emitSimEvent(runId, {
          agent: "virin",
          kind: "log",
          label: "Paused for the same human gate as production",
          detail: err.message,
        });
        const pausedUsage = err.snapshot?.usageSoFar;
        if (pausedUsage && (pausedUsage.inputTokens || pausedUsage.outputTokens)) {
          recordSimUsage(runId, {
            agent: "virin",
            stage: "Virin questions",
            model: getApiModelForRole("product"),
            inputTokens: Math.max(0, pausedUsage.inputTokens - recordedInput),
            outputTokens: Math.max(0, pausedUsage.outputTokens - recordedOutput),
          });
          recordedInput = pausedUsage.inputTokens;
          recordedOutput = pausedUsage.outputTokens;
        }
        publishQuestions(runId, "virin", questions.length ? questions : [err.message]);
        emitSimEvent(runId, {
          agent: "virin",
          kind: "log",
          label: "Waiting for answers",
          detail:
            err.snapshot?.pauseReason === "prd_open_questions"
              ? "Answer every question. Virin will fold them into the PRD before Ananta starts coding."
              : "The box closes when every question is answered. Discovery then resumes from this point.",
        });
        await waitForSimPromptsClear(runId);
        const answered = collectSimAnswers(runId);
        if (questions.length && !answersCoverAllQuestions(questions, answered)) {
          emitSimEvent(runId, {
            agent: "virin",
            kind: "log",
            label: "Still waiting for every question",
            detail: `${answered.length}/${questions.length} answered`,
          });
          attempt -= 1;
          continue;
        }
        resume = err.snapshot;
      }
    }
    throw new Error("Virin discovery did not produce a PRD");
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
    const humanAnswers = formatAnsweredPrompts(runId);
    const output = await agent.run(
      runId,
      JSON.stringify({
        context,
        prd,
        instruction:
          "Produce an implementation plan mapped to every acceptance criterion. Do not stop for missing optional integrations — plan the work and list questions as blockers.",
        humanAnswers: humanAnswers || undefined,
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
    recordSimUsage(runId, {
      agent: "ananta",
      stage: "Ananta plan",
      model: getApiModelForRole("tech"),
      inputTokens: output.metadata.inputTokens,
      outputTokens: output.metadata.outputTokens,
    });
    emitSimEvent(runId, {
      agent: "ananta",
      kind: "artifact",
      label: "Implementation plan",
      detail: plan.summary,
      data: {
        summary: plan.summary,
        blockers: plan.blockers,
        targetFiles: plan.targetFiles,
      },
    });
    publishQuestions(runId, "ananta", plan.blockers, {
      title: "Continue to coding",
      body: plan.blockers.length
        ? `Ananta listed ${plan.blockers.length} blocker(s). Coding continues on this sim.`
        : "Plan is ready. Coding continues on this sim.",
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
    } else if (event.type === "file_staged") {
      emitSimEvent(runId, {
        agent: "ananta",
        kind: "log",
        label: `File ${event.action}`,
        detail: event.filePath,
      });
    } else if (event.type === "coding_started" || event.type === "coding_completed") {
      emitSimEvent(runId, {
        agent: "ananta",
        kind: "log",
        label: event.type === "coding_started" ? "Coding loop started" : "Coding loop completed",
      });
    }
  });

  try {
    const prd = await runVirin(runId, run.requirement);

    const humanAnswers = formatAnsweredPrompts(runId);
    if (humanAnswers) {
      emitSimEvent(runId, {
        agent: "system",
        kind: "log",
        label: "Using answers from the prompt panel",
        detail: humanAnswers,
      });
    }

    const plan = await runAnantaPlan(runId, prd);

    const skipDependencyInstall = shouldSkipEngineeringDependencyInstall({
      implementationMode: "code",
    });
    const workspace = await timed(runId, "system", "Clone GitHub repo", async () =>
      createEngWorkspace(runId, jiraKey, sourceBranch, { skipDependencyInstall })
    );
    workspaceDir = workspace.workspaceDir;
    emitSimEvent(runId, {
      agent: "system",
      kind: "log",
      label: "Checkout ready",
      detail: `${workspace.workspaceDir} · ${workspace.branchName}`,
    });

    const codingAnswers = formatAnsweredPrompts(runId);
    const coding = await timed(runId, "ananta", "Ananta coding", async () =>
      runEngineeringCodingAgentic({
        pipelineId: runId,
        jiraKey,
        prd,
        implementation: plan,
        enrichedPrdDocument: {},
        implementationMode: "code",
        retainArtifacts: true,
        compileFeedback: codingAnswers
          ? `Human answers from the sim prompt panel:\n${codingAnswers}`
          : undefined,
      })
    );
    recordSimUsage(runId, {
      agent: "ananta",
      stage: "Ananta coding",
      model: getApiModelForRole("tech"),
      inputTokens: coding.metadata.inputTokens,
      outputTokens: coding.metadata.outputTokens,
    });
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
        humanAnswers: collectSimAnswers(runId),
      })
    );

    const testCases = qa.agentOutput.parsed.testCases ?? [];
    const conduct = qa.agentOutput.parsed.testConductReport;
    recordSimUsage(runId, {
      agent: "neel",
      stage: "Neel QA",
      model: getApiModelForRole("qa"),
      inputTokens: qa.agentOutput.metadata.inputTokens,
      outputTokens: qa.agentOutput.metadata.outputTokens,
    });
    emitSimEvent(runId, {
      agent: "neel",
      kind: "artifact",
      label: "Neel test report",
      detail:
        conduct?.headline ??
        `${testCases.length} test cases · ${qa.toolCallLog.length} tools · ${qa.agentOutput.parsed.coverageReport?.coveragePercent ?? "?"}% coverage`,
      data: {
        testSummary: qa.agentOutput.parsed.testSummary,
        testCaseCount: testCases.length,
        coveragePercent: qa.agentOutput.parsed.coverageReport?.coveragePercent,
        headline: conduct?.headline,
        totals: conduct?.totals,
        executed: conduct?.executed,
        tools: conduct?.tools,
        markdown: conduct?.markdown,
      },
    });
    publishQuestions(runId, "neel", qa.agentOutput.parsed.coverageReport?.uncoveredCriteria, {
      title: "QA complete",
      body:
        conduct?.headline ??
        `${testCases.length} test cases · ${qa.agentOutput.parsed.coverageReport?.coveragePercent ?? "?"}% coverage. Review on the right; the sim already continued.`,
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
      testsPassed: conduct?.totals.passed ?? summary.testsPassed,
      testsFailed: conduct?.totals.failed ?? summary.testsFailed,
      testConductHeadline: conduct?.headline,
      testConductMarkdown: conduct?.markdown,
      executed: conduct?.executed,
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
