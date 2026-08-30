import { describe, expect, it } from "vitest";
import {
  buildReleaseMessages,
  mergeReleaseMessages,
  releaseProgress,
  shouldStartVirinRelease,
  stripChatContext,
  summarizeStage,
} from "./releaseTranscript";

const analysis = {
  jiraKey: "PLT-42",
  status: "AWAITING_INPUT",
  currentStage: "QUESTION_MODE",
  startedAt: "2026-08-26T00:00:00.000Z",
  updatedAt: "2026-08-26T00:05:00.000Z",
  stageMeta: [
    {
      stage: "INTAKE",
      status: "COMPLETED",
      startedAt: "2026-08-26T00:00:00.000Z",
      completedAt: "2026-08-26T00:01:00.000Z",
    },
  ],
  neelIntake: { ticketType: "story", oneLiner: "Export audit logs" },
  pendingQuestion: "Who is the primary user?",
  questionMode: { conversation: [], plannedQuestions: [], maxTurns: 12 },
  humanBlockers: [
    {
      id: "b1",
      title: "Need log access",
      detail: "Connect the production log backend.",
      kind: "log_sources",
    },
  ],
};

describe("release transcript", () => {
  it("starts a Virin release when there is no analysis yet", () => {
    expect(shouldStartVirinRelease(null, "virin", "PLT-42")).toBe(true);
    expect(shouldStartVirinRelease(analysis, "virin", "PLT-42")).toBe(false);
    expect(shouldStartVirinRelease(null, "ananta", "PLT-42")).toBe(false);
  });

  it("strips mention context from the posted requirement", () => {
    expect(stripChatContext("Context:\n- Ticket PLT-42: Export\n\nNeed SSO too")).toBe("Need SSO too");
  });

  it("summarizes completed intake", () => {
    expect(summarizeStage(analysis, "INTAKE")).toContain("story");
  });

  it("promotes blockers and pending questions into the stream", () => {
    const rows = buildReleaseMessages(analysis);
    expect(rows.some((row) => row.metadata?.kind === "release_start")).toBe(true);
    expect(rows.some((row) => row.metadata?.kind === "stage")).toBe(true);
    expect(rows.some((row) => row.metadata?.kind === "issue" && row.metadata.title === "Need log access")).toBe(
      true
    );

    const merged = mergeReleaseMessages([], analysis);
    expect(merged.some((row) => row.metadata?.kind === "discovery_question")).toBe(true);
    expect(merged.some((row) => row.metadata?.kind === "issue")).toBe(true);
  });

  it("tracks compact progress for the dashboard header", () => {
    const progress = releaseProgress(analysis);
    expect(progress?.label).toMatch(/Discovery/i);
    expect(progress?.pct).toBeGreaterThan(0);
    expect(progress?.pct).toBeLessThan(100);
  });

  it("includes coding pipeline progress and pauses as issues", () => {
    const rows = buildReleaseMessages(
      { ...analysis, status: "COMPLETED", generatedPrd: { title: "Audit export PRD" } },
      {
        pipelineId: "pl_1",
        status: "PAUSED",
        currentStage: "PRD_VALIDATION",
        currentStageLabel: "PRD Gate",
        currentAction: "Waiting for PRD review",
        blockReason: "Acceptance criteria incomplete",
        startedAt: "2026-08-26T00:10:00.000Z",
        thoughtProcess: [],
        discoverySteps: [],
      }
    );
    expect(rows.some((row) => row.metadata?.kind === "pipeline")).toBe(true);
    expect(rows.some((row) => row.metadata?.kind === "issue" && /pipeline/i.test(row.metadata.title))).toBe(
      true
    );
  });

  it("shows Ananta files, PR, and Neel coverage in the same thread", () => {
    const rows = buildReleaseMessages(
      { ...analysis, status: "COMPLETED", generatedPrd: { title: "Audit export PRD" } },
      {
        pipelineId: "pl_1",
        status: "RUNNING",
        currentStage: "QA_AGENT",
        currentStageLabel: "Neel",
        currentAction: "Neel is running tests",
        startedAt: "2026-08-26T00:20:00.000Z",
        thoughtProcess: [],
        discoverySteps: [],
      },
      {
        engineeringRun: {
          pipelineId: "pl_1",
          jiraKey: "PLT-42",
          currentStage: "QA_AGENT",
          currentStageLabel: "Neel",
          status: "RUNNING",
          files: [{ path: "src/export.ts", change: "created" }],
          prUrl: "https://github.com/org/repo/pull/12",
          prNumber: 12,
          prDraft: true,
          liveSteps: [{ label: "Wrote export.ts", status: "complete" }],
        },
        qaReport: {
          pipelineId: "pl_1",
          coverageReport: { coveragePercent: 88, coveredCriteria: 8, totalCriteria: 9 },
          testRun: { passed: 10, failed: 1, skipped: 0 },
          failureAnalysis: [{ testName: "exports csv", likelyCause: "missing header" }],
          recommendation: "fix and re-run",
        },
      }
    );

    const ananta = rows.find((row) => row.metadata?.kind === "ananta");
    expect(ananta?.metadata?.files?.some((file) => file.path === "src/export.ts")).toBe(true);
    expect(ananta?.metadata?.live).toBe(false);
    expect(rows.some((row) => row.metadata?.kind === "pr" && row.metadata.domain === "ananta")).toBe(true);
    const qa = rows.find((row) => row.metadata?.kind === "qa");
    expect(qa?.metadata?.coverage?.coveragePercent).toBe(88);
    expect(qa?.metadata?.live).toBe(true);
    expect(qa?.metadata?.testCases ?? []).toEqual([]);
    expect(rows.some((row) => row.metadata?.domain === "neel" && row.metadata.kind === "issue")).toBe(true);
  });

  it("shows the PRD in the dashboard as soon as Virin has written it", () => {
    const rows = buildReleaseMessages({
      ...analysis,
      status: "RUNNING",
      currentStage: "PRD",
      generatedPrd: {
        title: "Audit export PRD",
        problemStatement: "Need exports",
        proposedSolution: "Signed bundle",
      },
    });
    const prd = rows.find((row) => row.metadata?.kind === "prd");
    expect(prd?.metadata?.live).toBe(true);
    expect(prd?.metadata?.prd?.title).toBe("Audit export PRD");
    expect(rows.some((row) => row.metadata?.kind === "stage" && row.metadata.stage === "PRD")).toBe(
      false
    );
  });

  it("shows a completed-run summary after Ananta and Neel finish", () => {
    const rows = buildReleaseMessages(
      { ...analysis, status: "COMPLETED", generatedPrd: { title: "Audit export PRD" } },
      {
        pipelineId: "pl_1",
        status: "COMPLETED",
        currentStage: "OUTPUT",
        currentStageLabel: "Done",
        startedAt: "2026-08-26T00:20:00.000Z",
      },
      {
        engineeringRun: {
          pipelineId: "pl_1",
          status: "COMPLETED",
          implementationBranch: "agentos/plt-42",
          files: [{ path: "src/export.ts", change: "created" }],
        },
        qaReport: {
          pipelineId: "pl_1",
          testSummary: "Covered export + reload",
          coverageReport: { coveragePercent: 88 },
          testRun: { passed: 10, failed: 0 },
          recommendation: "ship",
        },
      }
    );
    const summary = rows.find((row) => row.metadata?.kind === "run_summary");
    expect(summary?.metadata?.markedCompleted).toBe(true);
    expect(summary?.metadata?.branch).toBe("agentos/plt-42");
    expect(summary?.metadata?.whatWasDone?.some((line) => /marked completed/i.test(line))).toBe(true);
  });

  it("keeps PRD, code, and QA artifacts even when their chat text is empty", () => {
    const merged = mergeReleaseMessages(
      [],
      { ...analysis, status: "COMPLETED", generatedPrd: { title: "Audit export PRD" } },
      {
        pipelineId: "pl_1",
        status: "RUNNING",
        currentStage: "QA_AGENT",
        currentStageLabel: "Neel",
        currentAction: "Neel is running tests",
        startedAt: "2026-08-26T00:20:00.000Z",
      },
      {
        engineeringRun: {
          pipelineId: "pl_1",
          files: [{ path: "src/export.ts", change: "created" }],
        },
        qaReport: {
          pipelineId: "pl_1",
          coverageReport: { coveragePercent: 88 },
          testRun: { passed: 10, failed: 1 },
        },
      }
    );
    expect(merged.filter((row) => row.metadata?.kind === "prd")).toHaveLength(1);
    expect(merged.filter((row) => row.metadata?.kind === "ananta")).toHaveLength(1);
    expect(merged.filter((row) => row.metadata?.kind === "qa")).toHaveLength(1);
  });
});
