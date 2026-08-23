export function Card({ children, className = "" }) {
  return (
    <div className={`app-card ${className}`}>
      {children}
    </div>
  );
}

export function CardHeader({ title, kicker, right }) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 py-4 sm:px-6">
      <div>
        {kicker ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-app-ink-mute">
            {kicker}
          </p>
        ) : null}
        <h3 className="mt-1 text-base font-semibold tracking-tight text-app-ink">{title}</h3>
      </div>
      {right}
    </div>
  );
}
