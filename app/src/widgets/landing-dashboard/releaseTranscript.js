import { PM_STAGE_LABELS, PM_STAGE_ORDER, VIRIN_MAX_DISCOVERY_TURNS } from "../../entities/pm-agents";
import { STAGE_LABELS, STAGE_ORDER } from "../../shared/config/app";
import { pipelineMatchesAgentStage } from "../../shared/lib/agentPipelineStages";
import { mergeVirinDiscoveryMessages } from "../pm-analysis/virinChatTranscript";

export function stripChatContext(content) {
  return String(content ?? "")
    .replace(/^Context:[\s\S]*?\n\n/, "")
    .trim();
}

export function shouldStartVirinRelease(analysis, domain, ticketKey) {
  if (domain !== "virin" || !ticketKey) return false;
  if (!analysis) return true;
  const status = analysis.status;
  return !status || status === "CANCELLED";
}

function asText(value) {
  if (!value) return "";
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) return value.filter(Boolean).join("\n");
  if (typeof value === "object") {
    return Object.values(value)
      .filter((item) => typeof item === "string" && item.trim())
      .join("\n");
  }
  return String(value);
}

function clip(text, max = 420) {
  const value = asText(text);
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).trim()}…`;
}

export function summarizeStage(analysis, stage) {
  if (!analysis) return "";
  switch (stage) {
    case "INTAKE": {
      const intake = analysis.neelIntake;
      const type = intake?.ticketType || analysis.classification?.type;
      const summary = intake?.oneLiner || intake?.summary || analysis.ticketInput?.summary;
      return [type ? `Classified as **${type}**.` : "Intake complete.", clip(summary)]
        .filter(Boolean)
        .join(" ");
    }
    case "QUESTION_MODE":
      return clip(
        analysis.questionMode?.discoverySummary ||
          "Discovery answers are in. Moving on with a clearer picture of the requirement."
      );
    case "COMPETITOR_ANALYSIS":
      return clip(
        analysis.competitorAnalysis?.summary ||
          analysis.competitorAnalysis?.positioning ||
          "Competitor scan complete."
      );
    case "CODEBASE_ANALYSIS": {
      const code = analysis.codebaseAnalysis;
      const verdict = code?.overlapVerdict ? `Overlap: **${code.overlapVerdict}**.` : "";
      return [verdict, clip(code?.alreadyShippedNote || code?.summary || "Codebase analysis complete.")]
        .filter(Boolean)
        .join(" ");
    }
    case "SYSTEM_DESIGN":
      return clip(analysis.systemDesign?.summary || analysis.systemDesign?.overview || "System design drafted.");
    case "TASK_PLANNING": {
      const count = analysis.taskBreakdown?.tasks?.length ?? analysis.handoffPackage?.engineeringTickets?.length;
      return count
        ? `Broke the work into **${count}** engineering ticket${count === 1 ? "" : "s"}.`
        : clip(analysis.taskBreakdown?.summary || "Task plan ready.");
    }
    case "SOLUTIONING":
      return clip(
        analysis.solutioning?.recommendedApproach ||
          analysis.solutioning?.summaryMarkdown ||
          analysis.solutioning?.problemStatement ||
          "Solution direction is ready for your confirmation."
      );
    case "PRD":
      return analysis.generatedPrd
        ? `Finished the PRD: **${analysis.generatedPrd.title}**.`
        : "PRD generated.";
    case "HANDOFF": {
      const tickets = analysis.handoffPackage?.engineeringTickets ?? [];
      return tickets.length
        ? `Handoff package ready with **${tickets.length}** ticket${tickets.length === 1 ? "" : "s"} for Ananta.`
        : "Engineering handoff package is ready.";
    }
    default:
      return `${PM_STAGE_LABELS[stage] ?? stage} complete.`;
  }
}

function thinkingForStage(analysis, stage) {
  const label = PM_STAGE_LABELS[stage] ?? stage;
  const lines = [`Finished ${label.toLowerCase()}.`];
  if (stage === "INTAKE" && analysis.neelIntake?.ticketType) {
    lines.push(`Ticket type looks like ${analysis.neelIntake.ticketType}.`);
  }
  if (stage === "CODEBASE_ANALYSIS" && analysis.codebaseAnalysis?.overlapVerdict) {
    lines.push(`Checked the repo for overlap (${analysis.codebaseAnalysis.overlapVerdict}).`);
  }
  return lines;
}

export function liveThinkingAgent(analysis, livePipeline) {
  const stage = livePipeline?.currentStage;
  if (pipelineMatchesAgentStage(stage, "neel")) return "neel";
  if (pipelineMatchesAgentStage(stage, "ananta")) return "ananta";
  if (analysis?.status === "RUNNING" || pipelineMatchesAgentStage(stage, "virin")) return "virin";
  if (livePipeline?.status === "RUNNING") return "ananta";
  return "virin";
}

export function liveThinkingLines(analysis, livePipeline, extras = {}) {
  const lines = [];
  const agent = liveThinkingAgent(analysis, livePipeline);
  const stage = analysis?.currentStage;
  if (agent === "virin" && stage) lines.push(`Working on ${PM_STAGE_LABELS[stage] ?? stage}.`);
  if (livePipeline?.currentAction) lines.push(livePipeline.currentAction);
  for (const step of livePipeline?.discoverySteps ?? []) {
    if (step.status === "RUNNING" || step.status === "COMPLETED") {
      lines.push(`${step.label}${step.status === "RUNNING" ? "…" : ""}`);
    }
  }
  for (const event of (livePipeline?.thoughtProcess ?? []).slice(-6)) {
    const text = event.label || event.detail;
    if (text) lines.push(text);
  }
  for (const step of extras.engineeringRun?.liveSteps ?? []) {
    if (step.status === "in_progress" || step.status === "complete") {
      lines.push(`${step.label}${step.detail ? ` — ${step.detail}` : ""}`);
    }
  }
  for (const event of (extras.engineeringRun?.recentEvents ?? []).slice(0, 4)) {
    if (event.summary) lines.push(event.summary);
  }
  if (extras.qaReport?.executionMessage) lines.push(extras.qaReport.executionMessage);
  for (const thought of extras.codingThoughts ?? []) {
    lines.push(thought);
  }
  return [...new Set(lines.map((line) => String(line).trim()).filter(Boolean))];
}

function buildAnantaMessages(key, engineeringRun, livePipeline) {
  const run = engineeringRun;
  const codingStage = livePipeline?.currentStage || run?.currentStage;
  const anantaLive =
    pipelineMatchesAgentStage(codingStage, "ananta") &&
    (run?.status === "RUNNING" || livePipeline?.status === "RUNNING");
  if (!run && !pipelineMatchesAgentStage(livePipeline?.currentStage, "ananta")) return [];
  const rows = [];
  const at = run?.recentEvents?.[0]?.timestamp || livePipeline?.startedAt || new Date().toISOString();

  if (run || livePipeline) {
    const files = run?.files ?? [];
    const plan = asText(run?.implementationPlan?.summary || run?.implementationPlan?.approach);
    rows.push({
      id: `release-ananta-${key}-${run?.pipelineId || livePipeline?.pipelineId || "live"}`,
      role: "assistant",
      content: "",
      createdAt: at,
      metadata: {
        kind: "ananta",
        domain: "ananta",
        live: anantaLive,
        files,
        liveSteps: run?.liveSteps ?? [],
        plan: plan ? clip(plan, 420) : "",
        status: run?.status || livePipeline?.status,
        currentAction: livePipeline?.currentAction || run?.currentStageLabel,
        prUrl: run?.prUrl || run?.pr?.url,
        prNumber: run?.prNumber,
        implementationBranch: run?.implementationBranch || run?.branch,
        thinking: (run?.liveSteps ?? [])
          .filter((step) => step.status !== "pending")
          .map((step) => step.label),
        thinkingLabel: anantaLive ? "Thinking" : "Thought process",
        jiraKey: key,
        pipelineId: run?.pipelineId || livePipeline?.pipelineId,
      },
    });
  }

  const prUrl = run?.prUrl || run?.pr?.url;
  if (prUrl) {
    const label = run.prNumber ? `PR #${run.prNumber}` : "pull request";
    rows.push({
      id: `release-pr-${key}`,
      role: "assistant",
      content: `Opened ${run.prDraft || run.pr?.draft ? "a draft " : ""}${label}: [${label}](${prUrl}).`,
      createdAt: at,
      metadata: { kind: "pr", domain: "ananta", url: prUrl, jiraKey: key },
    });
  }

  if (run?.failureReason) {
    rows.push({
      id: `release-ananta-fail-${key}`,
      role: "assistant",
      content: run.failureReason,
      createdAt: at,
      metadata: {
        kind: "issue",
        domain: "ananta",
        tone: "danger",
        title: "Ananta hit a problem",
        resumeKind: run.canResume ? "pipeline" : undefined,
        pipelineId: run.pipelineId,
        jiraKey: key,
      },
    });
  }

  const implGate = livePipeline?.currentStage === "IMPLEMENTATION_VALIDATION";
  if (implGate && (livePipeline.status === "PAUSED" || livePipeline.blockReason)) {
    rows.push({
      id: `release-ananta-gate-${key}`,
      role: "assistant",
      content: livePipeline.blockReason || "Implementation gate is waiting before Neel can start QA.",
      createdAt: livePipeline.startedAt || at,
      metadata: {
        kind: "issue",
        domain: "ananta",
        tone: "warning",
        title: "Ananta needs a review before QA",
        resumeKind: "pipeline",
        pipelineId: livePipeline.pipelineId,
        jiraKey: key,
      },
    });
  }

  return rows;
}

