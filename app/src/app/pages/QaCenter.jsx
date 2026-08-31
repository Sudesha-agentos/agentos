import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  useQaCoverage,
  useQaHeatmap,
  useQaFailures,
  useQaInbox,
  useQaPipelineReport,
} from "../../entities/qa";
import { TestCaseViewer } from "../../widgets/qa/TestCaseViewer";
import { triggerCanaryRun, useCanaryRuns } from "../../entities/canary";
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
import { useCoreIntegrations } from "../../shared/hooks/useIntegrationsStatus";
import ConnectIntegrationFirst from "../components/ConnectIntegrationFirst";
import Spinner from "../components/Spinner";

const PAGE_TABS = [
  { id: "workspace", label: "Workspace" },
  { id: "fleet", label: "Fleet" },
  { id: "canary", label: "Canary" },
];

const QUEUE_FILTERS = [
  { id: "all", label: "All" },
  { id: "running", label: "Running" },
  { id: "blocked", label: "Blocked" },
  { id: "failed", label: "Failed" },
  { id: "completed", label: "Done" },
];

const REPORT_SECTIONS = [
  { id: "summary", label: "Summary" },
  { id: "tests", label: "Tests" },
  { id: "security", label: "Security & smoke" },
  { id: "gaps", label: "Gaps & failures" },
  { id: "tools", label: "OSS tools" },
];

const RECOMMENDATION = {
  approve: {
    border: "border-success/40 bg-success/10",
    text: "text-success",
    label: "Approved: ready to merge",
  },
  approve_with_conditions: {
    border: "border-warning/40 bg-warning/10",
    text: "text-warning",
    label: "Approved with conditions",
  },
  request_changes: {
    border: "border-danger/40 bg-danger/10",
    text: "text-danger",
    label: "Changes requested",
  },
  block: {
    border: "border-danger/40 bg-danger/10",
    text: "text-danger",
    label: "Blocked: do not merge",
  },
};

const SEVERITY = {
  critical: "border-danger/40 bg-danger/10 text-danger",
  high: "border-warning/40 bg-warning/10 text-warning",
  medium: "border-indigo/30 bg-indigo/5 text-indigo",
  low: "border-app-border bg-app-surface-muted/40 text-app-ink-dim",
};

const HEATMAP = {
  pass: "bg-success",
  warn: "bg-warning",
  fail: "bg-danger",
  na: "bg-ink-mute/30",
};

const CANARY_PHASE = {
  reconnaissance: "Reconnaissance: mapping endpoints",
  hypotheses: "Generating adversarial hypotheses",
  exploration: "Probing live application",
  synthesis: "Synthesising findings",
  completed: "Canary complete",
  failed: "Canary failed",
};

function formatWhen(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return "";
  }
}

function Metric({ label, value, tone = "text-app-ink" }) {
  return (
    <div className="rounded-app-sm border border-app-border bg-app-surface-muted/30 px-3 py-2.5">
      <p className="type-kicker">{label}</p>
      <p className={`type-metric mt-1 ${tone}`}>{value}</p>
    </div>
  );
}

function StatusChip({ children, tone = "neutral" }) {
  const styles = {
    success: "border-success/30 bg-success/10 text-success",
    danger: "border-danger/30 bg-danger/10 text-danger",
    warning: "border-warning/30 bg-warning/10 text-warning",
    indigo: "border-indigo/30 bg-indigo/10 text-indigo",
    neutral: "border-app-border bg-app-surface-muted/40 text-app-ink-dim",
  };
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
        styles[tone] ?? styles.neutral
      }`}
    >
      {children}
    </span>
  );
}

function SectionNav({ sections, active, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5 border-b border-app-border px-4 py-3 sm:px-5">
      {sections.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onChange(s.id)}
          className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
            active === s.id
              ? "bg-app-charcoal text-white"
              : "border border-app-border text-app-ink-dim hover:text-app-ink"
          }`}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

function VerdictBanner({ recommendation, requiresHumanOverride }) {
  if (!recommendation && !requiresHumanOverride) return null;
  const style =
    RECOMMENDATION[recommendation] ?? RECOMMENDATION.approve_with_conditions;
  return (
    <div className="space-y-2 px-5 py-4">
      {recommendation ? (
        <div className={`rounded-app-sm border px-4 py-3 ${style.border}`}>
          <p className={`text-sm font-semibold ${style.text}`}>{style.label}</p>
          <p className="mt-0.5 text-[11px] text-app-ink-mute">
            Neel recommendation · {String(recommendation).replace(/_/g, " ")}
          </p>
        </div>
      ) : null}
      {requiresHumanOverride ? (
        <div className="rounded-app-sm border border-warning/40 bg-warning/10 px-4 py-2 text-xs text-warning">
          Human override required before merge (low confidence, missing
          execution, or locator heal pending review).
        </div>
      ) : null}
    </div>
  );
}

