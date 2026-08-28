import { useEffect, useRef, useState } from "react";
import { DEFAULT_SETTINGS, useSettings } from "../../entities/settings";
import { useSaveSettings } from "../../features/save-settings/model/useSaveSettings";
import {
  AGENT_MODEL_IDS,
  AGENT_MODELS,
  getAgentModelForRole,
  getAgentModelRoleForDomain,
  getProviderModels,
  resolveProviderModelName,
} from "../../shared/config/agentModels";

export default function ChatModelPicker({ domain, disabled = false, compact = false }) {
  const { data: settings, refetch } = useSettings();
  const { save, pending } = useSaveSettings();
  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState(null);
  const rootRef = useRef(null);
  const role = getAgentModelRoleForDomain(domain);
  const current = local ?? settings ?? DEFAULT_SETTINGS;
  const selected = getAgentModelForRole(current, role.id);

  useEffect(() => {
    if (settings && !local) setLocal(settings);
  }, [settings, local]);

  useEffect(() => {
    function onPointer(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, []);

  async function selectModel(providerId, modelName) {
    const next = {
      ...(local ?? settings ?? DEFAULT_SETTINGS),
      [role.settingKey]: providerId,
      [role.modelNameKey]: resolveProviderModelName(providerId, modelName),
    };
    setLocal(next);
    setOpen(false);
    try {
      await save(next);
      refetch?.();
    } catch {
      setLocal(local ?? settings ?? DEFAULT_SETTINGS);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled || pending}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[12px] font-medium text-app-ink-dim hover:bg-app-surface-muted hover:text-app-ink disabled:opacity-40"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Model for ${role.agent}`}
        title={`${role.agent} · ${selected.label}`}
      >
        {selected.modelLabel}
        <span aria-hidden className="text-[10px]">
          ▾
        </span>
      </button>
      {open ? (
        <div
          role="listbox"
          aria-label={`${role.label} models`}
          className={`absolute z-30 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-app-border bg-app-surface py-2 shadow-app-float ${
            compact ? "bottom-[calc(100%+0.5rem)] right-0" : "top-[calc(100%+0.5rem)] right-0"
          }`}
        >
          <p className="px-3 pb-1.5 text-[11px] font-medium uppercase tracking-wide text-app-ink-mute">
            {role.agent} · {role.label}
          </p>
          {AGENT_MODEL_IDS.map((providerId) => {
            const provider = AGENT_MODELS[providerId];
            return (
              <div key={providerId} className="px-2 py-1.5">
                <p className="px-1.5 text-[11px] text-app-ink-mute">{provider.label}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {getProviderModels(providerId).map((option) => {
                    const active = selected.modelId === option.id && selected.id === providerId;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        role="option"
                        aria-selected={active}
                        title={option.blurb}
                        onClick={() => selectModel(providerId, option.id)}
                        className={`rounded-lg px-2 py-1 text-[12px] font-medium ${
                          active
                            ? "bg-app-ink text-app-canvas"
                            : "text-app-ink-dim hover:bg-app-surface-muted hover:text-app-ink"
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
