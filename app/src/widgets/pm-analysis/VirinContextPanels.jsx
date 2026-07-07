import { Panel, PanelHeader } from "../../shared/ui/Panel";

function truncate(text, max = 400) {
  if (!text || text.length <= max) return text ?? "";
  return `${text.slice(0, max)}…`;
}

function RelatedTicketCard({ detail, label }) {
  if (!detail) return null;
  return (
    <article className="rounded-app-sm border border-app-border bg-app-surface-muted/25 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[11px] font-semibold text-indigo">{detail.key}</span>
        <span className="text-[10px] uppercase text-app-ink-mute">{label}</span>
        <span className="text-[10px] text-app-ink-mute">
          {detail.issueType} · {detail.status}
        </span>
      </div>
      <p className="mt-2 text-[14px] font-medium text-app-ink">{detail.summary}</p>
      {detail.description?.trim() ? (
        <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-app-ink-dim">
          {truncate(detail.description, 600)}
        </p>
      ) : null}
      {detail.commentsText?.trim() ? (
        <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap rounded-app-sm border border-app-border/60 bg-app-surface px-2 py-2 font-mono text-[10px] text-app-ink-dim">
          {truncate(detail.commentsText, 320)}
        </pre>
      ) : null}
    </article>
  );
}

/** Epic, subtasks, and linked issues from Jira ticket graph. */
export function VirinTicketGraphSection({ relatedContext, defaultOpen = false }) {
  if (!relatedContext) return null;

  const hasContent =
    relatedContext.epic ||
    relatedContext.subtasks?.length > 0 ||
    relatedContext.linkedIssues?.length > 0;

  if (!hasContent) return null;

  return (
    <details
      className="group rounded-app border border-app-border bg-app-surface"
      open={defaultOpen}
    >
      <summary className="cursor-pointer list-none px-5 py-4 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="type-kicker">Ticket graph</p>
            <p className="mt-1 text-[14px] font-medium text-app-ink">
              Epic, subtasks & linked issues
            </p>
          </div>
          <span className="font-mono text-[10px] text-app-ink-mute group-open:hidden">Show</span>
        </div>
      </summary>
      <div className="space-y-4 border-t border-app-border px-5 py-4 sm:px-6">
        {relatedContext.epic ? (
          <RelatedTicketCard detail={relatedContext.epic} label="Parent epic" />
        ) : null}
        {relatedContext.subtasks?.length > 0 ? (
          <div>
            <p className="type-kicker mb-2">Subtasks</p>
            <div className="space-y-3">
              {relatedContext.subtasks.map((s) => (
                <RelatedTicketCard key={s.key} detail={s} label="Subtask" />
              ))}
            </div>
          </div>
        ) : null}
        {relatedContext.linkedIssues?.length > 0 ? (
          <div>
            <p className="type-kicker mb-2">Linked issues</p>
            <div className="space-y-3">
              {relatedContext.linkedIssues.map((l) => (
                <RelatedTicketCard key={l.key} detail={l} label="Linked" />
              ))}
            </div>
          </div>
        ) : null}
        {relatedContext.notes?.length > 0 ? (
          <p className="text-[12px] text-app-ink-mute">{relatedContext.notes.join("; ")}</p>
        ) : null}
      </div>
    </details>
  );
}

/** Org-intelligence signals filtered for this ticket's area. */
export function VirinOrgIntelligenceSection({ summary }) {
  if (!summary?.trim()) return null;
  if (/no recent|unavailable|not configured/i.test(summary)) return null;

  return (
    <Panel className="border-warning/20">
      <PanelHeader
        kicker="Org intelligence"
        title="Signals in this area"
        subtitle="Past QA failures, overrides, canary findings, and pipeline outcomes"
      />
      <pre className="max-h-72 overflow-auto whitespace-pre-wrap px-5 py-4 font-mono text-[11px] leading-relaxed text-app-ink-dim sm:px-6">
        {summary}
      </pre>
    </Panel>
  );
}

