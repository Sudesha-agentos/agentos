import LabelPill from "../../app/components/LabelPill";

export default function DiscoveryQuestionsSection({ questions = [] }) {
  if (!questions.length) return null;

  return (
    <div className="space-y-3">
      <p className="editorial-kicker text-ink-mute">
        Discovery questions ({questions.length})
      </p>
      <ul className="space-y-2">
        {questions.map((q, i) => (
          <li
            key={`${q.question}-${i}`}
            className="rounded-[0.85rem] border border-warning/30 bg-warning/5 px-3 py-3"
          >
            <div className="flex flex-wrap items-center gap-2">
              <LabelPill label={q.impact} tone={q.impact === "blocking" ? "danger" : "warning"} />
            </div>
            <p className="mt-2 text-[14px] font-medium text-ink">{q.question}</p>
            {q.description ? (
              <p className="mt-2 text-[13px] text-ink-dim">{q.description}</p>
            ) : null}
          </li>
        ))}
      </ul>
      <p className="text-[12px] text-ink-mute">
        Answer these in the override workspace, then resume the pipeline.
      </p>
    </div>
  );
}
