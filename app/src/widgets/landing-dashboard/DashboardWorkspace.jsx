import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ensureAgentChatThread,
  sendAgentChatMessage,
} from "../../entities/agent-chat";
import {
  createChatRecord,
  findStoredChatByContextKey,
  getStoredChat,
  touchChat,
} from "../../entities/chats";
import { useAuth } from "../../shared/providers/useAuth";
import { useOrgPathBuilder } from "../../shared/providers/OrgRouteProvider";
import { FOCUS_DASHBOARD_COMPOSER, OPEN_CREATE_NEW } from "../../shared/lib/chromeEvents";
import ConnectIntegrationFirst from "../../app/components/ConnectIntegrationFirst";
import WeeklyTrendChart from "./WeeklyTrendChart";
import AgentHealthPanel from "./AgentHealthPanel";
import DashboardComposer from "./DashboardComposer";
import DashboardStream, { buildDashboardStream } from "./DashboardStream";
import CreateNewPanel from "./CreateNewPanel";
import { answerVirinQuestion, usePmAnalyses, usePmAnalysis } from "../../entities/pm-agents";
import {
  extractJiraKey,
  mergeVirinDiscoveryMessages,
} from "../pm-analysis/virinChatTranscript";

function dayGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

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
  const { user } = useAuth();
  const orgPath = useOrgPathBuilder();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const chatId = searchParams.get("chat");
  const [domain, setDomain] = useState("virin");
  const [thread, setThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState(null);
  const [createOpen, setCreateOpen] = useState(searchParams.get("new") === "1");
  const [starter, setStarter] = useState("");
  const skipReloadRef = useRef(false);
  const [ticketKey, setTicketKey] = useState("");
  const { data: analysesList } = usePmAnalyses({ pollMs: 5000 });
  const awaitingVirin = useMemo(() => {
    const items = analysesList?.items ?? [];
    return (
      items
        .filter((item) => item.status === "AWAITING_INPUT")
        .sort((a, b) => String(b.startedAt ?? "").localeCompare(String(a.startedAt ?? "")))[0] ??
      null
    );
  }, [analysesList]);
  const { data: virinAnalysis } = usePmAnalysis(ticketKey, {
    pollMs: ticketKey && domain === "virin" ? 800 : 0,
    skip: !ticketKey || domain !== "virin",
  });

  const firstName =
    user?.name?.trim()?.split(/\s+/)[0] || user?.email?.split("@")[0] || "there";

  const loadSession = useCallback(async (id) => {
    const stored = getStoredChat(id);
    const nextDomain = stored?.domain || "virin";
    const contextKey = stored?.contextKey || `chat:${id}`;
    setDomain(nextDomain);
    const fromContext = extractJiraKey(contextKey) || extractJiraKey(stored?.title);
    if (fromContext) setTicketKey(fromContext);
    try {
      const t = await ensureAgentChatThread(nextDomain, contextKey, stored?.title);
      setThread(t);
      setMessages(t.messages ?? []);
      setStarter(t.messages?.length ? "" : stored?.starter || "");
      touchChat(id, { threadId: t.id, domain: nextDomain, title: t.title || stored?.title });
    } catch (err) {
      setChatError(err instanceof Error ? err.message : "Could not load chat");
    }
  }, []);

  useEffect(() => {
    const key = awaitingVirin?.jiraKey?.trim().toUpperCase();
    if (!key) return;
    const existing = findStoredChatByContextKey(key);
    const chat =
      existing ??
      createChatRecord({
        domain: "virin",
        title: key,
        contextKey: key,
      });
    if (chatId) return;
    setDomain("virin");
    setTicketKey(key);
    skipReloadRef.current = false;
    navigate(`${orgPath()}?chat=${encodeURIComponent(chat.id)}`, { replace: true });
  }, [awaitingVirin, chatId, navigate, orgPath]);

  useEffect(() => {
    if (!chatId) {
      setThread(null);
      setMessages([]);
      setStarter("");
      return;
    }
    if (skipReloadRef.current) {
      skipReloadRef.current = false;
      return;
    }
    void loadSession(chatId);
  }, [chatId, loadSession]);

  useEffect(() => {
    function onCreate() {
      setCreateOpen(true);
    }
    window.addEventListener(OPEN_CREATE_NEW, onCreate);
    return () => window.removeEventListener(OPEN_CREATE_NEW, onCreate);
  }, []);

  async function ensureSession(nextDomain = domain) {
    if (chatId) {
      const stored = getStoredChat(chatId);
      const contextKey = stored?.contextKey || `chat:${chatId}`;
      const active = thread?.id
        ? thread
        : await ensureAgentChatThread(nextDomain, contextKey, stored?.title);
      setThread(active);
      return { id: chatId, thread: active, stored };
    }
    const reuseKey = nextDomain === "virin" ? ticketKey : "";
    const existing = reuseKey ? findStoredChatByContextKey(reuseKey) : null;
    const created =
      existing ??
      createChatRecord({
        domain: nextDomain,
        title: reuseKey || "New chat",
        contextKey: reuseKey || undefined,
      });
    const active = await ensureAgentChatThread(nextDomain, created.contextKey, created.title);
    touchChat(created.id, { threadId: active.id });
    setThread(active);
    skipReloadRef.current = true;
    navigate(`${orgPath()}?chat=${encodeURIComponent(created.id)}`, { replace: true });
    return { id: created.id, thread: active, stored: created };
  }

  async function handleSend(content, extras = {}) {
    if (sending) return;
    setSending(true);
    setChatError(null);
    const taggedKey =
      extras.tags?.find((tag) => tag.kind === "ticket")?.label ||
      extractJiraKey(content) ||
      ticketKey;
    if (taggedKey) setTicketKey(taggedKey);
    try {
      const session = await ensureSession(domain);
      const threadTicket = extractJiraKey(session.stored?.contextKey || session.thread?.contextKey);
      if (
        taggedKey &&
        domain === "virin" &&
        virinAnalysis?.status === "AWAITING_INPUT" &&
        virinAnalysis.pendingQuestion &&
        threadTicket !== taggedKey
      ) {
        await answerVirinQuestion(
          taggedKey,
          content.replace(/^Context:[\s\S]*?\n\n/, "").trim() || content
        );
      }
      const optimistic = {
        id: `pending-${Date.now()}`,
        role: "user",
        content,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimistic]);
      const result = await sendAgentChatMessage(session.thread.id, content);
      const title =
        content.length > 60 ? `${content.replace(/^Context:[\s\S]*?\n\n/, "").slice(0, 57)}…` : content;
      touchChat(session.id, {
        threadId: session.thread.id,
        title: session.stored?.title && session.stored.title !== "New chat" ? session.stored.title : title,
        updatedAt: new Date().toISOString(),
      });
      setMessages((prev) => {
        const withoutPending = prev.filter((m) => m.id !== optimistic.id);
        return [
          ...withoutPending,
          result.userMessage ?? optimistic,
          result.assistantMessage,
        ];
      });
      setStarter("");
    } catch (err) {
      setMessages((prev) => prev.filter((m) => !String(m.id).startsWith("pending-")));
      setChatError(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSending(false);
    }
  }

  function handleDomainChange(next) {
    setDomain(next);
    if (chatId) {
      touchChat(chatId, { domain: next });
      setThread(null);
      setMessages([]);
      void loadSession(chatId);
    }
  }

  async function handleCreateSelect({ domain: nextDomain, title, operation, starter: nextStarter }) {
    const created = createChatRecord({
      domain: nextDomain,
      title,
      operation,
      starter: nextStarter,
    });
    try {
      const t = await ensureAgentChatThread(nextDomain, created.contextKey, title);
      touchChat(created.id, { threadId: t.id });
      setThread(t);
      setMessages(t.messages ?? []);
    } catch {
      /* chat is still stored locally */
    }
    setCreateOpen(false);
    setDomain(nextDomain);
    setStarter(nextStarter);
    skipReloadRef.current = true;
    navigate(`${orgPath()}?chat=${encodeURIComponent(created.id)}`);
    window.setTimeout(() => window.dispatchEvent(new CustomEvent(FOCUS_DASHBOARD_COMPOSER)), 80);
  }

  const chatMessages = useMemo(
    () => mergeVirinDiscoveryMessages(messages, domain === "virin" ? virinAnalysis : null),
    [messages, domain, virinAnalysis]
  );

  const streamItems = useMemo(
    () =>
      buildDashboardStream({
        reviewItems,
        events: events ?? [],
        completions,
        messages: chatMessages,
      }),
    [reviewItems, events, completions, chatMessages]
  );

  const hasChat = Boolean(chatId) || messages.length > 0;
  const attention = (reviewItems ?? []).slice(0, 2);

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-6.5rem)] w-full max-w-[42rem] flex-col">
      <CreateNewPanel
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
          if (searchParams.get("new") === "1") {
            navigate(chatId ? `${orgPath()}?chat=${encodeURIComponent(chatId)}` : orgPath(), {
              replace: true,
            });
          }
        }}
        onSelect={handleCreateSelect}
      />

      {needsSetup ? (
        <div className="mb-6">
          <ConnectIntegrationFirst
            integrations={missing}
            title="Connect integrations to start this workspace"
            body="AgentOX runs from Jira tickets or a spreadsheet work board through your Git repository. Connect those in Integrations, then Virin, Ananta, and pipelines will have something to work on."
          />
        </div>
      ) : null}

      {hasChat ? (
        <div className="min-h-0 flex-1">
          <DashboardStream
            items={streamItems.filter((row) => row.kind === "chat")}
            domain={domain}
            loadingChat={sending || virinAnalysis?.status === "RUNNING"}
            loadingOps={false}
            answering={sending}
            onAnswerQuestion={
              virinAnalysis?.status === "AWAITING_INPUT" && ticketKey
                ? (answer) => handleSend(answer)
                : undefined
            }
          />
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center px-2 pb-8 pt-6 text-center">
          <h2 className="text-[2.35rem] font-light tracking-[-0.03em] text-app-ink sm:text-[2.75rem]">
            {dayGreeting()}, {firstName}.
          </h2>
          <p className="mt-3 text-[15px] text-app-ink-dim">
            Ask Virin, Ananta, or Neel. Tag a ticket or GitHub file to ground the chat.
          </p>
          <div className="mt-10 w-full text-left">
            <DashboardComposer
              domain={domain}
              onDomainChange={handleDomainChange}
              onSend={handleSend}
              busy={sending}
              initialText={starter}
            />
          </div>
          {attention.length > 0 ? (
            <div className="mt-6 w-full space-y-2 text-left">
              {attention.map((item) => (
                <Link
                  key={item.id}
                  to={item.actionTo}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-app-border bg-app-surface px-4 py-3"
                >
                  <span className="min-w-0">
                    <span className="block font-mono text-[11px] text-warning">{item.jiraKey}</span>
                    <span className="mt-0.5 block truncate text-[13px] text-app-ink">
                      {item.summary}
                    </span>
                  </span>
                  <span className="shrink-0 text-[12px] font-medium text-app-ink-dim">
                    {item.actionLabel}
                  </span>
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      )}

      {hasChat ? (
        <div className="sticky bottom-0 z-10 bg-gradient-to-t from-app-canvas via-app-canvas to-transparent pb-3 pt-6">
          <DashboardComposer
            domain={domain}
            onDomainChange={handleDomainChange}
            onSend={handleSend}
            busy={sending}
            compact
            initialText={starter}
          />
        </div>
      ) : null}

      {chatError ? (
        <p className="mb-2 text-center text-[13px] text-danger">{chatError}</p>
      ) : null}

      <div className="mt-auto flex flex-wrap justify-center gap-2 pb-3">
        {metricsLoading && !statusMetrics?.length
          ? null
          : (statusMetrics ?? []).map((metric) => (
              <Link
                key={metric.id}
                to={metric.href}
                className="rounded-full px-2.5 py-1 text-[11px] text-app-ink-mute hover:text-app-ink"
              >
                <span className="text-app-ink-dim">{metric.value}</span> {metric.label}
              </Link>
            ))}
      </div>

      <details className="mb-2 rounded-2xl border border-app-border/70">
        <summary className="cursor-pointer px-4 py-2.5 text-center text-[12px] text-app-ink-mute">
          Weekly trend and agent health
        </summary>
        <div className="space-y-4 border-t border-app-border px-3 py-4 text-left">
          <WeeklyTrendChart trend={trendData} loading={trendLoading} />
          <AgentHealthPanel agents={healthData?.agents} loading={healthLoading} />
        </div>
      </details>
    </div>
  );
}