function buildNeelMessages(key, qaReport, livePipeline) {
  const neelStage = pipelineMatchesAgentStage(livePipeline?.currentStage, "neel");
  const neelLive =
    (neelStage && livePipeline?.status === "RUNNING") ||
    qaReport?.inProgress ||
    qaReport?.executionStatus === "running" ||
    qaReport?.executionStatus === "pending";
  if (!qaReport && !neelStage) return [];
  const rows = [];
  const at = qaReport?.completedAt || livePipeline?.startedAt || new Date().toISOString();
  const coverage = qaReport?.coverageReport;
  const failures = qaReport?.failureAnalysis ?? [];
  const run = qaReport?.testRun;

  if (neelStage || qaReport) {
    rows.push({
      id: `release-neel-${key}-${qaReport?.pipelineId || livePipeline?.pipelineId || "live"}`,
      role: "assistant",
      content: "",
      createdAt: at,
      metadata: {
        kind: "qa",
        domain: "neel",
        live: neelLive,
        coverage,
        testRun: run,
        testCases: qaReport?.testCases ?? [],
        recommendation: qaReport?.recommendation,
        executionMessage: qaReport?.executionMessage || livePipeline?.currentAction,
        thinkingLabel: neelLive ? "Thinking" : "Thought process",
        thinking: [qaReport?.executionMessage, livePipeline?.currentAction].filter(Boolean),
        jiraKey: key,
        pipelineId: qaReport?.pipelineId || livePipeline?.pipelineId,
      },
    });
  }

  if (failures.length > 0) {
    rows.push({
      id: `release-qa-failures-${key}`,
      role: "assistant",
      content: failures
        .slice(0, 6)
        .map((item) => `- **${item.testName || item.testId}** — ${item.likelyCause || item.remediation || item.severity || "failed"}`)
        .join("\n"),
      createdAt: at,
      metadata: {
        kind: "issue",
        domain: "neel",
        tone: "warning",
        title: `${failures.length} QA failure${failures.length === 1 ? "" : "s"}`,
        resumeKind: livePipeline?.status === "PAUSED" ? "pipeline" : undefined,
        pipelineId: qaReport?.pipelineId || livePipeline?.pipelineId,
        jiraKey: key,
      },
    });
  }

  if (qaReport?.requiresHumanOverride || (neelStage && livePipeline?.status === "PAUSED")) {
    rows.push({
      id: `release-qa-gate-${key}`,
      role: "assistant",
      content:
        livePipeline?.blockReason ||
        qaReport?.executionMessage ||
        "QA is paused until you review and continue.",
      createdAt: at,
      metadata: {
        kind: "issue",
        domain: "neel",
        tone: "warning",
        title: "Neel needs you",
        resumeKind: "pipeline",
        pipelineId: qaReport?.pipelineId || livePipeline?.pipelineId,
        jiraKey: key,
      },
    });
  }

  return rows;
}

