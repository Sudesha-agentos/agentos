import LabelPill from "../../app/components/LabelPill";
import { formatScorePercent } from "../../entities/discovery";

export default function DiscoveryContextSection({
  retrievalContext = [],
  historicalIntelligence,
}) {
  const tickets = retrievalContext.filter((item) => item.kind === "ticket");
  const codebase = retrievalContext.filter((item) => item.kind === "codebase");
  const patterns = historicalIntelligence?.technicalPatterns ?? [];
  const reuse = historicalIntelligence?.reuseOpportunities ?? [];

  if (
    !tickets.length &&
    !codebase.length &&
    !patterns.length &&
    !reuse.length
  ) {
    return (
      <p className="text-[13px] text-ink-dim">
        No similar tickets or codebase context was retrieved from the vector DB
        for this run.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {tickets.length > 0 ? (
        <Block title={`Similar tickets (${tickets.length})`}>
          {tickets.map((item, i) => (
            <li
              key={`${item.jiraKey ?? "ticket"}-${i}`}
              className="rounded-[0.85rem] border border-hairline bg-canvas/30 px-3 py-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[11px] text-indigo">
                  {item.jiraKey ?? "Unknown"}
                </span>
                {item.contentType ? (
                  <LabelPill label={item.contentType} tone="muted" />
                ) : null}
                <span className="font-mono text-[10px] text-ink-mute">
                  {formatScorePercent(item.similarity)} match
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-ink-dim">
                {item.content}
              </p>
            </li>
          ))}
        </Block>
      ) : null}

      {codebase.length > 0 ? (
        <Block title={`Codebase context (${codebase.length})`}>
          {codebase.map((item, i) => (
            <li
              key={`${item.filePath ?? "file"}-${i}`}
              className="rounded-[0.85rem] border border-hairline bg-canvas/30 px-3 py-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[11px] text-indigo">
                  {item.filePath ?? "Unknown file"}
                </span>
                <span className="font-mono text-[10px] text-ink-mute">
                  {formatScorePercent(item.similarity)} match
                </span>
              </div>
              <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-app-sm border border-hairline bg-surface/30 p-2 font-mono text-[11px] text-ink-dim">
                {item.content}
              </pre>
            </li>
          ))}
        </Block>
      ) : null}

      {reuse.length > 0 ? (
        <Block title="Org intelligence — reuse opportunities">
          {reuse.map((r, i) => (
            <li
              key={`${r.component}-${i}`}
              className="rounded-[0.85rem] border border-indigo/20 bg-indigo/5 px-3 py-3"
            >
              <p className="font-mono text-[11px] text-indigo">{r.component}</p>
              <p className="mt-2 text-[14px] text-ink">{r.description}</p>
              {r.source ? (
                <p className="mt-1 font-mono text-[10px] text-ink-mute">
                  Source: {r.source}
                </p>
              ) : null}
            </li>
          ))}
        </Block>
      ) : null}

      {patterns.length > 0 ? (
        <Block title="Technical patterns to apply">
          {patterns.map((p, i) => (
            <li
              key={`${p.pattern}-${i}`}
              className="rounded-[0.85rem] border border-hairline bg-canvas/30 px-3 py-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[14px] text-ink">{p.pattern}</p>
                <LabelPill label={p.relevance} tone="muted" />
              </div>
              <p className="mt-2 text-[13px] text-ink-dim">{p.context}</p>
            </li>
          ))}
        </Block>
      ) : null}
    </div>
  );
}

function Block({ title, children }) {
  return (
    <div>
      <p className="editorial-kicker mb-3 text-ink-mute">{title}</p>
      <ul className="space-y-2">{children}</ul>
    </div>
  );
}
