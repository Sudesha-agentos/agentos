import { useEffect, useMemo, useState } from "react";
import { listJiraSyncIssues } from "../../entities/jira-sync";
import { getWorkBoard } from "../../entities/work-board";
import { codebaseAdapter } from "../../entities/codebase";

function normalizeTickets(jiraItems, boardItems) {
  const tickets = [];
  for (const item of jiraItems ?? []) {
    tickets.push({
      kind: "ticket",
      id: item.jiraKey || item.key || item.id,
      label: item.jiraKey || item.key,
      detail: item.summary || "",
    });
  }
  for (const item of boardItems ?? []) {
    const key = item.key || item.id;
    if (tickets.some((row) => row.id === key)) continue;
    tickets.push({
      kind: "ticket",
      id: key,
      label: key,
      detail: item.summary || item.title || "",
    });
  }
  return tickets;
}

function normalizeFiles(search) {
  const rows = search?.files ?? search?.results ?? search?.items ?? [];
  return rows
    .map((row) => {
      const path = row.path || row.filePath || row.file || row.name;
      if (!path) return null;
      return {
        kind: "file",
        id: path,
        label: path.split("/").pop(),
        detail: path,
      };
    })
    .filter(Boolean);
}

export default function MentionPicker({ query, onPick, onClose }) {
  const [tab, setTab] = useState("ticket");
  const [tickets, setTickets] = useState([]);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const q = query.trim();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        if (tab === "ticket") {
          const [jira, board] = await Promise.allSettled([
            listJiraSyncIssues({ q: q || undefined, limit: 12 }),
            getWorkBoard(),
          ]);
          const jiraItems = jira.status === "fulfilled" ? jira.value?.items ?? [] : [];
          const boardItems =
            board.status === "fulfilled"
              ? board.value?.items ?? board.value?.columns?.flatMap((col) => col.items ?? []) ?? []
              : [];
          if (!cancelled) setTickets(normalizeTickets(jiraItems, boardItems));
        } else if (q.length >= 2) {
          const result = await codebaseAdapter.search(q, "main");
          if (!cancelled) setFiles(normalizeFiles(result));
        } else {
          if (!cancelled) setFiles([]);
        }
      } catch {
        if (!cancelled) {
          if (tab === "ticket") setTickets([]);
          else setFiles([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, q]);

  const filteredTickets = useMemo(() => {
    if (!q) return tickets.slice(0, 8);
    const needle = q.toLowerCase();
    return tickets
      .filter(
        (item) =>
          item.label.toLowerCase().includes(needle) || item.detail.toLowerCase().includes(needle)
      )
      .slice(0, 8);
  }, [tickets, q]);

  const items = tab === "ticket" ? filteredTickets : files.slice(0, 8);

  return (
    <div className="absolute bottom-full left-0 z-20 mb-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-app-border bg-app-surface shadow-app-float">
      <div className="flex items-center gap-1 border-b border-app-border px-2 py-1.5">
        {[
          { id: "ticket", label: "Tickets" },
          { id: "file", label: "GitHub files" },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`rounded-md px-2 py-1 text-[12px] font-medium ${
              tab === item.id ? "bg-app-surface-muted text-app-ink" : "text-app-ink-dim"
            }`}
          >
            {item.label}
          </button>
        ))}
        <button
          type="button"
          onClick={onClose}
          className="ml-auto px-2 text-[12px] text-app-ink-mute hover:text-app-ink"
        >
          Esc
        </button>
      </div>
      <ul className="max-h-56 overflow-y-auto py-1">
        {loading && items.length === 0 ? (
          <li className="px-3 py-2 text-[12px] text-app-ink-mute">Searching…</li>
        ) : items.length === 0 ? (
          <li className="px-3 py-2 text-[12px] text-app-ink-mute">
            {tab === "file" && q.length < 2
              ? "Type two or more characters to search the repository."
              : "No matches."}
          </li>
        ) : (
          items.map((item) => (
            <li key={`${item.kind}:${item.id}`}>
              <button
                type="button"
                onClick={() => onPick(item)}
                className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-app-surface-muted"
              >
                <span className="font-mono text-[12px] text-app-ink">{item.label}</span>
                {item.detail && item.detail !== item.label ? (
                  <span className="mt-0.5 truncate text-[11px] text-app-ink-dim">{item.detail}</span>
                ) : null}
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

export function formatMentionContext(tags) {
  if (!tags?.length) return "";
  const lines = tags.map((tag) =>
    tag.kind === "file"
      ? `- GitHub file: ${tag.detail || tag.id}`
      : `- Ticket ${tag.label}${tag.detail ? `: ${tag.detail}` : ""}`
  );
  return `Context:\n${lines.join("\n")}\n\n`;
}