export function shouldStartAnantaHandoff(analysis, domain, ticketKey) {
  if (domain !== "ananta" || !ticketKey || !analysis) return false;
  if (analysis.status !== "COMPLETED") return false;
  const status = analysis.engineeringHandoff?.status;
  return !status || status === "not_started" || status === "pending" || status === "failed";
}

export function buildReleaseMessages(analysis, livePipeline = null, extras = {}) {
  if (!analysis && !livePipeline && !extras.engineeringRun && !extras.qaReport) return [];
  const key = analysis?.jiraKey || analysis?.ticketId || livePipeline?.jiraKey || extras.engineeringRun?.jiraKey || "ticket";
  const rows = [];

  if (analysis) {
    const startedAt = analysis.startedAt ?? analysis.updatedAt ?? new Date().toISOString();
    rows.push({
      id: `release-start-${key}`,
      role: "assistant",
      content: `Starting a release thread for **${key}**. Virin will run discovery, Ananta will implement, and Neel will QA — all in this chat.`,
      createdAt: startedAt,
      metadata: { kind: "release_start", domain: "virin", jiraKey: key },
    });

    for (const meta of analysis.stageMeta ?? []) {
      if (meta.status === "FAILED") {
        rows.push({
          id: `release-issue-stage-${key}-${meta.stage}`,
          role: "assistant",
          content: meta.error || `${PM_STAGE_LABELS[meta.stage] ?? meta.stage} failed.`,
          createdAt: meta.completedAt ?? meta.startedAt ?? analysis.updatedAt,
          metadata: {
            kind: "issue",
            tone: "danger",
            title: `${PM_STAGE_LABELS[meta.stage] ?? meta.stage} failed`,
            stage: meta.stage,
            resumeFrom: meta.stage,
            domain: "virin",
            jiraKey: key,
          },
        });
        continue;
      }
      if (meta.status !== "COMPLETED") continue;
      if (meta.stage === "PRD" && analysis.generatedPrd) continue;
      rows.push({
        id: `release-stage-${key}-${meta.stage}`,
        role: "assistant",
        content: summarizeStage(analysis, meta.stage),
        createdAt: meta.completedAt ?? meta.startedAt ?? analysis.updatedAt,
        metadata: {
          kind: "stage",
          stage: meta.stage,
          thinking: thinkingForStage(analysis, meta.stage),
          thinkingLabel: "Thought process",
          domain: "virin",
          jiraKey: key,
        },
      });
    }

    for (const blocker of (analysis.humanBlockers ?? []).filter((item) => !item.resolvedAt)) {
      rows.push({
        id: `release-blocker-${blocker.id || blocker.title}`,
        role: "assistant",
        content: [blocker.title, blocker.detail].filter(Boolean).join("\n\n"),
        createdAt: blocker.createdAt ?? analysis.updatedAt,
        metadata: {
          kind: "issue",
          tone: "warning",
          title: blocker.title || "Virin needs input",
          domain: "virin",
          blockerKind: blocker.kind,
          jiraKey: key,
        },
      });
    }

    if (analysis.status === "FAILED" && analysis.error) {
      rows.push({
        id: `release-failed-${key}`,
        role: "assistant",
        content: analysis.error,
        createdAt: analysis.updatedAt ?? analysis.completedAt,
        metadata: {
          kind: "issue",
          tone: "danger",
          title: "Release stopped",
          domain: "virin",
          resumeFrom: analysis.currentStage,
          jiraKey: key,
        },
      });
    }

    if (analysis.status === "AWAITING_CONFIRMATION") {
      const gateIssues = analysis.gateResults?.virin_prd?.issues ?? [];
      if (analysis.pendingPrdGate) {
        rows.push({
          id: `release-prd-gate-${key}`,
          role: "assistant",
          content:
            gateIssues.map((issue) => issue.message).filter(Boolean).join("\n") ||
            "PRD validation failed. Override to continue, or ask Virin to revise.",
          createdAt: analysis.updatedAt,
          metadata: {
            kind: "confirm",
            variant: "prd_gate",
            title: "PRD validation failed",
            domain: "virin",
            jiraKey: key,
          },
        });
      } else if (analysis.solutioning) {
        rows.push({
          id: `release-confirm-${key}`,
          role: "assistant",
          content: clip(
            analysis.solutioning.recommendedApproach ||
              analysis.solutioning.summaryMarkdown ||
              analysis.solutioning.problemStatement,
            800
          ),
          createdAt: analysis.updatedAt,
          metadata: {
            kind: "confirm",
            variant: "solution",
            title: "Confirm solution direction",
            domain: "virin",
            problem: analysis.solutioning.problemStatement,
            jiraKey: key,
          },
        });
      }
    }

    if (analysis.generatedPrd) {
      const prd = analysis.generatedPrd;
      const prdLive = analysis.status === "RUNNING" && analysis.currentStage === "PRD";
      rows.push({
        id: `release-prd-${key}`,
        role: "assistant",
        content: "",
        createdAt: prd.createdAt ?? analysis.completedAt ?? analysis.updatedAt,
        metadata: {
          kind: "prd",
          domain: "virin",
          jiraKey: key,
          title: prd.title,
          prd,
          live: prdLive,
          thinking: thinkingForStage(analysis, "PRD"),
          thinkingLabel: prdLive ? "Thinking" : "Thought process",
        },
      });
    }

    const tickets = analysis.handoffPackage?.engineeringTickets ?? [];
    if (tickets.length > 0 && (analysis.status === "COMPLETED" || analysis.currentStage === "HANDOFF")) {
      const handoff = analysis.engineeringHandoff;
      rows.push({
        id: `release-handoff-${key}`,
        role: "assistant",
        content: tickets
          .slice(0, 8)
          .map((ticket, index) => `${index + 1}. **${ticket.id || ticket.title}** — ${ticket.title}`)
          .join("\n"),
        createdAt: analysis.completedAt ?? analysis.updatedAt,
        metadata: {
          kind: "handoff",
          domain: "virin",
          jiraKey: key,
          tickets,
          handoffStatus: handoff?.status ?? "not_started",
          pipelineId: handoff?.pipelineId,
        },
      });
    }
  }

  if (livePipeline) {
    const pipelineAgent = liveThinkingAgent(analysis, livePipeline);
    rows.push({
      id: `release-pipeline-${key}-${livePipeline.pipelineId}`,
      role: "assistant",
      content: livePipeline.currentAction || `Pipeline at ${livePipeline.currentStageLabel}.`,
      createdAt: livePipeline.startedAt ?? analysis?.updatedAt,
      metadata: {
        kind: "pipeline",
        domain: pipelineAgent,
        jiraKey: key,
        currentStage: livePipeline.currentStage,
        status: livePipeline.status,
        pipelineId: livePipeline.pipelineId,
        stageProgress: livePipeline.stageProgress,
        currentStageLabel: livePipeline.currentStageLabel,
      },
    });
    const specializedPause =
      pipelineMatchesAgentStage(livePipeline.currentStage, "ananta") ||
      pipelineMatchesAgentStage(livePipeline.currentStage, "neel");
    if (!specializedPause && (livePipeline.status === "PAUSED" || livePipeline.blockReason)) {
      rows.push({
        id: `release-pipeline-block-${key}`,
        role: "assistant",
        content: livePipeline.blockReason || livePipeline.currentAction || "The coding pipeline is paused.",
        createdAt: analysis?.updatedAt ?? livePipeline.startedAt,
        metadata: {
          kind: "issue",
          domain: pipelineAgent,
          tone: "warning",
          title: "Pipeline needs you",
          resumeKind: "pipeline",
          pipelineId: livePipeline.pipelineId,
          jiraKey: key,
        },
      });
    }
    if (!specializedPause && livePipeline.status === "FAILED") {
      rows.push({
        id: `release-pipeline-fail-${key}`,
        role: "assistant",
        content: livePipeline.currentAction || "The coding pipeline failed.",
        createdAt: analysis?.updatedAt ?? livePipeline.startedAt,
        metadata: {
          kind: "issue",
          domain: pipelineAgent,
          tone: "danger",
          title: "Pipeline failed",
          resumeKind: "pipeline",
          pipelineId: livePipeline.pipelineId,
          jiraKey: key,
        },
      });
    }
  }

  rows.push(...buildAnantaMessages(key, extras.engineeringRun, livePipeline));
  rows.push(...buildNeelMessages(key, extras.qaReport, livePipeline));

  const runDone =
    extras.engineeringRun?.status === "COMPLETED" || livePipeline?.status === "COMPLETED";
  if (runDone) {
    const run = extras.engineeringRun;
    const qa = extras.qaReport;
    const prUrl = run?.prUrl || run?.pr?.url;
    const branch = run?.implementationBranch || run?.branch || "";
    const files = (run?.files ?? []).map((file) => file.path || file.filePath).filter(Boolean);
    const whatWasDone = [
      analysis?.generatedPrd?.title ? `Virin finished the PRD: ${analysis.generatedPrd.title}.` : null,
      branch ? `Ananta wrote code on GitHub branch ${branch}.` : "Ananta wrote the implementation.",
      files.length ? `Changed ${files.length} file${files.length === 1 ? "" : "s"}.` : null,
      qa?.testSummary || qa?.coverageReport
        ? `Neel ran QA${typeof qa?.coverageReport?.coveragePercent === "number" ? ` (${qa.coverageReport.coveragePercent}% coverage)` : ""}.`
        : "Neel finished QA.",
      "Ticket marked completed.",
    ].filter(Boolean);
    rows.push({
      id: `release-writeback-${key}`,
      role: "assistant",
      content: whatWasDone.join(" "),
      createdAt: run?.recentEvents?.[0]?.timestamp || analysis?.completedAt || livePipeline?.startedAt,
      metadata: {
        kind: "run_summary",
        domain: "neel",
        jiraKey: key,
        branch,
        prUrl,
        prNumber: run?.prNumber,
        files,
        codingSummary: run?.implementationPlan?.summary || "",
        qaSummary: qa?.testSummary || "",
        coverage: qa?.coverageReport,
        testRun: qa?.testRun,
        recommendation: qa?.recommendation,
        whatWasDone,
        markedCompleted: true,
      },
    });
  }

  const codingStarted = Boolean(livePipeline || extras.engineeringRun);
  if (analysis?.status === "COMPLETED" && !codingStarted) {
    rows.push({
      id: `release-complete-${key}`,
      role: "assistant",
      content: `Virin is done with **${key}**. Send this to Ananta from here to start coding and QA.`,
      createdAt: analysis.completedAt ?? analysis.updatedAt,
      metadata: { kind: "release_complete", domain: "virin", jiraKey: key },
    });
  }

  return rows;
}

