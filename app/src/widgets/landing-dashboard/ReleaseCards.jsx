import { Link } from "react-router-dom";
import { useOrgPathBuilder } from "../../shared/providers/OrgRouteProvider";
import StageRail from "../../shared/components/StageRail";
import ChatMarkdown from "./ChatMarkdown";

const TONE = {
  warning: "border-warning/40 bg-warning/8",
  danger: "border-danger/40 bg-danger/8",
};

export function IssueCard({
  title,
  content,
  tone = "warning",
  pipelineId,
  resumeFrom,
  resumeKind,
  onResume,
  onResumePipeline,
  busy,
}) {
  const orgPath = useOrgPathBuilder();
  const canResumeVirin = onResume && resumeFrom && resumeKind !== "pipeline";
  const canResumePipeline = onResumePipeline && resumeKind === "pipeline" && pipelineId;
  return (
    <div className={`w-full max-w-[36rem] rounded-2xl border px-4 py-3.5 ${TONE[tone] ?? TONE.warning}`} role="alert">
      <p className={`text-[11px] font-semibold uppercase tracking-wide ${tone === "danger" ? "text-danger" : "text-warning"}`}>
        Needs you
      </p>
      <p className="mt-1 text-[15px] font-medium text-app-ink">{title}</p>
      {content ? (
        <div className="mt-1.5 text-[13px] leading-relaxed text-app-ink-dim">
          <ChatMarkdown text={content} />
        </div>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {canResumeVirin ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => onResume(resumeFrom)}
            className="rounded-full bg-app-ink px-3.5 py-1.5 text-[13px] font-medium text-app-canvas disabled:opacity-40"
          >
            {busy ? "Resuming…" : "Resume"}
          </button>
        ) : null}
        {canResumePipeline ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => onResumePipeline(pipelineId)}
            className="rounded-full bg-app-ink px-3.5 py-1.5 text-[13px] font-medium text-app-canvas disabled:opacity-40"
          >
            {busy ? "Resuming…" : "Resume pipeline"}
          </button>
        ) : null}
        {pipelineId ? (
          <Link
            to={orgPath("pipelines", pipelineId)}
            className="rounded-full border border-app-border bg-app-surface px-3.5 py-1.5 text-[13px] font-medium text-app-ink"
          >
            Open pipeline
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export function ConfirmCard({ title, problem, content, variant, onConfirm, busy }) {
  return (
    <div className="w-full max-w-[36rem] rounded-2xl border border-warning/40 bg-warning/8 px-4 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-warning">Your turn</p>
      <p className="mt-1 text-[15px] font-medium text-app-ink">{title}</p>
      {problem ? <p className="mt-2 text-[14px] leading-relaxed text-app-ink">{problem}</p> : null}
      {content ? (
        <div className="mt-2 text-app-ink-dim">
          <ChatMarkdown text={content} />
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || !onConfirm}
          onClick={() => onConfirm?.({ confirmed: true, feedback: variant === "prd_gate" ? "Override PRD gate" : undefined })}
          className="rounded-full bg-app-ink px-3.5 py-1.5 text-[13px] font-medium text-app-canvas disabled:opacity-40"
        >
          {busy ? "Continuing…" : variant === "prd_gate" ? "Override and continue" : "Confirm direction"}
        </button>
        <button
          type="button"
          disabled={busy || !onConfirm}
          onClick={() => onConfirm?.({ confirmed: false, feedback: variant === "prd_gate" ? "Revise the PRD" : "Revise the approach" })}
          className="rounded-full border border-app-border bg-app-surface px-3.5 py-1.5 text-[13px] font-medium text-app-ink disabled:opacity-40"
        >
          Request revisions
        </button>
      </div>
    </div>
  );
}

export function HandoffCard({ content, tickets = [], handoffStatus, jiraKey, onStartHandoff, busy }) {
  const orgPath = useOrgPathBuilder();
  const started = ["enqueued", "running", "completed"].includes(handoffStatus);
  return (
    <div className="w-full max-w-[36rem] rounded-2xl border border-app-border bg-app-surface px-4 py-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-app-ink-mute">Handover</p>
      <p className="mt-1 text-[15px] font-medium text-app-ink">Engineering tickets for Ananta</p>
      <div className="mt-2">
        <ChatMarkdown text={content} />
      </div>
      {tickets.length > 8 ? (
        <p className="mt-1 text-[12px] text-app-ink-mute">+{tickets.length - 8} more</p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        {!started ? (
          <button
            type="button"
            disabled={busy || !onStartHandoff}
            onClick={() => onStartHandoff?.()}
            className="rounded-full bg-app-ink px-3.5 py-1.5 text-[13px] font-medium text-app-canvas disabled:opacity-40"
          >
            {busy ? "Starting…" : "Send to Ananta"}
          </button>
        ) : (
          <p className="text-[12px] text-app-ink-mute">Handoff {handoffStatus}</p>
        )}
        {jiraKey ? (
          <Link
            to={`${orgPath("ananta")}?ticket=${encodeURIComponent(jiraKey)}`}
            className="rounded-full border border-app-border px-3.5 py-1.5 text-[13px] font-medium text-app-ink"
          >
            Open Ananta
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export function PipelineCard({ currentStage, status, currentStageLabel, content, pipelineId }) {
  const orgPath = useOrgPathBuilder();
  return (
    <div className="w-full max-w-[36rem] rounded-2xl border border-app-border bg-app-surface px-4 py-3.5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-medium uppercase tracking-wide text-app-ink-mute">Coding pipeline</p>
        <p className="text-[11px] text-app-ink-mute">{currentStageLabel}</p>
      </div>
      <div className="mt-3">
        <StageRail currentStage={currentStage} status={status} compact />
      </div>
      {content ? <p className="mt-2 text-[13px] leading-relaxed text-app-ink-dim">{content}</p> : null}
      {pipelineId ? (
        <Link
          to={orgPath("pipelines", pipelineId)}
          className="mt-3 inline-flex text-[12px] font-medium text-app-ink-dim hover:text-app-ink"
        >
          Open full pipeline
        </Link>
      ) : null}
    </div>
  );
}

export function ProgressHeader({ progress }) {
  if (!progress) return null;
  return (
    <div className="sticky top-0 z-[5] mb-1 bg-gradient-to-b from-app-canvas via-app-canvas to-transparent pb-3 pt-1">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-app-ink-mute">{progress.label}</span>
        <span className="font-mono text-app-ink-mute">{progress.pct}%</span>
      </div>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-app-surface-muted">
        <div
          className="h-full rounded-full bg-indigo transition-all duration-500"
          style={{ width: `${progress.pct}%` }}
        />
      </div>
    </div>
  );
}
