import { useState } from "react";
import { Link } from "react-router-dom";
import { useOrgPathBuilder } from "../../shared/providers/OrgRouteProvider";
import DiscoveryPrdSection from "../discovery/DiscoveryPrdSection";
import { TestCaseViewer } from "../qa/TestCaseViewer";
import ChatMarkdown from "./ChatMarkdown";

export function PrdDocumentCard({ prd, jiraKey }) {
  const orgPath = useOrgPathBuilder();
  if (!prd) return null;
  const scores =
    prd.prdConfidence != null ? { prdQualityScore: prd.prdConfidence } : undefined;

  return (
    <div className="mt-2 w-full overflow-hidden rounded-2xl border border-app-border bg-app-surface">
      <div className="flex items-center justify-between gap-3 border-b border-app-border px-4 py-2.5">
        <p className="text-[11px] font-medium uppercase tracking-wide text-app-ink-mute">PRD</p>
        {jiraKey ? (
          <Link
            to={`${orgPath("pm-agents")}?ticket=${encodeURIComponent(jiraKey)}`}
            className="text-[12px] font-medium text-app-ink-dim hover:text-app-ink"
          >
            Open in Virin
          </Link>
        ) : null}
      </div>
      <div className="max-h-[32rem] overflow-y-auto px-4 py-4">
        <DiscoveryPrdSection parsed={{ generatedPrd: prd }} scores={scores} />
      </div>
    </div>
  );
}

function fileLabel(file) {
  if (typeof file === "string") return file;
  return file?.path || file?.filePath || "file";
}

