import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  useQaCoverage,
  useQaHeatmap,
  useQaFailures,
  useQaInbox,
  useQaPipelineReport,
} from "../../entities/qa";
import { TestCaseViewer } from "../../widgets/qa/TestCaseViewer";
import {
  triggerCanaryRun,
  useCanaryRuns,
} from "../../entities/canary";
import { useEngineeringCodingEvents } from "../../entities/engineering-agent";
import { useSettings } from "../../entities/settings";
import { useOrgPathBuilder } from "../../shared/providers/OrgRouteProvider";
import { Panel, PanelHeader } from "../../shared/ui/Panel";
import { AppTabButton } from "../../shared/ui/AppChrome";
import { AnimatedAppPage } from "../../shared/ui/AnimatedAppPage";
import { AgentPageWithChat } from "../../widgets/agent-chat/AgentPageWithChat";
import { AgentPageHeader } from "../../widgets/agent-chat/AgentPageHeader";
import AgentPipelineLiveStatus from "../../shared/components/AgentPipelineLiveStatus";
import { AGENT_NAMES } from "../../shared/config/app";
import { pipelineAdapter } from "../../entities/pipeline";
import ToolArtifactsPanel from "../../widgets/tool-artifacts/ToolArtifactsPanel";

const RECOMMENDATION_STYLES = {
  approve: { border: "border-success/40 bg-success/10", text: "text-success", icon: "✓", label: "Approved — ready to merge" },
  approve_with_conditions: { border: "border-warning/40 bg-warning/10", text: "text-warning", icon: "⚠", label: "Approved with conditions" },
  request_changes: { border: "border-danger/40 bg-danger/10", text: "text-danger", icon: "✗", label: "Changes requested" },
  block: { border: "border-danger/40 bg-danger/10", text: "text-danger", icon: "🚫", label: "Blocked — do not merge" },
};

function RecommendationBanner({ recommendation }) {
  if (!recommendation) return null;
  const style = RECOMMENDATION_STYLES[recommendation] ?? RECOMMENDATION_STYLES.approve_with_conditions;
  return (
    <div className={`mx-5 mt-4 flex items-center gap-3 rounded-app-sm border px-4 py-3 ${style.border}`}>
      <span className="text-lg">{style.icon}</span>
      <div>
        <p className={`text-sm font-semibold ${style.text}`}>{style.label}</p>
        <p className="text-[11px] text-app-ink-mute">QA recommendation — {recommendation.replace(/_/g, " ")}</p>
      </div>
    </div>
  );
}