/** RAG synthesis from similar past work. */
export function VirinSynthesisSection({ synthesisSummary, similarPastWork }) {
  const hasSummary =
    synthesisSummary &&
    (synthesisSummary.reusedPatterns?.length > 0 ||
      synthesisSummary.knownFailures?.length > 0 ||
      synthesisSummary.impliedRequirements?.length > 0 ||
      synthesisSummary.historicalCoverage > 0);

  const hasPastWork = similarPastWork?.length > 0;

  if (!hasSummary && !hasPastWork) return null;

  return (
    <Panel>
      <PanelHeader
        kicker="Historical context"
        title="Similar past work & RAG signals"
        subtitle={
          synthesisSummary?.historicalCoverage != null
            ? `Historical coverage ${Math.round(synthesisSummary.historicalCoverage * 100)}%`
            : undefined
        }
      />
      <div className="space-y-4 px-5 py-4 sm:px-6">
        {synthesisSummary?.reusedPatterns?.length > 0 ? (
          <BulletBlock label="Reused patterns" items={synthesisSummary.reusedPatterns} />
        ) : null}
        {synthesisSummary?.knownFailures?.length > 0 ? (
          <BulletBlock label="Known failures" items={synthesisSummary.knownFailures} tone="warning" />
        ) : null}
        {synthesisSummary?.impliedRequirements?.length > 0 ? (
          <BulletBlock label="Implied requirements" items={synthesisSummary.impliedRequirements} />
        ) : null}
        {synthesisSummary?.blockingGaps > 0 ? (
          <p className="text-[12px] text-app-ink-mute">
            {synthesisSummary.blockingGaps} borderline RAG hit
            {synthesisSummary.blockingGaps === 1 ? "" : "s"} below similarity threshold
          </p>
        ) : null}
        {hasPastWork ? (
          <details className="rounded-app-sm border border-app-border">
            <summary className="cursor-pointer px-4 py-3 text-[13px] font-medium text-app-ink-dim hover:text-app-ink">
              {similarPastWork.length} similar PRD / implementation hit
              {similarPastWork.length === 1 ? "" : "s"}
            </summary>
            <ul className="divide-y divide-app-border border-t border-app-border">
              {similarPastWork.slice(0, 6).map((hit) => (
                <li key={`${hit.jiraKey}-${hit.contentType}`} className="px-4 py-3">
                  <p className="font-mono text-[11px] text-indigo">
                    {hit.jiraKey} · {hit.contentType} · sim={hit.similarity?.toFixed?.(2) ?? hit.similarity}
                  </p>
                  {hit.summary ? (
                    <p className="mt-1 text-[13px] font-medium text-app-ink">{hit.summary}</p>
                  ) : null}
                  <p className="mt-1 text-[12px] text-app-ink-dim">
                    {truncate(hit.content?.replace(/\s+/g, " "), 280)}
                  </p>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>
    </Panel>
  );
}

/** Real pipeline/codebase signals from context gathering. */
export function VirinCodebaseSignalsSection({ context }) {
  if (!context) return null;

  const rows = [
    context.reporterTier ? { label: "Reporter tier", value: context.reporterTier } : null,
    context.churnRate ? { label: "File churn (30d)", value: context.churnRate } : null,
    context.capacityRemaining ? { label: "Pipeline capacity", value: context.capacityRemaining } : null,
    context.inflightCount ? { label: "In-flight pipelines", value: context.inflightCount } : null,
    context.componentBugCount ? { label: "Component bugs", value: context.componentBugCount } : null,
  ].filter(Boolean);

  if (rows.length === 0) return null;

  return (
    <details className="rounded-app border border-app-border bg-app-surface-muted/20">
      <summary className="cursor-pointer px-5 py-3 text-[13px] font-medium text-app-ink-dim hover:text-app-ink sm:px-6">
        Codebase & pipeline signals
      </summary>
      <dl className="grid gap-3 border-t border-app-border px-5 py-4 sm:grid-cols-2 sm:px-6">
        {rows.map((row) => (
          <div key={row.label}>
            <dt className="type-kicker">{row.label}</dt>
            <dd className="mt-1 text-[13px] text-app-ink-dim">{row.value}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

function BulletBlock({ label, items, tone }) {
  return (
    <div>
      <p className={`type-kicker mb-2 ${tone === "warning" ? "text-warning" : ""}`}>{label}</p>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li
            key={item}
            className={`flex gap-2 text-[13px] ${
              tone === "warning" ? "text-warning/90" : "text-app-ink-dim"
            }`}
          >
            <span aria-hidden>•</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
