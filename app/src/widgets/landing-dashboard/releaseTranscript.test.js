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

    expect(rows.some((row) => row.metadata?.domain === "ananta" && /export\.ts/.test(row.content))).toBe(
      true
    );
    expect(rows.some((row) => row.metadata?.kind === "pr" && row.metadata.domain === "ananta")).toBe(true);
    expect(rows.some((row) => row.metadata?.domain === "neel" && /88%/.test(row.content))).toBe(true);
    expect(rows.some((row) => row.metadata?.domain === "neel" && row.metadata.kind === "issue")).toBe(true);
  });
});
