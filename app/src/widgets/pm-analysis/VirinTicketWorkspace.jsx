import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  PM_STAGE_LABELS,
  PM_STAGE_ORDER,
  VIRIN_NAME,
  getDiscoveryQuestionProgress,
  getIntakeClarifyingProgress,
} from "../../entities/pm-agents";
import { usePipelineList } from "../../entities/pipeline";
import { Panel, PanelHeader } from "../../shared/ui/Panel";
import { VirinStatusBadge, VirinTicketTypeBadge } from "./VirinStatusBadge";
import { VirinStageStepper } from "./VirinStageStepper";
import {
  DiscoveryQuestionProgress,
  VirinCodebaseSection,
  VirinConversationPanel,
  VirinDiscoverySection,
  VirinHandoffPackageSection,
  VirinIntakeSection,
} from "./VirinSections";
import {
  VirinCodebaseSignalsSection,
  VirinOrgIntelligenceSection,
  VirinSynthesisSection,
  VirinTicketGraphSection,
} from "./VirinContextPanels";
import { CompetitorAnalysisSection } from "./CompetitorAnalysisSection";
import DiscoveryPrdSection from "../discovery/DiscoveryPrdSection";
import { PmTechHandoffSection } from "./PmAnalysisSections";
import StageRail from "../../shared/components/StageRail";
import Spinner from "../../app/components/Spinner";
import { useOrgPathBuilder } from "../../shared/providers/OrgRouteProvider";

function stageIndex(stageId) {
  return PM_STAGE_ORDER.indexOf(stageId);
}

function stageIsDone(analysis, stageId) {
  const meta = analysis?.stageMeta ?? [];
  return meta.some((m) => m.stage === stageId && m.status === "COMPLETED");
}

function StageSkeleton({ label }) {
  return (
    <div className="rounded-app border border-dashed border-app-border bg-app-surface-muted/20 px-5 py-8 text-center">
      <Spinner label={label} />
      <p className="mt-3 text-[13px] text-app-ink-dim">{label}</p>
    </div>
  );
}

function StagePanel({ stageId, analysis, children, pendingLabel }) {
  const done = stageIsDone(analysis, stageId);
  const running = analysis?.currentStage === stageId && analysis?.status === "RUNNING";

  if (children) {
    return <div className="space-y-4">{children}</div>;
  }

  if (running) {
    return <StageSkeleton label={`${PM_STAGE_LABELS[stageId]} in progress…`} />;
  }

  if (!done) {
    return (
      <p className="rounded-app border border-app-border bg-app-surface-muted/20 px-4 py-6 text-[13px] text-app-ink-dim">
        {pendingLabel ?? `${PM_STAGE_LABELS[stageId]} has not run yet.`}
      </p>
    );
  }

  return null;
}

