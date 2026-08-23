import { useEffect, useRef, useState } from "react";
import { AGENT_NAMES } from "../../shared/config/app";
import { FOCUS_DASHBOARD_COMPOSER } from "../../shared/lib/chromeEvents";
import { getAgentChatConfig } from "../agent-chat/agentChatConfig";

const AGENTS = [
  { id: "virin", label: AGENT_NAMES.VIRIN },
  { id: "ananta", label: AGENT_NAMES.ANANTA },
  { id: "neel", label: AGENT_NAMES.NEEL },
];

export default function DashboardComposer({
  domain,
  onDomainChange,
  onSend,
  busy,
  disabled,
}) {
  const [text, setText] = useState("");
  const inputRef = useRef(null);
  const config = getAgentChatConfig(domain);

  useEffect(() => {
    function onFocus() {
      inputRef.current?.focus();
    }
    window.addEventListener(FOCUS_DASHBOARD_COMPOSER, onFocus);
    return () => window.removeEventListener(FOCUS_DASHBOARD_COMPOSER, onFocus);
  }, []);

  function submit() {
    const trimmed = text.trim();
    if (!trimmed || busy || disabled) return;
    onSend(trimmed);
    setText("");
  }

  return (
    <div className="sticky bottom-0 z-10 bg-gradient-to-t from-app-canvas via-app-canvas to-transparent pb-2 pt-6">
      <form
        className="rounded-[1.35rem] border border-app-border bg-app-surface px-3 py-2.5 shadow-app-float"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <textarea
          ref={inputRef}
          rows={1}
          value={text}
          disabled={busy || disabled}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={config.placeholder || "Write a message…"}
          className="max-h-36 min-h-[2.25rem] w-full resize-none bg-transparent px-1 py-1.5 text-[15px] text-app-ink placeholder:text-app-ink-mute focus:outline-none disabled:opacity-50"
        />
        <div className="mt-1 flex items-center gap-1.5">
          <span
            className="flex size-8 items-center justify-center rounded-lg text-app-ink-mute"
            title="Attachments coming soon"
          >
            <IconPlus />
          </span>
          <label className="relative ml-auto">
            <span className="sr-only">Choose agent</span>
            <select
              value={domain}
              onChange={(e) => onDomainChange(e.target.value)}
              disabled={busy}
              className="appearance-none rounded-lg bg-transparent py-1.5 pl-2 pr-6 text-[13px] font-medium text-app-ink-dim focus:outline-none disabled:opacity-50"
            >
              {AGENTS.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            disabled={busy || disabled || !text.trim()}
            className="flex size-8 items-center justify-center rounded-lg bg-app-ink text-app-canvas transition disabled:opacity-30"
            aria-label="Send"
          >
            <IconSend />
          </button>
        </div>
      </form>
      <p className="mt-2 text-center text-[11px] text-app-ink-mute">
        AgentOX can make mistakes. Review PRDs, diffs, and QA before you ship.
      </p>
    </div>
  );
}

function IconPlus() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M8 3.5v9M3.5 8h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconSend() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M8 12.5V3.5M4.5 7 8 3.5 11.5 7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
