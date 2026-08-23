import { useState } from "react";
import { VIRIN_NAME } from "../../entities/pm-agents";

const OTHER = "__other__";

export default function DiscoveryQuestionCard({
  prompt,
  options = [],
  plannedQuestions = [],
  turnNumber,
  maxTurns,
  onAnswer,
  busy = false,
  pending = true,
}) {
  const [selected, setSelected] = useState(null);
  const [other, setOther] = useState("");
  const presets = (options ?? []).filter(Boolean).slice(0, 4);
  const answer =
    selected === OTHER ? other.trim() : selected != null ? presets[selected] ?? "" : "";
  const canSubmit = pending && Boolean(answer) && !busy;

  return (
    <div className="w-full max-w-[36rem] rounded-2xl border border-app-border bg-app-surface px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-app-ink-mute">
          {VIRIN_NAME} asks
        </p>
        {turnNumber && maxTurns ? (
          <p className="font-mono text-[11px] text-app-ink-mute">
            {turnNumber}/{maxTurns}
          </p>
        ) : null}
      </div>
      <p className="mt-2 text-[15px] leading-relaxed text-app-ink">{prompt}</p>

      {plannedQuestions.length > 0 ? (
        <ol className="mt-3 space-y-1.5 rounded-xl bg-app-surface-muted/70 px-3 py-2.5">
          {plannedQuestions.map((item, index) => (
            <li key={`${item}-${index}`} className="flex gap-2 text-[12px] text-app-ink-dim">
              <span className="font-mono text-app-ink-mute">{index + 1}.</span>
              <span>{item}</span>
            </li>
          ))}
        </ol>
      ) : null}

      {pending ? (
        <form
          className="mt-4 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!canSubmit) return;
            onAnswer(answer);
            setSelected(null);
            setOther("");
          }}
        >
          {presets.length > 0 ? (
            <>
              {presets.map((opt, idx) => (
                <label
                  key={opt}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-2.5 text-[13px] leading-snug transition ${
                    selected === idx
                      ? "border-app-ink/20 bg-app-surface-muted"
                      : "border-app-border hover:bg-app-surface-muted/50"
                  }`}
                >
                  <input
                    type="radio"
                    className="mt-0.5 accent-current"
                    checked={selected === idx}
                    onChange={() => setSelected(idx)}
                  />
                  <span>{opt}</span>
                </label>
              ))}
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-2.5 text-[13px] ${
                  selected === OTHER
                    ? "border-app-ink/20 bg-app-surface-muted"
                    : "border-app-border hover:bg-app-surface-muted/50"
                }`}
              >
                <input
                  type="radio"
                  className="mt-0.5 accent-current"
                  checked={selected === OTHER}
                  onChange={() => setSelected(OTHER)}
                />
                <span>Other</span>
              </label>
              {selected === OTHER ? (
                <textarea
                  value={other}
                  onChange={(e) => setOther(e.target.value)}
                  rows={2}
                  autoFocus
                  placeholder="Type your answer…"
                  className="w-full resize-none rounded-xl border border-app-border bg-app-canvas px-3 py-2 text-[13px] text-app-ink outline-none"
                />
              ) : null}
            </>
          ) : (
            <textarea
              value={other}
              onChange={(e) => {
                setOther(e.target.value);
                setSelected(OTHER);
              }}
              rows={3}
              autoFocus
              placeholder="Type your answer…"
              className="w-full resize-none rounded-xl border border-app-border bg-app-canvas px-3 py-2 text-[13px] text-app-ink outline-none"
            />
          )}
          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={!canSubmit}
              className="rounded-full bg-app-ink px-4 py-1.5 text-[13px] font-medium text-app-canvas disabled:opacity-40"
            >
              {busy ? "Sending…" : "Send answer"}
            </button>
          </div>
        </form>
      ) : (
        <p className="mt-2 text-[12px] text-app-ink-mute">Answered</p>
      )}
    </div>
  );
}