function DesignStageContent({ systemDesign }) {
  if (!systemDesign) return null;
  return (
    <Panel>
      <PanelHeader kicker="Stage 5" title="System design" />
      <div className="space-y-4 px-5 py-5 sm:px-6">
        {systemDesign.summaryMarkdown ? (
          <pre className="whitespace-pre-wrap text-[13px] text-app-ink-dim">
            {systemDesign.summaryMarkdown}
          </pre>
        ) : null}
        {systemDesign.fileList?.length ? (
          <div>
            <p className="type-kicker">File list</p>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-[13px] text-app-ink-dim">
              {systemDesign.fileList.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </Panel>
  );
}

function TaskStageContent({ taskBreakdown }) {
  if (!taskBreakdown?.length) return null;
  return (
    <Panel>
      <PanelHeader kicker="Stage 6" title="Task plan" />
      <ul className="divide-y divide-app-border px-5 py-2 sm:px-6">
        {taskBreakdown.map((task) => (
          <li key={task.id} className="py-4">
            <p className="font-mono text-[12px] text-indigo">{task.id}</p>
            <p className="mt-1 text-[14px] font-medium text-app-ink">{task.title}</p>
            {task.description ? (
              <p className="mt-1 text-[13px] text-app-ink-dim">{task.description}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function SolutionStageContent({ analysis }) {
  const sol = analysis.solutioning;
  if (!sol || analysis.status === "AWAITING_CONFIRMATION") return null;
  const orgIntel =
    analysis.context?.orgIntelligenceSummary ?? analysis.orgIntelligenceSummary;
  return (
    <div className="space-y-4">
      {orgIntel ? <VirinOrgIntelligenceSection summary={orgIntel} /> : null}
      <Panel>
        <PanelHeader kicker="Stage 7" title="Solution direction" />
        <div className="px-5 py-4 sm:px-6">
          <p className="text-[14px] font-medium text-app-ink">{sol.problemStatement}</p>
          <div className="mt-4 whitespace-pre-wrap text-[14px] leading-relaxed text-app-ink-dim">
            {sol.summaryMarkdown ?? sol.recommendedApproach}
          </div>
        </div>
      </Panel>
    </div>
  );
}

function EngineeringProgress({ jiraKey }) {
  const orgPath = useOrgPathBuilder();
  const { items } = usePipelineList(undefined, { pollMs: 8000 });
  const pipeline = items.find((p) => p.jiraKey === jiraKey);

  if (!pipeline) return null;

  return (
    <Panel>
      <PanelHeader
        kicker="Engineering"
        title="Implementation pipeline"
        right={
          <Link
            to={orgPath("pipelines", pipeline.id)}
            className="text-[12px] text-indigo hover:underline"
          >
            Open full trace →
          </Link>
        }
      />
      <div className="px-5 py-4 sm:px-6">
        <StageRail currentStage={pipeline.currentStage} status={pipeline.status} />
        <p className="mt-2 text-[13px] text-app-ink-dim">
          Status: {pipeline.status} · Stage: {pipeline.currentStage}
        </p>
      </div>
    </Panel>
  );
}

function gateStageForAnalysis(analysis) {
  if (analysis?.status === "AWAITING_CONFIRMATION") return "SOLUTIONING";
  if (analysis?.status === "AWAITING_INPUT") {
    return analysis.pendingQuestionStage ?? analysis.currentStage ?? "QUESTION_MODE";
  }
  return analysis?.currentStage ?? "INTAKE";
}

function AwaitingInputBanner({ analysis, handlers }) {
  if (
    analysis.status !== "AWAITING_INPUT" &&
    analysis.status !== "AWAITING_CONFIRMATION"
  ) {
    return null;
  }

  return (
    <Panel className="border-warning/30 bg-warning/5">
      <PanelHeader
        kicker="Your turn"
        title={
          analysis.status === "AWAITING_CONFIRMATION"
            ? "Confirm solution direction"
            : "Virin needs your input to continue"
        }
        subtitle={
          analysis.status === "AWAITING_INPUT"
            ? getIntakeClarifyingProgress(analysis)?.label ??
              getDiscoveryQuestionProgress(analysis)?.label ??
              `${PM_STAGE_LABELS[gateStageForAnalysis(analysis)] ?? "Next stage"} is waiting on an answer.`
            : "Review the recommended approach and confirm or revise."
        }
      />
      {analysis.status === "AWAITING_INPUT" &&
      (getDiscoveryQuestionProgress(analysis) || getIntakeClarifyingProgress(analysis)) ? (
        <div className="border-b border-app-border px-5 py-3 sm:px-6">
          <DiscoveryQuestionProgress analysis={analysis} />
        </div>
      ) : null}
      <div className="px-5 py-4 sm:px-6">
        <VirinConversationPanel
          analysis={analysis}
          onAnswer={handlers.onAnswer}
          onConfirm={handlers.onConfirm}
          busy={handlers.interactionBusy}
          prominent
        />
      </div>
    </Panel>
  );
}

function renderStageContent(stageId, analysis, handlers) {
  const orgIntel =
    analysis.context?.orgIntelligenceSummary ?? analysis.orgIntelligenceSummary;
  const relatedContext = analysis.ticketInput?.relatedContext;

  switch (stageId) {
    case "INTAKE":
      return (
        <StagePanel stageId={stageId} analysis={analysis} pendingLabel="Waiting for intake…">
          <div className="space-y-4">
            <VirinTicketGraphSection relatedContext={relatedContext} defaultOpen />
            <VirinCodebaseSignalsSection context={analysis.context} />
            {analysis.neelIntake ? <VirinIntakeSection intake={analysis.neelIntake} /> : null}
          </div>
        </StagePanel>
      );
    case "QUESTION_MODE":
      return (
        <StagePanel stageId={stageId} analysis={analysis} pendingLabel="Discovery conversation pending…">
          {(analysis.questionMode || analysis.status === "AWAITING_INPUT") && (
            <div className="space-y-4">
              <VirinTicketGraphSection relatedContext={relatedContext} />
              <VirinDiscoverySection
                questionMode={analysis.questionMode}
                analysis={analysis}
                expanded
              />
            </div>
          )}
        </StagePanel>
      );
    case "COMPETITOR_ANALYSIS":
      return (
        <StagePanel stageId={stageId} analysis={analysis}>
          <div className="space-y-4">
            {analysis.competitorAnalysis ? (
              <CompetitorAnalysisSection
                competitorAnalysis={analysis.competitorAnalysis}
                expanded
              />
            ) : null}
          </div>
        </StagePanel>
      );
    case "CODEBASE_ANALYSIS":
      return (
        <StagePanel stageId={stageId} analysis={analysis} pendingLabel="Codebase analysis pending…">
          {analysis.codebaseAnalysis ? (
            <VirinCodebaseSection analysis={analysis.codebaseAnalysis} expanded />
          ) : null}
        </StagePanel>
      );
    case "SYSTEM_DESIGN":
      return (
        <StagePanel stageId={stageId} analysis={analysis}>
          <DesignStageContent systemDesign={analysis.systemDesign} />
        </StagePanel>
      );
    case "TASK_PLANNING":
      return (
        <StagePanel stageId={stageId} analysis={analysis}>
          <TaskStageContent taskBreakdown={analysis.taskBreakdown} />
        </StagePanel>
      );
    case "SOLUTIONING":
      return (
        <StagePanel stageId={stageId} analysis={analysis}>
          {analysis.status === "AWAITING_CONFIRMATION" ? (
            <p className="text-[13px] text-app-ink-dim">
              Use the confirmation panel above to approve or revise this direction before PRD
              generation.
            </p>
          ) : (
            <SolutionStageContent analysis={analysis} />
          )}
        </StagePanel>
      );
    case "PRD":
      return (
        <StagePanel stageId={stageId} analysis={analysis} pendingLabel="PRD not generated yet.">
          {analysis.generatedPrd ? (
            <div className="space-y-4">
              {orgIntel ? <VirinOrgIntelligenceSection summary={orgIntel} /> : null}
              <VirinSynthesisSection
                synthesisSummary={analysis.synthesisSummary}
                similarPastWork={analysis.similarPastWork}
              />
              <Panel>
                <PanelHeader kicker="Stage 8" title="PRD generation" />
                <div className="px-5 py-5 sm:px-6">
                  <DiscoveryPrdSection parsed={{ generatedPrd: analysis.generatedPrd }} />
                </div>
              </Panel>
            </div>
          ) : null}
        </StagePanel>
      );
    case "HANDOFF":
      return (
        <StagePanel stageId={stageId} analysis={analysis} pendingLabel="Handoff package pending…">
          {analysis.handoffPackage ? (
            <VirinHandoffPackageSection handoffPackage={analysis.handoffPackage} expanded />
          ) : null}
        </StagePanel>
      );
    default:
      return null;
  }
}

export function VirinTicketWorkspace({
  analysis,
  historyItems,
  activeKey,
  onSelectTicket,
  onAnswer,
  onConfirm,
  interactionBusy,
  onResume,
  resuming,
  resumeStageLabel,
  onExportPackage,
  exportBusy,
  compact = false,
  showHistory = true,
  embedded = false,
  isValidating = false,
}) {
  const initialStage = gateStageForAnalysis(analysis);
  const [activeStage, setActiveStage] = useState(initialStage);
  const prevStatusRef = useRef(analysis?.status);

  useEffect(() => {
    if (!analysis) return;
    setActiveStage(gateStageForAnalysis(analysis));
  }, [analysis?.jiraKey]);

  useEffect(() => {
    if (!analysis) return;
    const prev = prevStatusRef.current;
    prevStatusRef.current = analysis.status;
    if (prev === analysis.status) return;
    if (analysis.status === "AWAITING_INPUT" || analysis.status === "AWAITING_CONFIRMATION") {
      setActiveStage(gateStageForAnalysis(analysis));
    }
  }, [analysis?.status, analysis?.pendingQuestionStage, analysis?.jiraKey]);

  if (!analysis) {
    return (
      <div className="rounded-app border border-dashed border-app-border px-6 py-16 text-center">
        <Spinner label={`Loading ${VIRIN_NAME}`} />
      </div>
    );
  }

  const needsYou =
    analysis.status === "AWAITING_INPUT" || analysis.status === "AWAITING_CONFIRMATION";
  const handlers = { onAnswer, onConfirm, interactionBusy };
  const intakeRunning =
    analysis.status === "RUNNING" && analysis.currentStage === "INTAKE" && !analysis.neelIntake;

  return (
    <div className="grid gap-6 xl:grid-cols-[240px_minmax(0,1fr)]">
      {!compact ? (
        <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <Panel>
            <PanelHeader kicker="Progress" title={`${VIRIN_NAME} · 9 stages`} />
            <div className="px-4 py-4 sm:px-5">
              <VirinStageStepper
                analysis={analysis}
                activeStage={activeStage}
                onSelectStage={setActiveStage}
              />
            </div>
          </Panel>
          {showHistory && historyItems?.length > 0 ? (
            <Panel>
              <PanelHeader kicker="Sessions" title="Recent" />
              <ul className="max-h-[240px] overflow-y-auto px-2 py-2">
                {historyItems.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => onSelectTicket?.(item.jiraKey)}
                      className={`w-full rounded-app-sm px-3 py-2.5 text-left transition ${
                        activeKey === item.jiraKey
                          ? "bg-indigo/10 ring-1 ring-indigo/20"
                          : "hover:bg-app-surface-muted/50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[11px] font-medium text-app-ink">
                          {item.jiraKey}
                        </span>
                        <VirinStatusBadge status={item.status} />
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}
        </aside>
      ) : null}

      <div className="min-w-0 space-y-5">
        {!embedded ? (
          <div
            className={`rounded-app border px-5 py-5 sm:px-6 ${
              needsYou
                ? "border-warning/30 bg-gradient-to-br from-warning/5 via-app-surface to-indigo/5"
                : "border-app-border bg-app-surface shadow-app-card"
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-mono text-[13px] font-semibold text-indigo">
                    {analysis.jiraKey}
                  </h2>
                  <VirinStatusBadge status={analysis.status} />
                  <VirinTicketTypeBadge type={analysis.neelIntake?.ticketType} />
                  {isValidating ? (
                    <span className="font-mono text-[10px] text-app-ink-mute">Updating…</span>
                  ) : null}
                </div>
                <p className="mt-1.5 text-[15px] font-medium text-app-ink">
                  {analysis.ticketInput?.summary ?? "Ticket analysis"}
                </p>
                <p className="mt-2 text-[13px] text-app-ink-dim">
                  {PM_STAGE_LABELS[activeStage] ?? "Starting"}
                </p>
              </div>
              {analysis.generatedPrd && onExportPackage ? (
                <button
                  type="button"
                  disabled={exportBusy}
                  onClick={onExportPackage}
                  className="rounded-app-sm border border-app-border px-3 py-1.5 text-[12px] text-app-ink-dim hover:text-app-ink disabled:opacity-50"
                >
                  {exportBusy ? "Exporting…" : "Export package"}
                </button>
              ) : null}
            </div>
            {compact ? (
              <div className="mt-4">
                <VirinStageStepper analysis={analysis} compact />
              </div>
            ) : null}
          </div>
        ) : null}

        {intakeRunning ? (
          <StageSkeleton label={`${VIRIN_NAME} is reading the ticket (Stage 1)…`} />
        ) : null}

        {analysis.status === "RUNNING" &&
        analysis.currentStage === "QUESTION_MODE" &&
        !analysis.questionMode?.conversation?.length ? (
          <StageSkeleton label={`${VIRIN_NAME} is preparing the first discovery question…`} />
        ) : null}

        <AwaitingInputBanner analysis={analysis} handlers={handlers} />

        {analysis.ticketInput?.relatedContext &&
        !["INTAKE", "QUESTION_MODE"].includes(activeStage) ? (
          <VirinTicketGraphSection relatedContext={analysis.ticketInput.relatedContext} />
        ) : null}

        {analysis.status === "FAILED" && analysis.error ? (
          <Panel>
            <PanelHeader
              kicker="Error"
              title="Run failed"
              right={
                onResume ? (
                  <button
                    type="button"
                    disabled={resuming}
                    onClick={onResume}
                    className="app-btn-primary text-[12px] disabled:opacity-50"
                  >
                    {resuming ? "Resuming…" : `Resume${resumeStageLabel ? ` · ${resumeStageLabel}` : ""}`}
                  </button>
                ) : null
              }
            />
            <p className="px-5 py-4 text-[13px] text-danger sm:px-6">{analysis.error}</p>
          </Panel>
        ) : null}

        <Panel>
          <PanelHeader
            kicker={`Stage ${stageIndex(activeStage) + 1}`}
            title={PM_STAGE_LABELS[activeStage]}
            subtitle={
              activeStage === "QUESTION_MODE"
                ? getDiscoveryQuestionProgress(analysis)?.label
                : undefined
            }
            right={
              activeStage === "QUESTION_MODE" &&
              getDiscoveryQuestionProgress(analysis)?.shortLabel ? (
                <span className="font-mono text-[11px] text-app-ink-mute">
                  {getDiscoveryQuestionProgress(analysis).shortLabel}
                </span>
              ) : null
            }
          />
          {activeStage === "QUESTION_MODE" ? (
            <div className="border-b border-app-border px-5 py-3 sm:px-6">
              <DiscoveryQuestionProgress analysis={analysis} />
            </div>
          ) : null}
          <div className="px-5 py-5 sm:px-6">
            {renderStageContent(activeStage, analysis, handlers)}
          </div>
        </Panel>

        <details className="rounded-app border border-app-border">
          <summary className="cursor-pointer px-5 py-3 text-[13px] font-medium text-app-ink-dim">
            All completed stages
          </summary>
          <div className="space-y-4 border-t border-app-border px-5 py-4">
            {PM_STAGE_ORDER.filter((s) => stageIsDone(analysis, s) && s !== activeStage).map(
              (stageId) => (
                <div key={stageId}>
                  <p className="type-kicker mb-2">{PM_STAGE_LABELS[stageId]}</p>
                  {renderStageContent(stageId, analysis, handlers)}
                </div>
              )
            )}
          </div>
        </details>

        {stageIsDone(analysis, "HANDOFF") ? (
          <div className="space-y-4">
            <PmTechHandoffSection
              jiraKey={analysis.jiraKey}
              analysisComplete={analysis.status === "COMPLETED"}
            />
            <EngineeringProgress jiraKey={analysis.jiraKey} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