export function mergeReleaseMessages(messages, analysis, livePipeline = null, extras = {}) {
  const withDiscovery = mergeVirinDiscoveryMessages(messages, analysis);
  const release = buildReleaseMessages(analysis, livePipeline, extras);
  if (release.length === 0) return withDiscovery;

  const seenIds = new Set(withDiscovery.map((msg) => msg.id));
  const seenText = new Set(
    withDiscovery.map((msg) => `${msg.role}:${String(msg.content ?? "").replace(/\s+/g, " ").trim().toLowerCase()}`)
  );
  const extrasRows = release.filter((msg) => {
    if (seenIds.has(msg.id)) return false;
    const text = String(msg.content ?? "").replace(/\s+/g, " ").trim().toLowerCase();
    if (!text) return true;
    const key = `${msg.role}:${text}`;
    if (seenText.has(key)) return false;
    seenText.add(key);
    return true;
  });

  return [...withDiscovery, ...extrasRows].sort((a, b) => {
    const aTime = new Date(a.createdAt ?? 0).getTime();
    const bTime = new Date(b.createdAt ?? 0).getTime();
    if (aTime !== bTime) return aTime - bTime;
    return String(a.id).localeCompare(String(b.id));
  });
}

export function releaseProgress(analysis, livePipeline, engineeringRun) {
  const pipelineStage = livePipeline?.currentStage || engineeringRun?.currentStage;
  const pipelineStatus = livePipeline?.status || engineeringRun?.status;
  if (pipelineStage && (analysis?.status === "COMPLETED" || !analysis)) {
    const idx = STAGE_ORDER.indexOf(pipelineStage);
    const codingPct =
      pipelineStatus === "COMPLETED"
        ? 100
        : Math.round(((Math.max(idx, 0) + 0.45) / STAGE_ORDER.length) * 100);
    return {
      label: STAGE_LABELS[pipelineStage] ?? pipelineStage,
      pct: Math.min(100, Math.max(codingPct, 8)),
      current: pipelineStage,
      status: pipelineStatus,
      agent: liveThinkingAgent(analysis, livePipeline || engineeringRun),
    };
  }
  if (!analysis) return null;
  const current = analysis.currentStage;
  const done = (analysis.stageMeta ?? []).filter((meta) => meta.status === "COMPLETED").length;
  const total = PM_STAGE_ORDER.length;
  const virinPct =
    analysis.status === "COMPLETED"
      ? 50
      : Math.round(((done + (analysis.status === "RUNNING" ? 0.45 : 0)) / total) * 50);
  return {
    label: current ? PM_STAGE_LABELS[current] : "Starting",
    pct: Math.min(100, Math.max(virinPct, analysis.status === "RUNNING" ? 8 : 0)),
    current,
    status: analysis.status,
    agent: "virin",
    discoveryTurn:
      analysis.status === "AWAITING_INPUT"
        ? (analysis.questionMode?.conversation?.length ?? 0) + 1
        : null,
    maxTurns: analysis.questionMode?.maxTurns ?? VIRIN_MAX_DISCOVERY_TURNS,
  };
}

export function pipelineStageLabel(stage) {
  return STAGE_LABELS[stage] ?? stage;
}
