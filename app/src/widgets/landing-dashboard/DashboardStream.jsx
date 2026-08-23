import { Link } from "react-router-dom";
import { useOrgPathBuilder } from "../../shared/providers/OrgRouteProvider";
import { formatRelativeTime } from "../../shared/lib/format";
import { AgentChatAvatar } from "../agent-chat/AgentChatAvatar";
import { getAgentChatConfig } from "../agent-chat/agentChatConfig";
import DiscoveryQuestionCard from "../pm-analysis/DiscoveryQuestionCard";

export function buildDashboardStream({
  reviewItems = [],
  events = [],
  completions = [],
  messages = [],
}) {
  const ops = [];

  for (const item of reviewItems) {
    ops.push({
      kind: "review",
      id: `review-${item.id}`,
      at: Date.now() - item.waitingMinutes * 60_000,
      item,
    });
  }
  for (const event of events) {
    ops.push({
      kind: "activity",
      id: `act-${event.id}-${event.timestamp ?? ""}`,
      at: event.timestamp ? new Date(event.timestamp).getTime() : 0,
      event,
    });
  }
  for (const item of completions) {
    ops.push({
      kind: "completion",
      id: `done-${item.id}`,
      at: item.completedAt ? new Date(item.completedAt).getTime() : 0,
      item,
    });
  }
  ops.sort((a, b) => a.at - b.at);

  const chat = messages.map((message) => ({
    kind: "chat",
    id: message.id,
    at: message.createdAt ? new Date(message.createdAt).getTime() : 0,
    message,
  }));

  return [...ops, ...chat];
}

export default function DashboardStream({
  items,
  domain,
  loadingChat,
  loadingOps,
  onAnswerQuestion,
  answering = false,
}) {
  const orgPath = useOrgPathBuilder();
  const config = getAgentChatConfig(domain);

  if (loadingOps && items.length === 0) {
    return (
      <div className="space-y-3 py-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-2xl bg-app-surface-muted" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
        <h2 className="text-[1.65rem] font-medium tracking-tight text-app-ink sm:text-[1.85rem]">
          What should we work on?
        </h2>
        <p className="mt-3 max-w-md text-[15px] leading-relaxed text-app-ink-dim">
          Ask {config.displayName} about a ticket, or open something that needs review. Pipelines,
          activity, and completions will show up here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 py-4">
      {items.map((row) => {
        if (row.kind === "review") {
          const item = row.item;
          return (
            <article
              key={row.id}
              className="rounded-2xl border border-app-border bg-app-surface px-4 py-3.5"
            >
              <p className="text-[11px] font-medium uppercase tracking-wide text-warning">
                Needs review
              </p>
              <p className="mt-1 font-mono text-xs text-app-ink-mute">{item.jiraKey}</p>
              <p className="mt-1 text-[15px] font-medium text-app-ink">{item.summary}</p>
              <p className="mt-1 text-sm text-app-ink-dim">{item.reason}</p>
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-xs text-app-ink-mute">
                  Waiting {item.waitingMinutes} minute
                  {item.waitingMinutes === 1 ? "" : "s"}
                </p>
                <Link
                  to={item.actionTo}
                  className="rounded-full bg-app-ink px-3.5 py-1.5 text-[13px] font-medium text-app-canvas"
                >
                  {item.actionLabel}
                </Link>
              </div>
            </article>
          );
        }

        if (row.kind === "activity") {
          const event = row.event;
          return (
            <Link
              key={row.id}
              to={
                event.pipelineId
                  ? orgPath("pipelines", event.pipelineId)
                  : orgPath("pipelines")
              }
              className="block px-1"
            >
              <p className="text-[11px] text-app-ink-mute">
                {event.live ? "Live" : formatRelativeTime(event.timestamp)}
              </p>
              <p className="mt-1 text-[15px] leading-relaxed text-app-ink">
                <span className="font-mono text-app-ink-dim">{event.jiraKey}</span> {event.message}
              </p>
            </Link>
          );
        }

        if (row.kind === "completion") {
          const item = row.item;
          return (
            <Link
              key={row.id}
              to={orgPath("pipelines", item.id)}
              className="flex items-start justify-between gap-3 px-1"
            >
              <div className="min-w-0">
                <p className="text-[11px] text-app-ink-mute">
                  Completed {item.completedAt ? formatRelativeTime(item.completedAt) : ""}
                </p>
                <p className="mt-1 text-[15px] text-app-ink">
                  <span className="font-mono text-app-ink-dim">{item.jiraKey}</span> {item.summary}
                </p>
              </div>
              {item.qaPassed ? (
                <span className="shrink-0 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-success">
                  QA pass
                </span>
              ) : null}
            </Link>
          );
        }

        const msg = row.message;
        if (msg.role === "user") {
          return (
            <div key={row.id} className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl bg-app-surface-muted px-4 py-2.5 text-[15px] leading-relaxed text-app-ink">
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          );
        }

        if (msg.metadata?.kind === "discovery_plan") {
          return (
            <div key={row.id} className="flex items-start gap-3">
              <AgentChatAvatar domain={domain} size={28} className="mt-0.5" />
              <div className="min-w-0 max-w-[92%] rounded-2xl border border-app-border bg-app-surface px-4 py-3">
                <p className="text-[14px] text-app-ink">{msg.content}</p>
                <ol className="mt-2 space-y-1">
                  {(msg.metadata.questions ?? []).map((item, index) => (
                    <li key={`${item}-${index}`} className="text-[13px] text-app-ink-dim">
                      {index + 1}. {item}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          );
        }

        if (msg.metadata?.kind === "discovery_question") {
          return (
            <div key={row.id} className="flex items-start gap-3">
              <AgentChatAvatar domain={domain} size={28} className="mt-0.5" />
              <DiscoveryQuestionCard
                prompt={msg.content}
                options={msg.metadata.options}
                turnNumber={msg.metadata.turnNumber}
                maxTurns={msg.metadata.maxTurns}
                pending={Boolean(msg.metadata.pending && onAnswerQuestion)}
                busy={answering}
                onAnswer={onAnswerQuestion}
              />
            </div>
          );
        }

        return (
          <div key={row.id} className="flex items-start gap-3">
            <AgentChatAvatar domain={domain} size={28} className="mt-0.5" />
            <div className="min-w-0 max-w-[92%]">
              <p className="mb-1 text-[11px] text-app-ink-mute">{config.displayName}</p>
              <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-app-ink">
                {msg.content}
              </p>
            </div>
          </div>
        );
      })}
      {loadingChat ? (
        <p className="text-[13px] text-app-ink-mute">{config.displayName} is thinking…</p>
      ) : null}
    </div>
  );
}
