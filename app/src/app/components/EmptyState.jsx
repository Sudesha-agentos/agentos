export default function EmptyState({ kicker = "Empty", title, body, action }) {
  return (
    <div className="rounded-2xl border border-app-border bg-app-surface px-6 py-8 text-center">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-app-ink-mute">
        {kicker}
      </p>
      <h3 className="mt-2 text-base font-medium text-app-ink">{title}</h3>
      {body ? (
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-app-ink-dim">{body}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
