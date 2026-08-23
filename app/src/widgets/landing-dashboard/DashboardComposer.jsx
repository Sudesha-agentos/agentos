import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AGENT_NAMES } from "../../shared/config/app";
import { FOCUS_DASHBOARD_COMPOSER } from "../../shared/lib/chromeEvents";
import { useOrgPathBuilder } from "../../shared/providers/OrgRouteProvider";
import { getAgentChatConfig } from "../agent-chat/agentChatConfig";
import MentionPicker, { formatMentionContext } from "./MentionPicker";

const AGENTS = [
  { id: "virin", label: AGENT_NAMES.VIRIN, hint: "Product" },
  { id: "ananta", label: AGENT_NAMES.ANANTA, hint: "Engineering" },
  { id: "neel", label: AGENT_NAMES.NEEL, hint: "QA" },
];

const PLACEHOLDER = "Describe a feature, or tag a ticket / GitHub file…";

export default function DashboardComposer({
  domain,
  onDomainChange,
  onSend,
  busy,
  disabled,
  compact = false,
  initialText = "",
}) {
  const [text, setText] = useState(initialText);
  const [tags, setTags] = useState([]);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const inputRef = useRef(null);
  const orgPath = useOrgPathBuilder();
  const config = getAgentChatConfig(domain);
  const agent = AGENTS.find((a) => a.id === domain) ?? AGENTS[0];

  useEffect(() => {
    if (initialText) setText(initialText);
  }, [initialText]);

  useEffect(() => {
    function onFocus() {
      inputRef.current?.focus();
    }
    window.addEventListener(FOCUS_DASHBOARD_COMPOSER, onFocus);
    return () => window.removeEventListener(FOCUS_DASHBOARD_COMPOSER, onFocus);
  }, []);

  function addTag(item) {
    setTags((prev) => (prev.some((tag) => tag.id === item.id && tag.kind === item.kind) ? prev : [...prev, item]));
    setMentionOpen(false);
    setMentionQuery("");
    setText((prev) => prev.replace(/(^|\s)@[^\s]*$/, "$1").trimStart());
    inputRef.current?.focus();
  }

  function removeTag(item) {
    setTags((prev) => prev.filter((tag) => !(tag.id === item.id && tag.kind === item.kind)));
  }

  function submit() {
    const trimmed = text.trim();
    if ((!trimmed && tags.length === 0) || busy || disabled) return;
    const content = `${formatMentionContext(tags)}${trimmed}`.trim();
    onSend(content, { tags });
    setText("");
    setTags([]);
    setMentionOpen(false);
  }

  return (
    <form
      className={`relative border border-app-border bg-app-surface shadow-app-float ${
        compact ? "rounded-2xl px-3 py-2.5" : "rounded-[1.75rem] px-4 pb-3 pt-4"
      }`}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="absolute -top-3 right-4">
        <label className="inline-flex items-center gap-1.5 rounded-full border border-app-border bg-app-canvas px-2.5 py-1 text-[12px] font-medium text-app-ink shadow-app-card">
          <span className="size-1.5 rounded-full bg-warning" />
          Ask {agent.label}
          <select
            value={domain}
            onChange={(e) => onDomainChange(e.target.value)}
            disabled={busy}
            className="absolute inset-0 cursor-pointer opacity-0"
            aria-label="Choose agent"
          >
            {AGENTS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label} ({item.hint})
              </option>
            ))}
          </select>
          <IconChevron />
        </label>
      </div>

      {tags.length > 0 ? (
        <div className="mb-1 flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <button
              key={`${tag.kind}:${tag.id}`}
              type="button"
              onClick={() => removeTag(tag)}
              className="inline-flex items-center gap-1.5 rounded-full border border-app-border bg-app-canvas px-2.5 py-1 text-[12px] text-app-ink"
              title="Remove tag"
            >
              <span className="font-mono">{tag.label}</span>
              <span className="text-app-ink-mute">×</span>
            </button>
          ))}
        </div>
      ) : null}

      <textarea
        ref={inputRef}
        rows={compact ? 2 : 3}
        value={text}
        disabled={busy || disabled}
        onChange={(e) => {
          const next = e.target.value;
          setText(next);
          const at = next.match(/(?:^|\s)@([^\s]*)$/);
          if (at) {
            setMentionOpen(true);
            setMentionQuery(at[1] ?? "");
          } else if (mentionOpen && !next.includes("@")) {
            setMentionOpen(false);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape" && mentionOpen) {
            e.preventDefault();
            setMentionOpen(false);
            return;
          }
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder={PLACEHOLDER}
        className="w-full resize-none bg-transparent px-1 py-2 text-[16px] leading-relaxed text-app-ink placeholder:text-app-ink-mute focus:outline-none disabled:opacity-50"
      />

      <div className="relative mt-1 flex items-center gap-1.5">
        {mentionOpen ? (
          <MentionPicker
            query={mentionQuery}
            onPick={addTag}
            onClose={() => setMentionOpen(false)}
          />
        ) : null}
        <button
          type="button"
          onClick={() => {
            setMentionOpen((open) => !open);
            setMentionQuery("");
          }}
          className="flex size-8 items-center justify-center rounded-lg text-app-ink-mute hover:bg-app-surface-muted hover:text-app-ink"
          title="Tag a ticket or GitHub file"
        >
          <IconPlus />
        </button>
        <Link
          to={orgPath("board")}
          className="inline-flex items-center gap-1.5 rounded-full border border-app-border px-2.5 py-1 text-[12px] font-medium text-app-ink-dim hover:text-app-ink"
        >
          <IconBoard />
          Board
        </Link>
        <Link
          to={orgPath("integrations")}
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium text-app-ink-dim hover:bg-app-surface-muted hover:text-app-ink"
        >
          <IconGit />
          Integrations
        </Link>
        <Link
          to={orgPath("codebase")}
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium text-app-ink-dim hover:bg-app-surface-muted hover:text-app-ink"
        >
          <IconSpark />
          Codebase
        </Link>
        <button
          type="submit"
          disabled={busy || disabled || (!text.trim() && tags.length === 0)}
          className="ml-auto flex size-9 items-center justify-center rounded-full bg-app-ink text-app-canvas transition disabled:opacity-25"
          aria-label={busy ? "Sending" : "Send"}
        >
          <IconSend />
        </button>
      </div>
      <span className="sr-only">{config.placeholder}</span>
    </form>
  );
}

function IconChevron() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path d="M3 4.5 6 7.5 9 4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function IconPlus() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M8 3.5v9M3.5 8h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconBoard() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden>
      <rect x="1.5" y="2.5" width="3.2" height="9" rx="0.8" stroke="currentColor" />
      <rect x="5.4" y="2.5" width="3.2" height="6.5" rx="0.8" stroke="currentColor" />
      <rect x="9.3" y="2.5" width="3.2" height="8" rx="0.8" stroke="currentColor" />
    </svg>
  );
}

function IconGit() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M8 14.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13Z"
        stroke="currentColor"
      />
      <path d="M6 8h4M8 6v4" stroke="currentColor" strokeLinecap="round" />
    </svg>
  );
}

function IconSpark() {
  return (
    <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M7 1.5 8 5.5 12 6.5 8 7.5 7 11.5 6 7.5 2 6.5 6 5.5 7 1.5Z" stroke="currentColor" />
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
