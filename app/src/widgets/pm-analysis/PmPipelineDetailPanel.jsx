import { useState } from "react";
import { Link } from "react-router-dom";
import { AGENT_NAMES } from "../../shared/config/app";
import {
  answerVirinQuestion,
  confirmVirinDirection,
  exportProductPackage,
  getPmResumeStage,
  resumePmAnalysis,
  runPmRetrospective,
  usePmAnalysis,
  PM_STAGE_LABELS,
  VIRIN_NAME,
} from "../../entities/pm-agents";
import Spinner from "../../app/components/Spinner";
import PmStageRail from "./PmStageRail";
import { VirinStatusBadge } from "./VirinStatusBadge";
import { jiraKeyFromPmPipelineId } from "./pipelineIds";
import { VirinTicketWorkspace } from "./VirinTicketWorkspace";
import { Panel, PanelHeader } from "../../shared/ui/Panel";
import { useOrgPathBuilder } from "../../shared/providers/OrgRouteProvider";

export default function PmPipelineDetailPanel({ pipelineId, onClose }) {
  const orgPath = useOrgPathBuilder();
  const jiraKey = jiraKeyFromPmPipelineId(pipelineId);
  const [retroRunning, setRetroRunning] = useState(false);
  const [interactionBusy, setInteractionBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [resuming, setResuming] = useState(false);

  const { data: analysis, loading, isValidating, refetch } = usePmAnalysis(jiraKey, {
    pollMs: 2500,
  });

  const isRunning = analysis?.status === "RUNNING";

  async function handleAnswer(answer) {
    setInteractionBusy(true);
    try {
      await answerVirinQuestion(jiraKey, answer);
      await refetch();
    } finally {
      setInteractionBusy(false);
    }
  }

  async function handleConfirm(body) {
    setInteractionBusy(true);
    try {
      await confirmVirinDirection(jiraKey, body);
      await refetch();
    } finally {
      setInteractionBusy(false);
    }
  }

  async function handleResume() {
    const resumeFrom = getPmResumeStage(analysis);
    if (!resumeFrom) return;
    setResuming(true);
    try {
      await resumePmAnalysis(jiraKey, { resumeFrom });
      await refetch();
    } finally {
      setResuming(false);
    }
  }

  async function handleRetrospective() {
    setRetroRunning(true);
    try {
      await runPmRetrospective(jiraKey, {});
      await refetch();
    } finally {
      setRetroRunning(false);
    }
  }

  async function handleExportPackage() {
    setExportBusy(true);
    try {
      const pkg = await exportProductPackage(jiraKey);
      const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${jiraKey}-product-package.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExportBusy(false);
    }
  }

  if (!pipelineId) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-sm text-ink-dim">
        Select a pipeline to inspect stages and agent outputs.
      </div>
    );
  }

  if (loading && !analysis) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner label={`Loading ${VIRIN_NAME} analysis`} />
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="p-8 text-center text-sm text-ink-dim">{VIRIN_NAME} analysis not found.</div>
    );
  }

  const currentLabel = analysis.currentStage
    ? PM_STAGE_LABELS[analysis.currentStage]
    : analysis.status === "COMPLETED"
      ? "Complete"
      : "—";

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="shrink-0 border-b border-hairline px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <p className="font-mono text-[11px] text-indigo">{analysis.jiraKey}</p>
              <span className="rounded-full border border-indigo/30 bg-indigo/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-indigo">
                {AGENT_NAMES.VIRIN}
              </span>
            </div>
            <h2 className="mt-1 font-display text-xl text-ink">
              {analysis.ticketInput?.summary ?? `${VIRIN_NAME} analysis`}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {analysis.generatedPrd ? (
              <button
                type="button"
                disabled={exportBusy}
                onClick={handleExportPackage}
                className="rounded-full border border-hairline px-3 py-1 text-[11px] text-ink-dim hover:text-ink disabled:opacity-50"
              >
                {exportBusy ? "Exporting…" : "Export"}
              </button>
            ) : null}
            <VirinStatusBadge status={analysis.status} />
            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-hairline px-2 py-1 text-ink-mute hover:text-ink"
                aria-label="Close panel"
              >
                ×
              </button>
            ) : null}
          </div>
        </div>
        <div className="mt-4">
          <PmStageRail
            currentStage={analysis.currentStage}
            status={analysis.status}
            stageMeta={analysis.stageMeta}
          />
          <p className="mt-2 font-mono text-[10.5px] text-ink-mute">
            Current: {currentLabel}
            {isRunning || isValidating ? " · updating live" : ""}
          </p>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        {analysis.classification?.requiresHumanEscalation && (
          <Panel className="mb-5 border-warning/30">
            <PanelHeader
              kicker="Action required"
              title="Human escalation flagged"
              subtitle={analysis.classification.escalationReason ?? "Review classification before proceeding."}
            />
            <div className="px-5 py-3 sm:px-6">
              <Link
                to={orgPath("pm-agents")}
                className="font-mono text-[11px] text-indigo hover:underline"
              >
                Open {AGENT_NAMES.VIRIN} →
              </Link>
            </div>
          </Panel>
        )}

        <VirinTicketWorkspace
          analysis={analysis}
          activeKey={jiraKey}
          onAnswer={handleAnswer}
          onConfirm={handleConfirm}
          interactionBusy={interactionBusy}
          onRetrospective={analysis.status === "COMPLETED" ? handleRetrospective : undefined}
          retroRunning={retroRunning}
          onResume={analysis.status === "FAILED" ? handleResume : undefined}
          resuming={resuming}
          resumeStageLabel={
            analysis.status === "FAILED"
              ? PM_STAGE_LABELS[getPmResumeStage(analysis)] ?? null
              : null
          }
          onExportPackage={handleExportPackage}
          exportBusy={exportBusy}
          showHistory={false}
          embedded
          isValidating={isValidating}
        />
      </div>
    </div>
  );
}