function ExecutedTestsSection({ report }) {
  const executed = (
    report.testConductReport?.executed ??
    report.executedTests ??
    report.testRun?.testResults ??
    []
  ).map((test) => ({
    ...test,
    name: test.name ?? test.testName ?? test.title ?? "unnamed test",
  }));
  const tools = report.testConductReport?.tools ?? [];
  if (!executed.length && !tools.length && !report.testConductReport?.headline) {
    return null;
  }
  return (
    <div className="border-b border-app-border px-5 py-4">
      <p className="type-kicker">Tests conducted</p>
      {report.testConductReport?.headline ? (
        <p className="mt-1 text-[13px] text-app-ink">{report.testConductReport.headline}</p>
      ) : null}
      {executed.length ? (
        <ul className="mt-3 divide-y divide-app-border">
          {executed.map((test, index) => (
            <li key={`${test.name}-${index}`} className="flex items-start justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-[13px] text-app-ink">{test.name}</p>
                {test.error ? (
                  <p className="mt-0.5 text-[11px] text-danger">{test.error}</p>
                ) : null}
              </div>
              <span
                className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${
                  test.status === "pass"
                    ? "border-success/30 bg-success/10 text-success"
                    : test.status === "fail"
                      ? "border-danger/30 bg-danger/10 text-danger"
                      : "border-app-border bg-app-surface-muted/40 text-app-ink-dim"
                }`}
              >
                {test.status}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-[13px] text-app-ink-dim">No executable tests ran for this ticket.</p>
      )}
      {tools.length ? (
        <ul className="mt-3 space-y-1 text-[12px] text-app-ink-dim">
          {tools.map((tool) => (
            <li key={tool.tool}>
              {tool.tool} · {tool.status}
              {tool.summary ? ` — ${tool.summary}` : ""}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function SummarySection({ report }) {
  const testRun = report.testRun;
  const coverage = report.coverageReport;
  const confidence = report.confidenceScore;
  const status = report.executionStatus;
  const sandboxDead =
    (status === "error" || status === "unavailable" || status === "skipped") &&
    testRun &&
    (testRun.totalTests ?? 0) === 0;

  const passed = testRun?.passed ?? null;
  const failed = testRun?.failed ?? null;
  const total = testRun?.totalTests ?? null;

  return (
    <div className="space-y-4 px-5 py-4">
      {report.testConductReport?.headline ? (
        <p className="rounded-app-sm border border-app-border bg-app-surface-muted/40 px-3 py-2 text-[13px] text-app-ink">
          {report.testConductReport.headline}
        </p>
      ) : null}
      {report.inProgress || status === "running" || status === "pending" ? (
        <p className="rounded-app-sm border border-indigo/25 bg-indigo/5 px-3 py-2 text-[13px] text-app-ink-dim">
          {report.executionMessage ||
            "Neel is still working: metrics fill in when the QA stage completes."}
        </p>
      ) : null}

      {sandboxDead ? (
        <p className="rounded-app-sm border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
          Sandbox unit/integration tests did not execute ({status}
          {testRun?.sandboxAvailable === false ? " · sandbox unavailable" : ""}
          ). Semgrep / Playwright from the OSS suite still appear under Security
          & smoke and OSS tools.
        </p>
      ) : null}

      {!testRun && !coverage && confidence == null && !report.securityScan && !report.playwrightSmoke ? (
        <p className="text-[13px] text-app-ink-dim">
          No execution stats yet for this pipeline. Select a completed report or
          wait for Neel to finish.
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {total != null && !sandboxDead ? (
          <>
            <Metric label="Passed" value={passed ?? 0} tone="text-success" />
            <Metric label="Failed" value={failed ?? 0} tone="text-danger" />
            <Metric label="Total tests" value={total} />
            <Metric
              label="Duration"
              value={
                testRun?.duration
                  ? `${(testRun.duration / 1000).toFixed(1)}s`
                  : "—"
              }
            />
          </>
        ) : null}
        {coverage ? (
          <>
            <Metric
              label="Criteria coverage"
              value={`${Number(coverage.coveragePercent ?? 0).toFixed(1)}%`}
              tone={
                coverage.coveragePercent >= 95
                  ? "text-success"
                  : coverage.coveragePercent >= 80
                    ? "text-warning"
                    : "text-danger"
              }
            />
            <Metric
              label="Covered ACs"
              value={`${coverage.coveredCriteria ?? 0} / ${coverage.totalCriteria ?? 0}`}
            />
          </>
        ) : null}
        {confidence != null ? (
          <Metric
            label="Confidence"
            value={`${(confidence * 100).toFixed(0)}%`}
          />
        ) : null}
        {report.securityScan ? (
          <Metric
            label="Security critical/high"
            value={`${report.securityScan.criticalCount ?? 0} / ${report.securityScan.highCount ?? 0}`}
            tone={
              (report.securityScan.criticalCount ?? 0) +
                (report.securityScan.highCount ?? 0) >
              0
                ? "text-danger"
                : "text-success"
            }
          />
        ) : null}
        {report.playwrightSmoke ? (
          <Metric
            label="Playwright"
            value={
              report.playwrightSmoke.skipped
                ? "Skipped"
                : report.playwrightSmoke.passed
                  ? "Passed"
                  : "Failed"
            }
            tone={
              report.playwrightSmoke.skipped
                ? "text-warning"
                : report.playwrightSmoke.passed
                  ? "text-success"
                  : "text-danger"
            }
          />
        ) : null}
      </div>

      {report.testSummary ? (
        <p className="text-[13px] leading-relaxed text-app-ink-dim">
          {report.testSummary}
        </p>
      ) : null}

      {report.confidenceBreakdown?.breakdown?.length ||
      (status && status !== "ran") ? (
        <div className="rounded-app-sm border border-app-border bg-app-surface-muted/20 px-3 py-3">
          <p className="type-kicker mb-2">Explainable confidence</p>
          {report.confidenceReason ? (
            <p className="mb-2 text-[12px] text-app-ink-dim">
              {report.confidenceReason}
            </p>
          ) : null}
          {status && status !== "ran" ? (
            <p className="mb-2 text-xs text-danger">
              Execution: {status}
              {report.executionMessage ? `: ${report.executionMessage}` : ""}
            </p>
          ) : null}
          <ul className="space-y-1.5">
            {(report.confidenceBreakdown?.breakdown ?? []).map((row) => (
              <li
                key={row.id}
                className="flex items-center justify-between gap-3 text-xs"
              >
                <span className="text-app-ink-dim">{row.label}</span>
                <span className="font-mono text-app-ink">
                  {(row.value * 100).toFixed(0)}% × {row.weight.toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {report.riskAreas?.length ? (
        <div>
          <p className="type-kicker mb-2">Risk areas</p>
          <ul className="space-y-1">
            {report.riskAreas.map((r, i) => (
              <li key={i} className="text-[13px] text-app-ink-dim">
                {r}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function SecuritySmokeSection({ securityScan, playwrightSmoke }) {
  const [showOutput, setShowOutput] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const findings = securityScan?.findings ?? [];
  const visible = expanded ? findings.slice(0, 40) : findings.slice(0, 8);

  return (
    <div className="space-y-5 px-5 py-4">
      <div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <p className="type-kicker">Security scan (Semgrep / npm audit)</p>
          {securityScan ? (
            <StatusChip
              tone={
                (securityScan.criticalCount ?? 0) +
                  (securityScan.highCount ?? 0) >
                0
                  ? "danger"
                  : "success"
              }
            >
              {(securityScan.criticalCount ?? 0) +
                (securityScan.highCount ?? 0) >
              0
                ? `${securityScan.criticalCount ?? 0} crit · ${securityScan.highCount ?? 0} high`
                : "Clean"}
            </StatusChip>
          ) : (
            <StatusChip>Not attached</StatusChip>
          )}
        </div>
        {!securityScan ? (
          <p className="text-[13px] text-app-ink-dim">
            No security scan on this report. Open OSS tools for Semgrep artifacts
            from the mandatory QA suite.
          </p>
        ) : findings.length === 0 ? (
          <p className="text-[13px] text-app-ink-dim">
            {securityScan.message || "No security findings."}
          </p>
        ) : (
          <>
            <ul className="space-y-1.5">
              {visible.map((f, i) => {
                const detail = f.detail || f.description || "";
                return (
                  <li
                    key={f.id ?? i}
                    className={`rounded-app-sm border px-3 py-2 text-xs ${
                      SEVERITY[f.severity] ?? SEVERITY.medium
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold uppercase">
                        {f.severity ?? "medium"}
                      </span>
                      {f.source ? (
                        <span className="opacity-70">{f.source}</span>
                      ) : null}
                    </div>
                    <p className="mt-1 font-medium">{f.title}</p>
                    {detail ? (
                      <p className="mt-0.5 opacity-80">{detail}</p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            {findings.length > 8 ? (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="mt-2 text-[11px] font-medium text-indigo"
              >
                {expanded ? "Show fewer" : `Show all (${findings.length})`}
              </button>
            ) : null}
          </>
        )}
      </div>

      <div className="border-t border-app-border pt-4">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <p className="type-kicker">Playwright smoke</p>
          {playwrightSmoke ? (
            <StatusChip
              tone={
                playwrightSmoke.skipped
                  ? "warning"
                  : playwrightSmoke.passed
                    ? "success"
                    : "danger"
              }
            >
              {playwrightSmoke.skipped
                ? "Skipped"
                : playwrightSmoke.passed
                  ? "Passed"
                  : "Failed"}
            </StatusChip>
          ) : (
            <StatusChip>Not attached</StatusChip>
          )}
          {playwrightSmoke?.durationMs ? (
            <span className="text-[11px] text-app-ink-mute">
              {playwrightSmoke.durationMs}ms
            </span>
          ) : null}
        </div>
        {!playwrightSmoke ? (
          <p className="text-[13px] text-app-ink-dim">
            No Playwright result on this report. Check OSS tools for playwright /
            playwright-monitor artifacts.
          </p>
        ) : (
          <>
            {playwrightSmoke.skipped && playwrightSmoke.skipReason ? (
              <p className="text-[13px] text-app-ink-dim">
                {playwrightSmoke.skipReason}
              </p>
            ) : null}
            {playwrightSmoke.attempted === false ? (
              <p className="text-[13px] text-app-ink-dim">Not attempted.</p>
            ) : null}
            {playwrightSmoke.output ? (
              <>
                <button
                  type="button"
                  onClick={() => setShowOutput((v) => !v)}
                  className="mt-2 text-[11px] font-medium text-indigo"
                >
                  {showOutput ? "Hide output" : "Show output"}
                </button>
                {showOutput ? (
                  <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-app-sm border border-app-border bg-app-surface/60 p-3 font-mono text-[11px] text-app-ink-dim">
                    {String(playwrightSmoke.output).slice(0, 8000)}
                  </pre>
                ) : null}
              </>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

function GapsSection({ report }) {
  const gaps = report.coverageGaps ?? [];
  const failures = report.failureAnalysis ?? [];
  const heals = report.locatorHealProposals ?? [];
  const uncovered = report.coverageReport?.uncoveredCriteria ?? [];

  if (!gaps.length && !failures.length && !heals.length && !uncovered.length) {
    return (
      <p className="px-5 py-6 text-[13px] text-app-ink-dim">
        No coverage gaps, failures, or heal proposals for this report.
      </p>
    );
  }

  return (
    <div className="space-y-5 px-5 py-4">
      {gaps.length ? (
        <div>
          <p className="type-kicker mb-2">Coverage gaps ({gaps.length})</p>
          <ul className="space-y-2">
            {gaps.map((g) => (
              <li
                key={g.id}
                className="rounded-app-sm border border-warning/30 bg-warning/5 px-3 py-2.5 text-xs"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono font-semibold">{g.id}</span>
                  <StatusChip tone="warning">{g.severity}</StatusChip>
                </div>
                <p className="mt-1 font-medium text-app-ink">{g.criterion}</p>
                <p className="mt-1 text-app-ink-dim">{g.reason}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {uncovered.length ? (
        <div>
          <p className="type-kicker mb-2">Uncovered criteria</p>
          <ul className="list-disc space-y-1 pl-5 text-[13px] text-app-ink-dim">
            {uncovered.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {failures.length ? (
        <div>
          <p className="type-kicker mb-2">Failure analysis ({failures.length})</p>
          <ul className="space-y-2">
            {failures.map((f, i) => (
              <li
                key={f.testId ?? i}
                className={`rounded-app-sm border px-3 py-2.5 text-xs ${
                  SEVERITY[f.severity] ?? SEVERITY.medium
                }`}
              >
                <p className="font-medium">{f.testName}</p>
                {f.likelyCause ? (
                  <p className="mt-1 opacity-80">Cause: {f.likelyCause}</p>
                ) : null}
                {f.remediation ? (
                  <p className="mt-1 font-medium text-app-ink">
                    Fix: {f.remediation}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {heals.length ? (
        <div>
          <p className="type-kicker mb-2">Locator heal proposals</p>
          <ul className="space-y-2">
            {heals.map((h, i) => (
              <li
                key={i}
                className="rounded-app-sm border border-app-border px-3 py-2 text-xs"
              >
                <p className="font-medium text-app-ink">
                  {h.testFile} · {h.testName}
                </p>
                <p className="mt-1 font-mono text-app-ink-dim">
                  {h.oldPrimary} → {h.proposedPrimary}
                </p>
                <p className="mt-1 text-app-ink-mute">{h.rationale}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function ReportWorkspace({ report, pipelineId, orgPath, canaryPhase, canaryFindingCount }) {
  const [section, setSection] = useState("summary");

  useEffect(() => {
    setSection("summary");
  }, [pipelineId]);

  if (!report) {
    return (
      <Panel>
        <div className="px-5 py-10 text-center text-[13px] text-app-ink-dim">
          Select a ticket from the queue to open its Neel report.
        </div>
      </Panel>
    );
  }

  return (
    <>
    <Panel>
      <PanelHeader
        kicker="QA report"
        title={report.jiraKey ?? "Pipeline report"}
        subtitle={
          report.completedAt
            ? `Completed ${formatWhen(report.completedAt)}`
            : report.executionStatus || "In progress"
        }
        right={
          <Link
            to={orgPath("pipelines", pipelineId)}
            className="text-[12px] font-medium text-indigo hover:underline"
          >
            Pipeline →
          </Link>
        }
      />

      {canaryPhase ? (
        <div className="border-b border-app-border px-5 py-3">
          <p className="type-kicker">Canary live</p>
          <p className="mt-1 text-sm text-app-ink">
            {CANARY_PHASE[canaryPhase] ?? canaryPhase}
            {canaryPhase === "completed" && canaryFindingCount != null
              ? ` · ${canaryFindingCount} finding(s)`
              : ""}
          </p>
        </div>
      ) : null}

      <VerdictBanner
        recommendation={report.recommendation}
        requiresHumanOverride={report.requiresHumanOverride}
      />

      <SectionNav
        sections={REPORT_SECTIONS}
        active={section}
        onChange={setSection}
      />

      {section === "summary" ? <SummarySection report={report} /> : null}
      {section === "tests" ? (
        <>
          <ExecutedTestsSection report={report} />
          <TestCaseViewer testCases={report.testCases ?? []} />
        </>
      ) : null}
      {section === "security" ? (
        <SecuritySmokeSection
          securityScan={report.securityScan}
          playwrightSmoke={report.playwrightSmoke}
        />
      ) : null}
      {section === "gaps" ? <GapsSection report={report} /> : null}
      {section === "tools" ? (
        <p className="px-5 py-4 text-[13px] text-app-ink-dim">
          Mandatory Semgrep, Playwright, Cover-Agent, and Hypothesis outputs for
          this pipeline are listed below.
        </p>
      ) : null}
    </Panel>
    {section === "tools" && pipelineId ? (
      <div className="mt-4 space-y-4">
        <ToolArtifactsPanel
          pipelineId={pipelineId}
          lane="qa"
          title="Neel OSS suite"
          pollMs={6000}
        />
        <ToolArtifactsPanel
          pipelineId={pipelineId}
          lane="canary"
          title="Canary OSS suite"
          pollMs={8000}
        />
      </div>
    ) : null}
    </>
  );
}

function QueueItem({
  item,
  variant,
  selected,
  onSelect,
  orgPath,
  onResume,
  resumeBusyId,
}) {
  const tone =
    variant === "running"
      ? "indigo"
      : variant === "blocked"
        ? "warning"
        : variant === "failed"
          ? "danger"
          : item.passRate != null && item.passRate >= 95
            ? "success"
            : item.passRate != null
              ? "warning"
              : "neutral";

  return (
    <div
      className={`border-b border-app-border last:border-b-0 ${
        selected ? "bg-app-surface-muted/50" : ""
      }`}
    >
      <button
        type="button"
        onClick={() => onSelect(item.pipelineId)}
        className="w-full px-4 py-3 text-left transition hover:bg-app-surface-muted/30"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12px] font-semibold text-indigo">
            {item.jiraKey}
          </span>
          <StatusChip tone={tone}>
            {variant === "running"
              ? item.currentStageLabel || "Running"
              : variant === "blocked"
                ? "Needs handoff"
                : variant === "failed"
                  ? "Failed"
                  : item.passRate != null
                    ? `${item.passRate}% pass`
                    : "Done"}
          </StatusChip>
        </div>
        <p className="mt-1 truncate text-[13px] text-app-ink">
          {item.summary || "QA pipeline"}
        </p>
        <p className="mt-0.5 truncate text-[11px] text-app-ink-mute">
          {item.message ||
            (item.testCount != null
              ? `${item.testCount} test case(s)`
              : formatWhen(item.completedAt))}
        </p>
      </button>
      {(variant === "blocked" || variant === "failed") && (
        <div className="flex flex-wrap gap-2 px-4 pb-3">
          <button
            type="button"
            disabled={resumeBusyId === item.pipelineId}
            onClick={() => onResume?.(item.pipelineId)}
            className="rounded-full border border-indigo/40 bg-indigo/10 px-3 py-1 text-[11px] font-medium text-indigo disabled:opacity-50"
          >
            {resumeBusyId === item.pipelineId
              ? "Resuming…"
              : variant === "failed"
                ? "Retry"
                : "Continue to Neel"}
          </button>
          <Link
            to={orgPath("pipelines", item.pipelineId, "override")}
            className="px-1 py-1 text-[11px] text-indigo hover:underline"
          >
            Override
          </Link>
        </div>
      )}
    </div>
  );
}

function TicketQueue({
  filter,
  onFilterChange,
  items,
  selectedPipelineId,
  onSelect,
  orgPath,
  onResume,
  resumeBusyId,
  counts,
}) {
  return (
    <Panel className="min-h-[28rem]">
      <PanelHeader
        kicker="Queue"
        title={`${AGENT_NAMES.NEEL} tickets`}
        subtitle="Pick a pipeline to inspect the full QA report."
      />
      <div className="flex flex-wrap gap-1.5 border-b border-app-border px-4 py-3">
        {QUEUE_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => onFilterChange(f.id)}
            className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
              filter === f.id
                ? "bg-app-charcoal text-white"
                : "border border-app-border text-app-ink-dim"
            }`}
          >
            {f.label}
            {counts[f.id] != null ? ` ${counts[f.id]}` : ""}
          </button>
        ))}
      </div>
      <div className="max-h-[36rem] overflow-y-auto">
        {items.length === 0 ? (
          <p className="px-4 py-8 text-[13px] text-app-ink-dim">
            Nothing in this filter. Neel runs after Ananta’s implementation check
            passes.
          </p>
        ) : (
          items.map(({ item, variant }) => (
            <QueueItem
              key={item.pipelineId}
              item={item}
              variant={variant}
              selected={selectedPipelineId === item.pipelineId}
              onSelect={onSelect}
              orgPath={orgPath}
              onResume={onResume}
              resumeBusyId={resumeBusyId}
            />
          ))
        )}
      </div>
    </Panel>
  );
}

function FleetTab({ coverage, heatmap, failures }) {
  return (
    <div className="space-y-5">
      <Panel>
        <PanelHeader kicker="Coverage" title="Test coverage by file" />
        <div className="grid gap-2 p-4 sm:grid-cols-2">
          {(coverage?.files ?? []).length === 0 ? (
            <p className="col-span-full px-1 py-4 text-[13px] text-app-ink-dim">
              No file coverage aggregated yet.
            </p>
          ) : (
            (coverage?.files ?? []).map((file) => (
              <div
                key={file.path}
                className="rounded-app-sm border border-app-border px-3.5 py-2.5"
              >
                <p className="truncate font-mono text-[11px] text-app-ink">
                  {file.path}
                </p>
                <p className="type-metric mt-1.5">{file.coverage}%</p>
                <p className="type-kicker mt-0.5">
                  lines {file.lines}% · branches {file.branches}%
                </p>
              </div>
            ))
          )}
        </div>
      </Panel>

      <Panel>
        <PanelHeader kicker="Criteria" title="Acceptance criteria heatmap" />
        <div className="overflow-x-auto p-4">
          {(heatmap?.features ?? []).length === 0 ? (
            <p className="text-[13px] text-app-ink-dim">No heatmap data yet.</p>
          ) : (
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
                    <td className="p-2 text-indigo">{feature}</td>
                    {(heatmap?.cells?.[row] ?? []).map((cell, col) => (
                      <td key={col} className="p-2 text-center">
                        <span
                          className={`inline-block size-3 rounded-full ${
                            HEATMAP[cell] ?? HEATMAP.na
                          }`}
                          title={cell}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Panel>

      <Panel>
        <PanelHeader kicker="Failures" title="Failure analysis board" />
        <div className="grid gap-3 p-4 lg:grid-cols-4">
          {(failures?.columns ?? []).length === 0 ? (
            <p className="col-span-full text-[13px] text-app-ink-dim">
              No failure board columns yet.
            </p>
          ) : (
            (failures?.columns ?? []).map((column) => (
              <div
                key={column.id}
                className="rounded-app-sm border border-app-border bg-app-surface-muted/40 p-3"
              >
                <p className="type-kicker">{column.label}</p>
                <ul className="mt-2.5 space-y-2">
                  {(column.items ?? []).length === 0 ? (
                    <li className="text-[12px] text-app-ink-mute">Empty</li>
                  ) : (
                    column.items.map((item) => (
                      <li
                        key={item.id}
                        className="rounded-app-sm border border-app-border bg-app-surface/60 p-2.5 text-[12px]"
                      >
                        <p className="font-medium text-app-ink">{item.testName}</p>
                        <p className="mt-1 text-app-ink-dim">{item.criterion}</p>
                        <p className="mt-1.5 text-danger">{item.error}</p>
                        <p className="mt-1.5 text-app-ink-mute">{item.remediation}</p>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            ))
          )}
        </div>
      </Panel>
    </div>
  );
}

function CanaryTab({
  runs,
  selectedRun,
  selectedRunId,
  setSelectedRunId,
  triggering,
  triggerMsg,
  onTrigger,
}) {
  return (
    <div className="space-y-5">
      <Panel>
        <PanelHeader
          kicker="Canary"
          title="Adversarial live-app probes"
          right={
            <button
              type="button"
              onClick={onTrigger}
              disabled={triggering}
              className="rounded-full border border-indigo/30 bg-indigo/10 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-indigo disabled:opacity-50"
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
            <li className="px-5 py-6 text-[13px] text-app-ink-dim">
              No canary runs yet.
            </li>
          ) : (
            runs.map((run) => (
              <li key={run.id}>
                <button
                  type="button"
                  onClick={() => setSelectedRunId(run.id)}
                  className={`flex w-full items-start justify-between gap-4 px-5 py-3.5 text-left hover:bg-app-surface-muted/30 ${
                    (selectedRunId ?? selectedRun?.id) === run.id
                      ? "bg-app-surface-muted/40"
                      : ""
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-[12px] font-medium text-indigo">
                      {run.jiraKey ?? run.id}
                      <span className="ml-2 text-app-ink-mute">
                        · {run.trigger}
                      </span>
                    </p>
                    <p className="mt-1 truncate text-[13px] text-app-ink-dim">
                      {run.summary ??
                        run.error ??
                        `${run.environment} / ${run.scope}`}
                    </p>
                    <p className="mt-1 text-[11px] text-app-ink-mute">
                      {formatWhen(run.startedAt)} ·{" "}
                      {run.findingCount ?? run.findings?.length ?? 0} findings
                    </p>
                  </div>
                  <StatusChip
                    tone={
                      run.status === "COMPLETED"
                        ? "success"
                        : run.status === "FAILED"
                          ? "danger"
                          : "warning"
                    }
                  >
                    {run.status}
                  </StatusChip>
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
              title={
                selectedRun.jiraKey
                  ? `Run for ${selectedRun.jiraKey}`
                  : selectedRun.id
              }
              subtitle={`${selectedRun.environment} · ${selectedRun.scope}${
                selectedRun.targetUrl ? ` · ${selectedRun.targetUrl}` : ""
              }`}
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
                          SEVERITY[finding.severity] ?? SEVERITY.medium
                        }`}
                      >
                        {finding.severity}
                      </span>
                      <span className="type-kicker">{finding.category}</span>
                    </div>
                    <p className="mt-2 text-[14px] font-medium text-app-ink">
                      {finding.title}
                    </p>
                    <p className="mt-1.5 text-[13px] text-app-ink-dim">
                      {finding.description}
                    </p>
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
            title="Canary OSS suite"
          />
        </>
      ) : null}
    </div>
  );
}

export default function QaCenter() {
  const orgPath = useOrgPathBuilder();
  const {
    loading: integrationsLoading,
    gitConnected,
    gitNeedsSetup,
    missing: missingIntegrations,
  } = useCoreIntegrations();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState("workspace");
  const [queueFilter, setQueueFilter] = useState("all");
  const [triggering, setTriggering] = useState(false);
  const [triggerMsg, setTriggerMsg] = useState(null);
  const [selectedRunId, setSelectedRunId] = useState(null);
  const [selectedPipelineId, setSelectedPipelineId] = useState(
    () => searchParams.get("pipeline")?.trim() || null
  );
  const [resumeBusyId, setResumeBusyId] = useState(null);
  const [inboxMsg, setInboxMsg] = useState(null);
  const [canaryPhase, setCanaryPhase] = useState(null);
  const [canaryFindingCount, setCanaryFindingCount] = useState(null);

  useEffect(() => {
    const pipeline = searchParams.get("pipeline")?.trim();
    if (pipeline) {
      setSelectedPipelineId(pipeline);
      setTab("workspace");
    }
  }, [searchParams]);

  const { data: coverage } = useQaCoverage();
  const { data: heatmap } = useQaHeatmap();
  const { data: failures } = useQaFailures();
  const {
    data: inbox,
    refetch: refetchInbox,
    error: inboxError,
  } = useQaInbox({ pollMs: 8_000 });
  const { data: pipelineReport, error: reportError } = useQaPipelineReport(
    selectedPipelineId,
    { pollMs: 5_000 }
  );
  const { data: canaryData, refetch: refetchCanary } = useCanaryRuns({
    pollMs: 15_000,
  });
  const { data: settings } = useSettings();

  const running = inbox?.running ?? [];
  const blocked = inbox?.blocked ?? [];
  const failed = inbox?.failed ?? [];
  const completed = inbox?.completed ?? [];

  const counts = useMemo(
    () => ({
      all: running.length + blocked.length + failed.length + completed.length,
      running: running.length,
      blocked: blocked.length,
      failed: failed.length,
      completed: completed.length,
    }),
    [running, blocked, failed, completed]
  );

  const queueItems = useMemo(() => {
    const tagged = [
      ...running.map((item) => ({ item, variant: "running" })),
      ...blocked.map((item) => ({ item, variant: "blocked" })),
      ...failed.map((item) => ({ item, variant: "failed" })),
      ...completed.map((item) => ({ item, variant: "completed" })),
    ];
    if (queueFilter === "all") return tagged;
    return tagged.filter((row) => row.variant === queueFilter);
  }, [running, blocked, failed, completed, queueFilter]);

  // Auto-select first completed/running item when nothing selected
  useEffect(() => {
    if (selectedPipelineId) return;
    const first =
      running[0]?.pipelineId ||
      completed[0]?.pipelineId ||
      blocked[0]?.pipelineId ||
      failed[0]?.pipelineId;
    if (first) setSelectedPipelineId(first);
  }, [selectedPipelineId, running, completed, blocked, failed]);

  async function handleContinueToNeel(pipelineId) {
    setResumeBusyId(pipelineId);
    setInboxMsg(null);
    try {
      await pipelineAdapter.resume(pipelineId);
      setInboxMsg(
        "Pipeline resumed: Neel will start after the implementation gate."
      );
      setSelectedPipelineId(pipelineId);
      setTab("workspace");
      refetchInbox();
    } catch (err) {
      setInboxMsg(
        err instanceof Error ? err.message : "Could not resume pipeline"
      );
    } finally {
      setResumeBusyId(null);
    }
  }

  useEngineeringCodingEvents(selectedPipelineId, {
    enabled: !!selectedPipelineId,
    onEvent: (event) => {
      if (event?.type === "canary_phase") {
        setCanaryPhase(event.phase);
        if (event.findingCount != null) setCanaryFindingCount(event.findingCount);
        if (event.phase === "completed" || event.phase === "failed") {
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
      setTriggerMsg(
        err instanceof Error ? err.message : "Failed to start canary run"
      );
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

        {integrationsLoading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : !gitConnected ? (
          <ConnectIntegrationFirst
            integrations={missingIntegrations}
            title={gitNeedsSetup ? "Finish Git setup first" : "Connect a repository first"}
            body="Neel runs tests against the code Ananta writes. Connect GitHub or Bitbucket and select a repository before opening QA."
          />
        ) : (
        <>
        <div className="flex flex-wrap gap-2">
          {PAGE_TABS.map((t) => (
            <AppTabButton
              key={t.id}
              active={tab === t.id}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </AppTabButton>
          ))}
        </div>

        {inboxError ? (
          <Panel className="border-danger/30 bg-danger/5">
            <p className="px-5 py-4 text-[13px] text-danger sm:px-6">
              Could not load Neel inbox:{" "}
              {inboxError.message ?? String(inboxError)}
            </p>
          </Panel>
        ) : null}

        {inboxMsg ? (
          <p className="rounded-app-sm border border-app-border bg-app-surface-muted/40 px-4 py-2.5 text-[13px] text-app-ink-dim">
            {inboxMsg}
          </p>
        ) : null}

        {tab === "workspace" ? (
          <div className="grid gap-5 xl:grid-cols-[minmax(280px,340px)_minmax(0,1fr)]">
            <TicketQueue
              filter={queueFilter}
              onFilterChange={setQueueFilter}
              items={queueItems}
              selectedPipelineId={selectedPipelineId}
              onSelect={setSelectedPipelineId}
              orgPath={orgPath}
              onResume={handleContinueToNeel}
              resumeBusyId={resumeBusyId}
              counts={counts}
            />
            <div className="min-w-0 space-y-3">
              {reportError ? (
                <Panel className="border-danger/30 bg-danger/5">
                  <p className="px-5 py-3 text-[13px] text-danger">
                    Could not load report:{" "}
                    {reportError.message ?? String(reportError)}
                  </p>
                </Panel>
              ) : null}
              <ReportWorkspace
                report={pipelineReport}
                pipelineId={selectedPipelineId}
                orgPath={orgPath}
                canaryPhase={canaryPhase}
                canaryFindingCount={canaryFindingCount}
              />
            </div>
          </div>
        ) : null}

        {tab === "fleet" ? (
          <FleetTab coverage={coverage} heatmap={heatmap} failures={failures} />
        ) : null}

        {tab === "canary" ? (
          <CanaryTab
            runs={runs}
            selectedRun={selectedRun}
            selectedRunId={selectedRunId}
            setSelectedRunId={setSelectedRunId}
            triggering={triggering}
            triggerMsg={triggerMsg}
            onTrigger={handleTriggerCanary}
          />
        ) : null}
        </>
        )}
      </AgentPageWithChat>
    </AnimatedAppPage>
  );
}
