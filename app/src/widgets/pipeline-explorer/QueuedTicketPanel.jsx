import { VIRIN_NAME } from "../../entities/pm-agents";
import Spinner from "../../app/components/Spinner";

export default function QueuedTicketPanel({ jiraKey, onClose }) {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="shrink-0 border-b border-app-border bg-app-surface/80 px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-indigo">
              {jiraKey}
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-app-ink">
              Queued for {VIRIN_NAME}
            </h2>
          </div>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="flex size-8 items-center justify-center rounded-full border border-app-border text-app-ink-mute hover:text-app-ink"
              aria-label="Close panel"
            >
              ×
            </button>
          ) : null}
        </div>
      </header>
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
        <Spinner label="Waiting in queue" />
        <p className="max-w-sm text-[14px] text-app-ink-dim">
          This ticket is queued. {VIRIN_NAME} will start the 9-stage product analysis when the
          current run finishes.
        </p>
      </div>
    </div>
  );
}
