import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ensureAgentChatThread,
  sendAgentChatMessage,
} from "../../entities/agent-chat";
import ConnectIntegrationFirst from "../../app/components/ConnectIntegrationFirst";
import WeeklyTrendChart from "./WeeklyTrendChart";
import AgentHealthPanel from "./AgentHealthPanel";
import DashboardComposer from "./DashboardComposer";
import DashboardStream, { buildDashboardStream } from "./DashboardStream";

const CHIP_TONE = {
  running: "",
  review: "text-warning",
  success: "text-success",
  neutral: "",
};

export default function DashboardWorkspace({
  needsSetup,
  missing,
  statusMetrics,
  metricsLoading,
  reviewItems,
  completions,
  events,
  eventsLoading,
  pipelinesLoading,
  trendData,
  trendLoading,
  healthData,
  healthLoading,
}) {
  const [domain, setDomain] = useState("virin");
  const [thread, setThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState(null);

  const loadThread = useCallback(async (nextDomain) => {
    try {
      const t = await ensureAgentChatThread(nextDomain, "dashboard");
      setThread(t);
      setMessages(t.messages ?? []);
    } catch (err) {
      setChatError(err instanceof Error ? err.message : "Could not load chat");
    }
  }, []);

  useEffect(() => {
    void loadThread(domain);
  }, [domain, loadThread]);

  async function handleSend(content) {
    if (sending) return;
    setSending(true);
    setChatError(null);
    let active = thread;
    if (!active?.id) {
      try {
        active = await ensureAgentChatThread(domain, "dashboard");
        setThread(active);
      } catch (err) {
        setChatError(err instanceof Error ? err.message : "Could not start chat");
        setSending(false);
        return;
      }
    }
    const optimistic = {
      id: `pending-${Date.now()}`,
      role: "user",
      content,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    try {
      const result = await sendAgentChatMessage(active.id, content);
      setMessages((prev) => {
        const withoutPending = prev.filter((m) => m.id !== optimistic.id);
        return [
          ...withoutPending,
          result.userMessage ?? optimistic,
          result.assistantMessage,
        ];
      });
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setChatError(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSending(false);
    }
  }

  function handleDomainChange(next) {
    setDomain(next);
    setThread(null);
    setMessages([]);
  }

  const streamItems = useMemo(
    () =>
      buildDashboardStream({
        reviewItems,
        events: events ?? [],
        completions,
        messages,
      }),
    [reviewItems, events, completions, messages]
  );

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-6.5rem)] w-full max-w-[46rem] flex-col">
      {needsSetup ? (
        <div className="mb-4">
          <ConnectIntegrationFirst
            integrations={missing}
            title="Connect integrations to start this workspace"
            body="AgentOX runs from Jira tickets or a spreadsheet work board through your Git repository. Connect those in Settings, then Virin, Ananta, and pipelines will have something to work on."
          />
        </div>
      ) : null}

      <div className="flex flex-wrap justify-center gap-2">
        {metricsLoading && !statusMetrics?.length
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-8 w-24 animate-pulse rounded-full bg-app-surface-muted" />
            ))
          : (statusMetrics ?? []).map((metric) => (
              <Link
                key={metric.id}
                to={metric.href}
                className={`rounded-full border border-app-border bg-app-surface px-3 py-1.5 text-[12px] text-app-ink-dim transition hover:border-app-ink/15 hover:text-app-ink ${
                  CHIP_TONE[metric.tone] ?? ""
                }`}
              >
                <span className="font-medium text-app-ink">{metric.value}</span>{" "}
                {metric.label}
              </Link>
            ))}
      </div>

      <div className="mt-2 min-h-0 flex-1">
        <DashboardStream
          items={streamItems}
          domain={domain}
          loadingChat={sending}
          loadingOps={pipelinesLoading || eventsLoading}
        />
      </div>

      {chatError ? (
        <p className="mb-2 text-center text-[13px] text-danger">{chatError}</p>
      ) : null}

      <DashboardComposer
        domain={domain}
        onDomainChange={handleDomainChange}
        onSend={handleSend}
        busy={sending}
      />

      <details className="mt-2 mb-4 rounded-2xl border border-app-border bg-app-surface/60">
        <summary className="cursor-pointer px-4 py-3 text-[13px] font-medium text-app-ink-dim">
          Weekly trend and agent health
        </summary>
        <div className="space-y-4 border-t border-app-border px-3 py-4">
          <WeeklyTrendChart trend={trendData} loading={trendLoading} />
          <AgentHealthPanel agents={healthData?.agents} loading={healthLoading} />
        </div>
      </details>
    </div>
  );
}
