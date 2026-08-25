import { useState } from "react";
import { AgentChatAvatar } from "../agent-chat/AgentChatAvatar";
import { getAgentChatConfig } from "../agent-chat/agentChatConfig";
import ChatMarkdown from "./ChatMarkdown";

function ThinkingBlock({ lines, live, label }) {
  const [open, setOpen] = useState(live);
  const items = (lines ?? []).map((line) => String(line).trim()).filter(Boolean);
  if (!live && items.length === 0) return null;

  return (
    <div className="mb-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 text-[12px] text-app-ink-mute hover:text-app-ink"
        aria-expanded={open}
      >
        <span
          className={`inline-block text-[10px] transition ${open ? "rotate-90" : ""}`}
          aria-hidden
        >
          ▸
        </span>
        {live ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="size-1.5 animate-pulse rounded-full bg-indigo" />
            {label || "Thinking"}
          </span>
        ) : (
          <span>{label || "Thought process"}</span>
        )}
      </button>
      {open ? (
        <div className="mt-1.5 border-l border-app-border pl-3">
          {items.length > 0 ? (
            <div className="space-y-1">
              {items.map((line, i) => (
                <p key={`${line}-${i}`} className="text-[13px] leading-relaxed text-app-ink-mute">
                  {line}
                </p>
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-app-ink-mute">Working through the next step…</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

/** Claude-style assistant turn: collapsible thinking, then the response. */
export default function ClaudeTurn({
  domain,
  thinking = [],
  thinkingLive = false,
  thinkingLabel,
  content,
  children,
  toolCallLog = [],
  name,
}) {
  const config = getAgentChatConfig(domain);
  const displayName = name || config.displayName;

  return (
    <div className="flex items-start gap-3">
      <AgentChatAvatar domain={domain} size={28} className="mt-0.5" />
      <div className="min-w-0 max-w-[92%] flex-1">
        <p className="mb-1 text-[11px] text-app-ink-mute">{displayName}</p>
        <ThinkingBlock lines={thinking} live={thinkingLive} label={thinkingLabel} />
        {content ? <ChatMarkdown text={content} /> : null}
        {children}
        {toolCallLog.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {toolCallLog.map((t, i) => (
              <span
                key={`${t.tool}-${i}`}
                className="rounded-full border border-app-border bg-app-surface px-2 py-0.5 text-[10px] text-app-ink-mute"
                title={t.query}
              >
                {t.tool}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
