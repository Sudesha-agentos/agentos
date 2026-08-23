import { useWorkspaceMode } from "../hooks/useWorkspaceMode";

const OPTIONS = [
  { id: "work", label: "Work" },
  { id: "preview", label: "Preview" },
];

export default function WorkspaceModeSwitch() {
  const { mode, setMode } = useWorkspaceMode();

  return (
    <div
      role="radiogroup"
      aria-label="Workspace mode"
      className="inline-flex rounded-full bg-app-surface-muted p-0.5"
    >
      {OPTIONS.map((option) => {
        const active = mode === option.id;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setMode(option.id)}
            className={`rounded-full px-3.5 py-1 text-[12px] font-medium transition ${
              active
                ? "bg-app-ink text-app-canvas shadow-sm"
                : "text-app-ink-mute hover:text-app-ink"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
