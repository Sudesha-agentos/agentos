import { Link } from "react-router-dom";
import { useMemo } from "react";
import { usePipelineDetail } from "../../entities/pipeline";
import { usePipelineAudit } from "../../entities/audit";
import { usePmAnalysis } from "../../entities/pm-agents";
import Spinner from "../../app/components/Spinner";
import StatusPill from "../../app/components/StatusPill";
import StageRail from "../../shared/components/StageRail";
import StageTimeline from "../../app/components/StageTimeline";
import TicketActivityWidget from "../ticket-activity/TicketActivityWidget";
import ValidationPanelWidget from "../validation-panel/ValidationPanelWidget";
import StagePanelWidget from "../stage-panel/StagePanelWidget";
import PmPipelineDetailPanel from "../pm-analysis/PmPipelineDetailPanel";
import QueuedTicketPanel from "./QueuedTicketPanel";
import { isPmPipelineId, pmPipelineId } from "../pm-analysis/pipelineIds";
import { Panel, PanelHeader } from "../../shared/ui/Panel";
import { formatStageLabel } from "../../shared/lib/format";
import { useOrg } from "../../shared/providers/OrgRouteProvider";

export default function PipelineDetailPanel({ pipelineId, onClose }) {
  if (!pipelineId) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-sm text-app-ink-dim">
        Select a pipeline to inspect Virin stages and agent outputs.
      </div>
    );
  }

  if (pipelineId.startsWith("queued-")) {
    return (
      <QueuedTicketPanel jiraKey={pipelineId.slice("queued-".length)} onClose={onClose} />
    );
  }

  if (isPmPipelineId(pipelineId)) {
    return <PmPipelineDetailPanel pipelineId={pipelineId} onClose={onClose} />;
  }

  return <ClassicPipelineDetailPanel pipelineId={pipelineId} onClose={onClose} />;
}

function ClassicPipelineDetailPanel({ pipelineId, onClose }) {
  const { orgPath } = useOrg();
  const { item, loading, isValidating } = usePipelineDetail(pipelineId, { pollMs: 6000 });
  const { items: auditItems } = usePipelineAudit(pipelineId, { pollMs: 9000 });
  const jiraKey = item?.jiraKey;
  const { data: virinAnalysis, loading: virinLoading } = usePmAnalysis(jiraKey, {
    pollMs: jiraKey ? 3000 : 0,
    skip: !jiraKey,
  });

  const stages = item?.stages ?? [];

  const productStage = useMemo(
    () => stages.find((s) => s.stage === "PRODUCT_AGENT") ?? null,
    [stages]
  );

  const pausedStage = useMemo(
    () =>
      stages.find(
        (s) => s.status === "AWAITING_HUMAN" || s.status === "PAUSED"
      ),
    [stages]
  );

  if (virinAnalysis && !virinLoading) {
    return (
      <PmPipelineDetailPanel pipelineId={pmPipelineId(jiraKey)} onClose={onClose} />
    );
  }

  if (loading && !item) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner label="Loading pipeline" />
      </div>
    );
  }

  if (!item) {
    return (
      <div className="p-8 text-center text-sm text-app-ink-dim">Pipeline not found.</div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="shrink-0 border-b border-app-border bg-app-surface/80 px-5 py-4 backdrop-blur-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-indigo">
              {item.jiraKey}
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-app-ink">{item.summary}</h2>
            {isValidating ? (
              <p className="mt-1 font-mono text-[10px] text-app-ink-mute">Updating…</p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <StatusPill status={item.status} />
            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                className="flex size-8 items-center justify-center rounded-full border border-app-border text-app-ink-mute transition-colors hover:border-app-ink/15 hover:text-app-ink"
                aria-label="Close panel"
              >
                ×
              </button>
            ) : null}
          </div>
        </div>
        <div className="mt-4">
          <StageRail currentStage={item.currentStage} status={item.status} />
          <p className="mt-2 font-mono text-[10.5px] text-ink-mute">
            Current: {formatStageLabel(item.currentStage)}
          </p>
        </div>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
        <Panel>
          <PanelHeader kicker="Ticket" title="Summary" />
          <div className="space-y-2 px-5 py-4 text-[13px] text-ink-dim sm:px-6">
            <p>{item.summary}</p>
          </div>
        </Panel>

        {productStage ? (
          <StagePanelWidget stage={productStage} />
        ) : (
          <Panel>
            <PanelHeader kicker="Discovery" title="Product agent" />
            <p className="px-5 py-4 text-[13px] text-ink-dim sm:px-6">
              Discovery has not started yet — the product agent runs after intake.
            </p>
          </Panel>
        )}

        <details className="rounded-xl border border-hairline bg-surface/20">
          <summary className="cursor-pointer px-5 py-3 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-mute">
            Stage timeline (agent inputs & outputs)
          </summary>
          <div className="border-t border-hairline px-3 py-3">
            <StageTimeline stages={stages} />
          </div>
        </details>

        {item.status === "PAUSED" && pausedStage ? (
          <Panel className="border-warning/30">
            <PanelHeader kicker="Action required" title="Is this safe to continue?" />
            <div className="space-y-4 px-5 py-4 sm:px-6">
              <ValidationPanelWidget validation={pausedStage.validationResult} />
              <div className="flex flex-wrap gap-3">
                <Link
                  to={orgPath("pipelines", item.id, "override")}
                  className="btn-trace rounded-full border border-indigo/50 bg-indigo/10 px-4 py-2 text-[13px] text-ink"
                >
                  Review & override
                </Link>
              </div>
            </div>
          </Panel>
        ) : null}

        <Panel>
          <PanelHeader kicker="Activity" title="What happened and why" />
          <div className="px-3 py-3">
            <TicketActivityWidget
              stages={stages}
              auditLogs={auditItems}
              currentStage={item.currentStage}
            />
          </div>
        </Panel>
      </div>
    </div>
  );
}