function TestRunStats({ testRun, coverageReport, confidenceScore }) {
  if (!testRun && !coverageReport) return null;
  return (
    <div className="grid grid-cols-2 gap-3 px-5 py-4 sm:grid-cols-4">
      {testRun ? (
        <>
          <StatCard label="Passed" value={testRun.passed ?? 0} color="text-success" />
          <StatCard label="Failed" value={testRun.failed ?? 0} color="text-danger" />
          <StatCard label="Total tests" value={testRun.totalTests ?? 0} />
          <StatCard label="Duration" value={testRun.duration ? `${(testRun.duration / 1000).toFixed(1)}s` : "—"} />
        </>
      ) : null}
      {coverageReport ? (
        <>
          <StatCard
            label="Criteria coverage"
            value={`${coverageReport.coveragePercent?.toFixed(1)}%`}
            color={coverageReport.coveragePercent >= 95 ? "text-success" : coverageReport.coveragePercent >= 80 ? "text-warning" : "text-danger"}
          />
          <StatCard label="Covered" value={`${coverageReport.coveredCriteria} / ${coverageReport.totalCriteria}`} />
          {confidenceScore != null ? (
            <StatCard label="Confidence" value={`${(confidenceScore * 100).toFixed(0)}%`} />
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function StatCard({ label, value, color = "text-app-ink" }) {
  return (
    <div className="rounded-app-sm border border-app-border bg-app-surface-muted/30 px-3 py-2.5">
      <p className="type-kicker">{label}</p>
      <p className={`type-metric mt-1 ${color}`}>{value}</p>
    </div>
  );
}

function ConfidenceBreakdownPanel({ breakdown, reason, executionStatus, executionMessage }) {
  if (!breakdown?.breakdown?.length && !executionStatus) return null;
  return (
    <div className="border-t border-app-border px-5 py-4">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-app-ink-mute">
        Explainable confidence
      </p>
      {reason ? <p className="mb-3 text-[12px] text-app-ink-dim">{reason}</p> : null}
      {executionStatus && executionStatus !== "ran" ? (
        <p className="mb-3 rounded-app-sm border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
          Execution: {executionStatus}
          {executionMessage ? ` — ${executionMessage}` : ""}
        </p>
      ) : null}
      {breakdown?.breakdown?.length ? (
        <ul className="space-y-2">
          {breakdown.breakdown.map((row) => (
            <li key={row.id} className="flex items-center justify-between gap-3 text-xs">
              <span className="text-app-ink-dim">{row.label}</span>
              <span className="font-mono text-app-ink">
                {(row.value * 100).toFixed(0)}% × {row.weight.toFixed(2)} ={" "}
                {(row.contribution * 100).toFixed(1)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {breakdown?.scorePercent != null ? (
        <p className="mt-3 text-sm font-semibold text-app-ink">
          Composite: {breakdown.scorePercent}/100
          {breakdown.testsNotExecuted ? " (capped — tests not executed)" : ""}
        </p>
      ) : null}
    </div>
  );
}

function CoverageGapsSection({ gaps }) {
  if (!gaps?.length) return null;
  return (
    <div className="border-t border-app-border px-5 py-4">
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-app-ink-mute">
        Coverage gaps ({gaps.length})
      </p>
      <ul className="space-y-2">
        {gaps.map((g) => (
          <li key={g.id} className="rounded-app-sm border border-warning/30 bg-warning/5 px-3 py-2.5 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono font-semibold">{g.id}</span>
              <span className="rounded-full border px-1.5 py-0.5 text-[10px] uppercase opacity-70">
                {g.severity}
              </span>
              <span className="type-kicker">{g.suggestedTestType}</span>
            </div>
            <p className="mt-1 font-medium text-app-ink">{g.criterion}</p>
            <p className="mt-1 text-app-ink-dim">{g.reason}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function HealProposalsSection({ proposals }) {
  if (!proposals?.length) return null;
  return (
    <div className="border-t border-app-border px-5 py-4">
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-app-ink-mute">
        Locator heal proposals ({proposals.length}) — review before merge
      </p>
      <ul className="space-y-2">
        {proposals.map((h, i) => (
          <li key={`${h.testFile}-${i}`} className="rounded-app-sm border border-indigo/30 bg-indigo/5 px-3 py-2.5 text-xs">
            <p className="font-medium text-app-ink">
              {h.testName}{" "}
              {h.requiresHumanReview ? (
                <span className="text-warning">· needs human review</span>
              ) : (
                <span className="text-success">· auto-heal candidate</span>
              )}
            </p>
            <p className="mt-1 font-mono text-app-ink-dim">
              {h.oldPrimary} → {h.proposedPrimary} ({(h.confidence * 100).toFixed(0)}%)
            </p>
            <p className="mt-1 text-app-ink-dim">{h.rationale}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FailureAnalysisSection({ failures }) {
  if (!failures?.length) return null;
  return (
    <div className="border-t border-app-border px-5 py-4">
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-app-ink-mute">
        Failure triage ({failures.length})
      </p>
      <ul className="space-y-2">
        {failures.map((f) => (
          <li
            key={f.testId}
            className={`rounded-app-sm border px-3 py-2.5 text-xs ${SEVERITY_STYLES[f.severity] ?? SEVERITY_STYLES.medium}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-mono font-semibold">{f.testId}</p>
              <div className="flex flex-wrap gap-1">
                {f.triageClass ? (
                  <span className="rounded-full border px-1.5 py-0.5 text-[10px] uppercase tracking-wide opacity-70">
                    {f.triageClass}
                  </span>
                ) : null}
                <span className="rounded-full border px-1.5 py-0.5 text-[10px] uppercase tracking-wide opacity-70">
                  {f.severity}
                </span>
              </div>
            </div>
            <p className="mt-1 font-medium">{f.testName}</p>
            {f.requiresHumanOverride ? (
              <p className="mt-1 font-semibold text-warning">Human override required before approve</p>
            ) : null}
            {f.violatedCriterion ? (
              <p className="mt-1 opacity-80">AC: {f.violatedCriterion}</p>
            ) : null}
            {f.likelyCause ? <p className="mt-1 opacity-80">Cause: {f.likelyCause}</p> : null}
            {f.evidence?.length ? (
              <p className="mt-1 opacity-80">Evidence: {f.evidence.join("; ")}</p>
            ) : null}
            {f.remediation ? (
              <p className="mt-1.5 font-medium text-app-ink">Fix: {f.remediation}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function SecurityScanSection({ securityScan }) {
  if (!securityScan) return null;
  const { criticalCount = 0, highCount = 0, findings = [] } = securityScan;
  const clean = criticalCount === 0 && highCount === 0;
  return (
    <div className="border-t border-app-border px-5 py-4">
      <div className="flex items-center gap-3 mb-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-app-ink-mute">
          Security scan
        </p>
        <span
          className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${
            clean ? "border-success/30 text-success" : "border-danger/30 text-danger"
          }`}
        >
          {clean ? "Clean" : `${criticalCount} critical · ${highCount} high`}
        </span>
      </div>
      {findings.length > 0 ? (
        <ul className="space-y-1.5">
          {findings.slice(0, 5).map((f, i) => (
            <li key={i} className={`rounded-app-sm border px-3 py-2 text-xs ${SEVERITY_STYLES[f.severity] ?? SEVERITY_STYLES.medium}`}>
              <p className="font-medium">{f.title}</p>
              {f.description ? <p className="mt-0.5 opacity-80">{f.description}</p> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-app-ink-dim">No security findings.</p>
      )}
    </div>
  );
}

function UncoveredCriteria({ coverageReport }) {
  if (!coverageReport?.uncoveredCriteria?.length) return null;
  return (
    <div className="border-t border-app-border px-5 py-4">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-app-ink-mute">
        Uncovered criteria ({coverageReport.uncoveredCriteria.length})
      </p>
      <ul className="space-y-1">
        {coverageReport.uncoveredCriteria.map((c, i) => (
          <li key={i} className="flex items-start gap-2 text-xs text-warning">
            <span className="shrink-0">⚠</span>
            <span>{c}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PipelineQaDetail({ report }) {
  const emptyReport = !(report?.testCases?.length > 0) && !report?.testRun;
  const inProgress =
    report?.inProgress ||
    report?.executionStatus === "running" ||
    report?.executionStatus === "pending" ||
    report?.executionStatus === "paused";

  return (
    <Panel>
      <PanelHeader
        kicker="QA Report"
        title={report.jiraKey ?? "Pipeline report"}
        subtitle={report.testSummary}
      />
      {emptyReport && inProgress ? (
        <div className="mx-5 mt-4 rounded-app-sm border border-indigo/25 bg-indigo/5 px-4 py-3 text-[13px] text-app-ink-dim">
          {report.executionMessage ||
            "Neel is still working — coverage and pass rates appear when the QA stage completes."}
        </div>
      ) : null}
      {emptyReport && report?.executionStatus === "failed" ? (
        <div className="mx-5 mt-4 rounded-app-sm border border-danger/30 bg-danger/5 px-4 py-3 text-[13px] text-app-ink-dim">
          {report.executionMessage || "QA failed before producing a report."}
        </div>
      ) : null}
      <RecommendationBanner recommendation={report.recommendation} />
      {report.requiresHumanOverride ? (
        <div className="mx-5 mt-3 rounded-app-sm border border-warning/40 bg-warning/10 px-4 py-2 text-xs text-warning">
          Human override required — low-confidence triage, missing execution, or locator heal pending review.
        </div>
      ) : null}
      <TestRunStats
        testRun={report.testRun}
        coverageReport={report.coverageReport}
        confidenceScore={report.confidenceScore}
      />
      <ConfidenceBreakdownPanel
        breakdown={report.confidenceBreakdown}
        reason={report.confidenceReason}
        executionStatus={report.executionStatus}
        executionMessage={report.executionMessage}
      />
      <div className="border-t border-app-border">
        <TestCaseViewer testCases={report.testCases ?? []} />
      </div>
      <CoverageGapsSection gaps={report.coverageGaps} />
      <FailureAnalysisSection failures={report.failureAnalysis} />
      <HealProposalsSection proposals={report.locatorHealProposals} />
      <UncoveredCriteria coverageReport={report.coverageReport} />
      <SecurityScanSection securityScan={report.securityScan} />
      {report.playwrightSmoke ? (
        <div className="border-t border-app-border px-5 py-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-app-ink-mute">
            Playwright smoke
          </p>
          <p className="text-xs text-app-ink-dim">
            {report.playwrightSmoke.skipped
              ? report.playwrightSmoke.skipReason || "Skipped"
              : report.playwrightSmoke.passed
                ? `Passed (${report.playwrightSmoke.durationMs ?? 0}ms)`
                : "Failed — see tool artifacts"}
          </p>
        </div>
      ) : null}
      {report.riskAreas?.length ? (
        <div className="border-t border-app-border px-5 py-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-app-ink-mute">
            Risk areas
          </p>
          <ul className="space-y-1">
            {report.riskAreas.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-app-ink-dim">
                <span className="shrink-0 text-warning">⚠</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Panel>
  );
}

const CANARY_PHASE_LABELS = {
  reconnaissance: { icon: "🔭", label: "Reconnaissance — mapping endpoints and risk areas" },
  hypotheses: { icon: "🧠", label: "Generating adversarial hypotheses" },
  exploration: { icon: "⚡", label: "Probing live application — running HTTP tests" },
  synthesis: { icon: "📝", label: "Synthesising findings" },
  completed: { icon: "✓", label: "Canary complete" },
  failed: { icon: "✗", label: "Canary failed" },
};

function CanaryLivePanel({ phase, findingCount }) {
  const info = CANARY_PHASE_LABELS[phase] ?? { icon: "🔧", label: phase };
  const isDone = phase === "completed" || phase === "failed";
  return (
    <Panel>
      <div className="flex items-center gap-4 px-5 py-4">
        {!isDone && <span className="size-2 animate-pulse rounded-full bg-indigo shrink-0" />}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-app-ink-mute">
            Canary {isDone ? "" : "— Live"}
          </p>
          <p className="mt-1 text-sm font-medium text-app-ink">
            {info.icon} {info.label}
            {phase === "completed" && findingCount != null ? ` — ${findingCount} finding${findingCount !== 1 ? "s" : ""}` : ""}
          </p>
        </div>
      </div>
    </Panel>
  );
}

const HEATMAP_CELL = {
  pass: "bg-success",
  warn: "bg-warning",
  fail: "bg-danger",
  na: "bg-ink-mute/30",
};

const SEVERITY_STYLES = {
  critical: "border-danger/40 bg-danger/10 text-danger",
  high: "border-warning/40 bg-warning/10 text-warning",
  medium: "border-indigo/30 bg-indigo/5 text-indigo",
  low: "border-app-border bg-app-surface-muted/40 text-app-ink-dim",
};

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "canary", label: "Canary" },
];

function formatWhen(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return "";
  }
}

function QaInboxList({
  title,
  kicker,
  items,
  empty,
  selectedPipelineId,
  onSelect,
  orgPath,
  variant,
  onResume,
  resumeBusyId,
}) {
  return (
    <Panel>
      <PanelHeader kicker={kicker} title={title} />
      <ul className="divide-y divide-app-border">
        {items.length === 0 ? (
          <li className="px-5 py-6 text-[13px] text-app-ink-dim">{empty}</li>
        ) : (
          items.map((item) => (
            <li key={item.pipelineId}>
              <div
                className={`flex w-full flex-wrap items-center justify-between gap-3 px-5 py-3.5 ${
                  selectedPipelineId === item.pipelineId ? "bg-app-surface-muted/40" : ""
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelect(item.pipelineId)}
                  className="min-w-0 flex-1 text-left transition hover:opacity-90"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[12px] font-medium text-indigo">{item.jiraKey}</p>
                    {variant === "completed" && item.passRate != null && item.passRate >= 95 ? (
                      <span className="rounded-full border border-success/30 bg-success/10 px-1.5 py-0.5 text-[10px] font-semibold text-success">
                        {item.passRate}% pass
                      </span>
                    ) : null}
                    {variant === "completed" &&
                    item.passRate != null &&
                    item.passRate > 0 &&
                    item.passRate < 95 ? (
                      <span className="rounded-full border border-warning/30 bg-warning/10 px-1.5 py-0.5 text-[10px] font-semibold text-warning">
                        {item.passRate}% pass
                      </span>
                    ) : null}
                    {variant === "running" ? (
                      <span className="rounded-full border border-indigo/30 bg-indigo/10 px-1.5 py-0.5 text-[10px] font-semibold text-indigo">
                        {item.currentStageLabel}
                      </span>
                    ) : null}
                    {variant === "blocked" ? (
                      <span className="rounded-full border border-warning/30 bg-warning/10 px-1.5 py-0.5 text-[10px] font-semibold text-warning">
                        Needs handoff
                      </span>
                    ) : null}
                    {variant === "failed" ? (
                      <span className="rounded-full border border-danger/30 bg-danger/10 px-1.5 py-0.5 text-[10px] font-semibold text-danger">
                        Failed
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 truncate text-[13px] text-app-ink">{item.summary}</p>
                  <p className="mt-1 text-[12px] text-app-ink-dim">{item.message}</p>
                  {variant === "completed" && item.testCount != null ? (
                    <p className="mt-1 text-[12px] text-app-ink-mute">
                      {item.testCount} test case(s)
                      {item.completedAt ? ` · ${formatWhen(item.completedAt)}` : ""}
                    </p>
                  ) : null}
                </button>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {variant === "blocked" || variant === "failed" ? (
                    <>
                      <button
                        type="button"
                        disabled={resumeBusyId === item.pipelineId}
                        onClick={() => onResume?.(item.pipelineId)}
                        className="rounded-full border border-indigo/40 bg-indigo/10 px-3 py-1.5 text-[12px] font-medium text-indigo transition hover:bg-indigo/15 disabled:opacity-50"
                      >
                        {resumeBusyId === item.pipelineId
                          ? "Resuming…"
                          : variant === "failed"
                            ? "Retry"
                            : "Continue to Neel"}
                      </button>
                      <Link
                        to={orgPath("pipelines", item.pipelineId, "override")}
                        className="text-[12px] text-indigo hover:underline"
                      >
                        Override →
                      </Link>
                    </>
                  ) : null}
                  {variant === "running" ? (
                    <Link
                      to={orgPath("pipelines", item.pipelineId)}
                      className="text-[12px] text-indigo hover:underline"
                    >
                      Pipeline →
                    </Link>
                  ) : null}
                  {variant === "completed" ? (
                    <Link
                      to={orgPath("pipelines", item.pipelineId)}
                      className="text-[12px] text-indigo hover:underline"
                    >
                      Pipeline →
                    </Link>
                  ) : null}
                </div>
              </div>
            </li>
          ))
        )}
      </ul>
    </Panel>
  );
}

export default function QaCenter() {
  const orgPath = useOrgPathBuilder();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState("overview");
  const [triggering, setTriggering] = useState(false);
  const [triggerMsg, setTriggerMsg] = useState(null);
  const [selectedRunId, setSelectedRunId] = useState(null);
  const [selectedPipelineId, setSelectedPipelineId] = useState(
    () => searchParams.get("pipeline")?.trim() || null
  );
  const [resumeBusyId, setResumeBusyId] = useState(null);
  const [inboxMsg, setInboxMsg] = useState(null);

  useEffect(() => {
    const pipeline = searchParams.get("pipeline")?.trim();
    if (pipeline) setSelectedPipelineId(pipeline);
  }, [searchParams]);

  const [canaryPhase, setCanaryPhase] = useState(null); // live canary phase from SSE
  const [canaryFindingCount, setCanaryFindingCount] = useState(null);
  const { data: coverage } = useQaCoverage();
  const { data: heatmap } = useQaHeatmap();
  const { data: failures } = useQaFailures();
  const { data: inbox, refetch: refetchInbox, error: inboxError } = useQaInbox({
    pollMs: 8_000,
  });
  // Poll while a pipeline is selected and might still be running QA
  const { data: pipelineReport } = useQaPipelineReport(selectedPipelineId, { pollMs: 5_000 });
  const { data: canaryData, refetch: refetchCanary } = useCanaryRuns({ pollMs: 15_000 });
  const { data: settings } = useSettings();

  const running = inbox?.running ?? [];
  const blocked = inbox?.blocked ?? [];
  const failed = inbox?.failed ?? [];
  const completed = inbox?.completed ?? [];
  const inboxEmpty =
    running.length === 0 &&
    blocked.length === 0 &&
    failed.length === 0 &&
    completed.length === 0;

  async function handleContinueToNeel(pipelineId) {
    setResumeBusyId(pipelineId);
    setInboxMsg(null);
    try {
      await pipelineAdapter.resume(pipelineId);
      setInboxMsg("Pipeline resumed — Neel will start after the implementation gate.");
      setSelectedPipelineId(pipelineId);
      refetchInbox();
    } catch (err) {
      setInboxMsg(err instanceof Error ? err.message : "Could not resume pipeline");
    } finally {
      setResumeBusyId(null);
    }
  }

  // Live canary phase events via pipeline SSE
  useEngineeringCodingEvents(selectedPipelineId, {
    enabled: !!selectedPipelineId,
    onEvent: (event) => {
      if (event?.type === "canary_phase") {
        setCanaryPhase(event.phase);
        if (event.findingCount != null) setCanaryFindingCount(event.findingCount);
        if (event.phase === "completed" || event.phase === "failed") {
          // Refresh canary list after completion
          refetchCanary();
        }
      }
    },
  });

  const runs = canaryData?.items ?? [];
  const selectedRun = runs.find((r) => r.id === selectedRunId) ?? runs[0] ?? null;

  async function handleTriggerCanary() {
    setTriggering(true);
    setTriggerMsg(null);
    try {
      const result = await triggerCanaryRun({
        environment: "staging",
        scope: "full",
        targetUrl: settings?.canaryStagingBaseUrl?.trim() || undefined,
      });
      setTriggerMsg(
        result.status === "already_running"
          ? "A canary run is already in progress."
          : "Canary run started."
      );
      refetchCanary();
    } catch (err) {
      setTriggerMsg(err instanceof Error ? err.message : "Failed to start canary run");
    } finally {
      setTriggering(false);
    }
  }

  const qaContextKey = selectedPipelineId || selectedRun?.id || "";

  return (
    <AnimatedAppPage wide>
      <AgentPageWithChat domain="neel" contextKey={qaContextKey}>
      <AgentPageHeader domain="neel" />

      <AgentPipelineLiveStatus agentKey="neel" />

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <AppTabButton key={t.id} active={tab === t.id} onClick={() => setTab(t.id)}>
            {t.label}
          </AppTabButton>
        ))}
      </div>

      {tab === "overview" ? (
        <>
          {inboxError ? (
            <Panel className="border-danger/30 bg-danger/5">
              <p className="px-5 py-4 text-[13px] text-danger sm:px-6">
                Could not load Neel inbox: {inboxError.message ?? String(inboxError)}
              </p>
            </Panel>
          ) : null}

          {inboxEmpty ? (
            <Panel className="border-indigo/20 bg-indigo/[0.03]">
              <p className="px-5 py-5 text-[13px] leading-relaxed text-app-ink-dim sm:px-6">
                {AGENT_NAMES.NEEL} runs after Ananta&apos;s implementation check passes. If a ticket
                is paused at the implementation gate, use <strong>Continue to Neel</strong> below
                (or pipeline override) to hand off. Finished reports appear here once the QA stage
                completes — in-progress work shows under Running.
              </p>
            </Panel>
          ) : null}

          {inboxMsg ? (
            <p className="rounded-app-sm border border-app-border bg-app-surface-muted/40 px-4 py-2.5 text-[13px] text-app-ink-dim">
              {inboxMsg}
            </p>
          ) : null}

          <QaInboxList
            kicker="Inbox"
            title="Running with Neel"
            items={running}
            empty="No QA runs in progress."
            selectedPipelineId={selectedPipelineId}
            onSelect={setSelectedPipelineId}
            orgPath={orgPath}
            variant="running"
          />

          <QaInboxList
            kicker="Handoff"
            title="Blocked before / during Neel"
            items={blocked}
            empty="No tickets paused at implementation or QA gates."
            selectedPipelineId={selectedPipelineId}
            onSelect={setSelectedPipelineId}
            orgPath={orgPath}
            variant="blocked"
            onResume={handleContinueToNeel}
            resumeBusyId={resumeBusyId}
          />

          <QaInboxList
            kicker="Needs attention"
            title="Failed before or during QA"
            items={failed}
            empty="No failed QA pipelines."
            selectedPipelineId={selectedPipelineId}
            onSelect={setSelectedPipelineId}
            orgPath={orgPath}
            variant="failed"
            onResume={handleContinueToNeel}
            resumeBusyId={resumeBusyId}
          />

          <QaInboxList
            kicker="Reports"
            title="Completed QA reports"
            items={completed}
            empty="No completed pipeline QA reports yet."
            selectedPipelineId={selectedPipelineId}
            onSelect={setSelectedPipelineId}
            orgPath={orgPath}
            variant="completed"
          />

          <Panel>
            <PanelHeader kicker="Coverage" title="Test coverage by file" />
            <div className="grid gap-2 p-4 sm:grid-cols-2">
              {(coverage?.files ?? []).map((file) => (
                <div
                  key={file.path}
                  className="rounded-app-sm border border-app-border px-3.5 py-2.5"
                  style={{
                    borderColor:
                      file.coverage >= 80
                        ? "rgba(34,197,94,0.35)"
                        : file.coverage >= 60
                          ? "rgba(245,158,11,0.35)"
                          : "rgba(239,68,68,0.35)",
                  }}
                >
                  <p className="truncate font-mono text-[11px] text-app-ink">{file.path}</p>
                  <p className="type-metric mt-1.5">{file.coverage}%</p>
                  <p className="type-kicker mt-0.5">
                    lines {file.lines}% · branches {file.branches}%
                  </p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel>
            <PanelHeader kicker="Criteria" title="Acceptance criteria heatmap" />
            <div className="overflow-x-auto p-4">
              <table className="w-full min-w-[480px] border-collapse text-[12px]">
                <thead>
                  <tr>
                    <th className="p-2 text-left type-kicker">Feature</th>
                    {(heatmap?.criteria ?? []).map((c) => (
                      <th key={c} className="p-2 text-center type-kicker">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(heatmap?.features ?? []).map((feature, row) => (
                    <tr key={feature}>
                      <td className="p-2 text-[12px] text-indigo">{feature}</td>
                      {(heatmap?.cells?.[row] ?? []).map((cell, col) => (
                        <td key={col} className="p-2 text-center">
                          <span
                            className={`inline-block size-3 rounded-full ${HEATMAP_CELL[cell] ?? HEATMAP_CELL.na}`}
                            title={cell}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel>
            <PanelHeader kicker="Failures" title="Failure analysis board" />
            <div className="grid gap-3 p-4 lg:grid-cols-4">
              {(failures?.columns ?? []).map((column) => (
                <div
                  key={column.id}
                  className="rounded-app-sm border border-app-border bg-app-surface-muted/40 p-3"
                >
                  <p className="type-kicker">{column.label}</p>
                  <ul className="mt-2.5 space-y-2">
                    {column.items.map((item) => (
                      <li
                        key={item.id}
                        className="rounded-app-sm border border-app-border bg-app-surface/60 p-2.5 text-[12px]"
                      >
                        <p className="font-medium text-app-ink">{item.testName}</p>
                        <p className="mt-1 text-app-ink-dim">{item.criterion}</p>
                        <p className="mt-1.5 text-danger">{item.error}</p>
                        <p className="mt-1.5 text-app-ink-mute">{item.remediation}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Panel>

          {selectedPipelineId && canaryPhase ? (
            <CanaryLivePanel phase={canaryPhase} findingCount={canaryFindingCount} />
          ) : null}

          {selectedPipelineId && pipelineReport ? (
            <PipelineQaDetail report={pipelineReport} />
          ) : null}

          {selectedPipelineId ? (
            <ToolArtifactsPanel
              pipelineId={selectedPipelineId}
              lane="qa"
              title="OSS tool outputs (Neel)"
            />
          ) : null}

          {selectedPipelineId && canaryPhase ? (
            <ToolArtifactsPanel
              pipelineId={selectedPipelineId}
              lane="canary"
              title="OSS tool outputs (Canary)"
            />
          ) : null}
        </>
      ) : (
        <>
          <Panel>
            <PanelHeader
              kicker="Canary"
              title="Adversarial live-app probes"
              right={
                <button
                  type="button"
                  onClick={handleTriggerCanary}
                  disabled={triggering}
                  className="rounded-full border border-indigo/30 bg-indigo/10 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-indigo transition hover:bg-indigo/20 disabled:opacity-50"
                >
                  {triggering ? "Starting…" : "Run now"}
                </button>
              }
            />
            {triggerMsg ? (
              <p className="border-t border-app-border px-5 py-2 text-[12px] text-app-ink-dim">
                {triggerMsg}
              </p>
            ) : null}
            <ul className="divide-y divide-app-border">
              {runs.length === 0 ? (
                <li className="px-5 py-6 text-[13px] text-app-ink-dim">No canary runs yet.</li>
              ) : (
                runs.map((run) => (
                  <li key={run.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedRunId(run.id)}
                      className={`flex w-full items-start justify-between gap-4 px-5 py-3.5 text-left transition hover:bg-app-surface-muted/30 ${
                        selectedRun?.id === run.id ? "bg-app-surface-muted/40" : ""
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-[12px] font-medium text-indigo">
                          {run.jiraKey ?? run.id}
                          <span className="ml-2 text-app-ink-mute">· {run.trigger}</span>
                        </p>
                        <p className="mt-1 truncate text-[13px] text-app-ink-dim">
                          {run.summary ?? run.error ?? `${run.environment} / ${run.scope}`}
                        </p>
                        <p className="mt-1 text-[11px] text-app-ink-mute">
                          {formatWhen(run.startedAt)} · {run.findingCount ?? run.findings?.length ?? 0}{" "}
                          findings
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                          run.status === "COMPLETED"
                            ? "border-success/30 text-success"
                            : run.status === "FAILED"
                              ? "border-danger/30 text-danger"
                              : "border-warning/30 text-warning"
                        }`}
                      >
                        {run.status}
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </Panel>

          {selectedRun ? (
            <>
              <Panel>
                <PanelHeader
                  kicker="Findings"
                  title={selectedRun.jiraKey ? `Run for ${selectedRun.jiraKey}` : selectedRun.id}
                  subtitle={`${selectedRun.environment} · ${selectedRun.scope} · ${selectedRun.targetUrl}`}
                />
                {(selectedRun.findings ?? []).length === 0 ? (
                  <p className="px-5 py-6 text-[13px] text-app-ink-dim">
                    No confirmed findings for this run.
                  </p>
                ) : (
                  <ul className="divide-y divide-app-border">
                    {selectedRun.findings.map((finding) => (
                      <li key={finding.id} className="px-5 py-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${
                              SEVERITY_STYLES[finding.severity] ?? SEVERITY_STYLES.medium
                            }`}
                          >
                            {finding.severity}
                          </span>
                          <span className="type-kicker">{finding.category}</span>
                        </div>
                        <p className="mt-2 text-[14px] font-medium text-app-ink">{finding.title}</p>
                        <p className="mt-1.5 text-[13px] text-app-ink-dim">{finding.description}</p>
                        {finding.reproductionSteps ? (
                          <pre className="mt-3 whitespace-pre-wrap rounded-app-sm border border-app-border bg-app-surface-muted/30 p-3 font-mono text-[11px] text-app-ink-dim">
                            {finding.reproductionSteps}
                          </pre>
                        ) : null}
                        {finding.suggestedFix ? (
                          <p className="mt-2 text-[12px] text-indigo">
                            Suggested fix: {finding.suggestedFix}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
              <ToolArtifactsPanel
                pipelineId={selectedRun.pipelineId || selectedRun.id}
                lane="canary"
                title="OSS tool outputs (Canary)"
              />
            </>
          ) : null}
        </>
      )}
      </AgentPageWithChat>
    </AnimatedAppPage>
  );
}
