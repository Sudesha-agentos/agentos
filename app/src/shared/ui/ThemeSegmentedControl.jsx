import { useAppTheme } from "../hooks/useAppTheme";

const OPTIONS = [
  { id: "light", label: "Light", icon: IconSun },
  { id: "system", label: "System", icon: IconMonitor },
  { id: "dark", label: "Dark", icon: IconMoon },
];

export default function ThemeSegmentedControl({ size = "sm" }) {
  const { preference, setTheme } = useAppTheme();
  const compact = size === "sm";

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className={`inline-flex rounded-full bg-app-surface-muted p-0.5 ${compact ? "gap-0" : "gap-0.5"}`}
    >
      {OPTIONS.map((option) => {
        const active = preference === option.id;
        const Icon = option.icon;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={option.label}
            title={option.label}
            onClick={() => setTheme(option.id)}
            className={`flex items-center justify-center rounded-full transition ${
              compact ? "size-7" : "size-8"
            } ${
              active
                ? "bg-app-ink text-app-canvas shadow-sm"
                : "text-app-ink-mute hover:text-app-ink"
            }`}
          >
            <Icon size={compact ? 14 : 15} />
          </button>
        );
      })}
    </div>
  );
}

function IconSun({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M12 3.5v1.6M12 18.9v1.6M3.5 12h1.6M18.9 12h1.6M6.1 6.1l1.1 1.1M16.8 16.8l1.1 1.1M17.9 6.1l-1.1 1.1M7.2 16.8l-1.1 1.1"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconMonitor({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="5" width="16" height="11" rx="1.6" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 20h8M12 16v4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function IconMoon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M16.4 13.6A6.6 6.6 0 0 1 10.2 5.5 6.8 6.8 0 1 0 18.5 14a6.5 6.5 0 0 1-2.1-.4Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}