export function CodeWorkCard({
  files = [],
  plan,
  liveSteps = [],
  status,
  currentAction,
  jiraKey,
  pipelineId,
  prUrl,
  prNumber,
  live = false,
}) {
  const orgPath = useOrgPathBuilder();
  const [openPath, setOpenPath] = useState(null);
  const rows = files.map((file) => ({
    path: fileLabel(file),
    change: file?.change,
    summary: file?.summary,
    content: file?.content,
    diff: file?.diff,
  }));
  const selected = rows.find((file) => file.path === openPath) ?? (live ? rows.at(-1) : null);

  return (
    <div className="mt-2 w-full overflow-hidden rounded-2xl border border-app-border bg-app-surface">
      <div className="flex items-center justify-between gap-3 border-b border-app-border px-4 py-2.5">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-app-ink-mute">
            {live ? "Writing code" : "Code"}
          </p>
          {currentAction ? (
            <p className="mt-0.5 text-[12px] text-app-ink-dim">{currentAction}</p>
          ) : null}
        </div>
        {jiraKey ? (
          <Link
            to={`${orgPath("ananta")}?ticket=${encodeURIComponent(jiraKey)}`}
            className="text-[12px] font-medium text-app-ink-dim hover:text-app-ink"
          >
            Open Ananta
          </Link>
        ) : pipelineId ? (
          <Link
            to={orgPath("pipelines", pipelineId)}
            className="text-[12px] font-medium text-app-ink-dim hover:text-app-ink"
          >
            Open pipeline
          </Link>
        ) : null}
      </div>

      {liveSteps.length > 0 ? (
        <ul className="space-y-1.5 border-b border-app-border px-4 py-3">
          {liveSteps
            .filter((step) => step.status !== "pending")
            .slice(-8)
            .map((step, index) => (
              <li key={`${step.id || step.label}-${index}`} className="flex items-start gap-2">
                <span
                  className={`mt-1 size-1.5 shrink-0 rounded-full ${
                    step.status === "in_progress"
                      ? "animate-pulse bg-indigo"
                      : step.status === "complete"
                        ? "bg-success"
                        : "bg-app-ink-mute/40"
                  }`}
                />
                <span className="text-[13px] leading-relaxed text-app-ink">
                  {step.label}
                  {step.detail ? (
                    <span className="ml-1 font-mono text-[11px] text-app-ink-mute">{step.detail}</span>
                  ) : null}
                </span>
              </li>
            ))}
        </ul>
      ) : null}

      {plan ? (
        <div className="border-b border-app-border px-4 py-3 text-[13px] text-app-ink-dim">
          <ChatMarkdown text={plan} />
        </div>
      ) : null}

      {rows.length > 0 ? (
        <ul className="divide-y divide-app-border">
          {rows.map((file, index) => {
            const active = selected?.path === file.path;
            const writing = live && index === rows.length - 1;
            return (
              <li key={file.path}>
                <button
                  type="button"
                  onClick={() => setOpenPath(active && !writing ? null : file.path)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-app-surface-muted"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    {writing ? <span className="size-1.5 animate-pulse rounded-full bg-indigo" /> : null}
                    <span className="truncate font-mono text-[12px] text-app-ink">{file.path}</span>
                  </span>
                  <span className="shrink-0 text-[11px] text-app-ink-mute">{file.change || "updated"}</span>
                </button>
                {active && (file.content || file.diff || file.summary) ? (
                  <div className="border-t border-app-border bg-app-canvas/40 px-4 py-3">
                    {file.summary ? (
                      <p className="mb-2 text-[12px] text-app-ink-dim">{file.summary}</p>
                    ) : null}
                    <pre className="max-h-56 overflow-auto font-mono text-[11px] leading-relaxed text-app-ink">
                      {file.diff || file.content}
                    </pre>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : live ? (
        <p className="px-4 py-3 text-[13px] text-app-ink-dim">
          {status === "RUNNING" ? "Waiting for the first file…" : "No files staged yet."}
        </p>
      ) : null}

      {prUrl ? (
        <div className="border-t border-app-border px-4 py-2.5">
          <a
            href={prUrl}
            target="_blank"
            rel="noreferrer"
            className="text-[13px] font-medium text-indigo hover:underline"
          >
            {prNumber ? `PR #${prNumber}` : "Open pull request"} ↗
          </a>
        </div>
      ) : null}
    </div>
  );
}

export function QaWorkCard({
  coverage,
  testRun,
  testCases = [],
  recommendation,
  executionMessage,
  jiraKey,
  pipelineId,
  live = false,
}) {
  const orgPath = useOrgPathBuilder();
  const coveragePct = coverage?.coveragePercent;
  const qaHref = pipelineId
    ? `${orgPath("qa")}?pipeline=${encodeURIComponent(pipelineId)}`
    : jiraKey
      ? `${orgPath("qa")}?ticket=${encodeURIComponent(jiraKey)}`
      : orgPath("qa");

  return (
    <div className="mt-2 w-full overflow-hidden rounded-2xl border border-app-border bg-app-surface">
      <div className="flex items-center justify-between gap-3 border-b border-app-border px-4 py-2.5">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-app-ink-mute">
            {live ? "Running QA" : "QA"}
          </p>
          {executionMessage ? (
            <p className="mt-0.5 text-[12px] text-app-ink-dim">{executionMessage}</p>
          ) : null}
        </div>
        <Link to={qaHref} className="text-[12px] font-medium text-app-ink-dim hover:text-app-ink">
          Open Neel
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-2 px-4 py-3">
        <Stat
          label="Coverage"
          value={typeof coveragePct === "number" ? `${coveragePct}%` : "—"}
        />
        <Stat label="Passed" value={testRun?.passed ?? "—"} />
        <Stat label="Failed" value={testRun?.failed ?? "—"} />
      </div>

      {recommendation ? (
        <p className="border-t border-app-border px-4 py-2.5 text-[13px] text-app-ink">
          Recommendation: <span className="font-medium">{String(recommendation).replace(/_/g, " ")}</span>
        </p>
      ) : null}

      {testCases.length > 0 ? (
        <div className="border-t border-app-border">
          <TestCaseViewer testCases={testCases} compact />
        </div>
      ) : live ? (
        <p className="border-t border-app-border px-4 py-3 text-[13px] text-app-ink-dim">
          Neel is writing and running tests. Cases appear here as they complete.
        </p>
      ) : null}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-xl bg-app-surface-muted px-3 py-2">
      <p className="text-[10px] font-medium uppercase tracking-wide text-app-ink-mute">{label}</p>
      <p className="mt-0.5 font-mono text-[14px] text-app-ink">{value}</p>
    </div>
  );
}
