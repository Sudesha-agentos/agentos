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
import {
  analyzePmTicket,
  answerVirinQuestion,
  confirmVirinDirection,
  getPmAnalysis,
  getPmResumeStage,
  resumePmAnalysis,
  startPmCodingPipeline,
  usePmAnalyses,
  usePmAnalysis,
} from "../../entities/pm-agents";
import { resumePipeline, usePipelineLive } from "../../entities/pipeline";
import {
  useEngineeringCodingEvents,
  useEngineeringRun,
} from "../../entities/engineering-agent";
import { useQaPipelineReport } from "../../entities/qa";
import { extractJiraKey } from "../pm-analysis/virinChatTranscript";
import {
  liveThinkingAgent,
  liveThinkingLines,
  mergeReleaseMessages,
  releaseProgress,
  shouldStartAnantaHandoff,
  shouldStartVirinRelease,
  stripChatContext,
} from "./releaseTranscript";

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
  const [startingHandoff, setStartingHandoff] = useState(false);
  const [releaseKickoff, setReleaseKickoff] = useState(false);
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
  const { data: virinAnalysis, refetch: refetchAnalysis } = usePmAnalysis(ticketKey, {
    pollMs: ticketKey ? 800 : 0,
    skip: !ticketKey,
  });
  const { active: livePipeline } = usePipelineLive({
    jiraKey: ticketKey,
    pollMs: ticketKey ? 3000 : 0,
    skip: !ticketKey,
  });
  const pipelineId = livePipeline?.pipelineId || virinAnalysis?.engineeringHandoff?.pipelineId || "";
  const { run: engineeringRun } = useEngineeringRun(pipelineId, {
    pollMs: pipelineId ? 2500 : 0,
    live: Boolean(livePipeline?.status === "RUNNING"),
  });
  const { data: qaReport } = useQaPipelineReport(pipelineId, {
    pollMs: pipelineId ? 4000 : undefined,
  });
  const [codingThoughts, setCodingThoughts] = useState([]);
  useEngineeringCodingEvents(pipelineId, {
    enabled: Boolean(pipelineId && livePipeline?.status === "RUNNING"),
    onEvent: (event) => {
      const line = event?.displayLabel || event?.tool || event?.type;
      if (!line) return;
      setCodingThoughts((prev) => [...prev.slice(-7), String(line)]);
    },
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
    if (virinAnalysis?.status && virinAnalysis.status !== "RUNNING") {
      setReleaseKickoff(false);
    }
  }, [virinAnalysis?.status]);

  useEffect(() => {
    function onCreate() {
      setCreateOpen(true);
    }
    window.addEventListener(OPEN_CREATE_NEW, onCreate);
    return () => window.removeEventListener(OPEN_CREATE_NEW, onCreate);
  }, []);

  async function ensureSession(nextDomain = domain, reuseTicket = ticketKey) {
    if (chatId) {
      const stored = getStoredChat(chatId);
      const contextKey = stored?.contextKey || `chat:${chatId}`;
      const active = thread?.id
        ? thread
        : await ensureAgentChatThread(nextDomain, contextKey, stored?.title);
      setThread(active);
      return { id: chatId, thread: active, stored };
    }
    const reuseKey = nextDomain === "virin" ? reuseTicket : "";
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
    const notes = stripChatContext(content) || content;
    try {
      const session = await ensureSession(domain, taggedKey);
      const threadTicket = extractJiraKey(session.stored?.contextKey || session.thread?.contextKey);
      let snapshot = virinAnalysis;
      if (taggedKey && (domain === "virin" || domain === "ananta")) {
        try {
          snapshot = await getPmAnalysis(taggedKey);
        } catch {
          snapshot = null;
        }
      }
      const startRelease = shouldStartVirinRelease(snapshot, domain, taggedKey);
      if (startRelease) {
        setReleaseKickoff(true);
        await analyzePmTicket(taggedKey, {
          mode: "interactive",
          customerNotes: notes && notes !== taggedKey ? notes : undefined,
        });
        void refetchAnalysis();
      } else if (shouldStartAnantaHandoff(snapshot, domain, taggedKey)) {
        await startPmCodingPipeline(taggedKey);
        void refetchAnalysis();
      } else if (
        taggedKey &&
        domain === "virin" &&
        snapshot?.status === "AWAITING_INPUT" &&
        snapshot.pendingQuestion &&
        threadTicket !== taggedKey
      ) {
        await answerVirinQuestion(taggedKey, notes);
      }
      const optimistic = {
        id: `pending-${Date.now()}`,
        role: "user",
        content,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimistic]);
      const title = taggedKey
        ? taggedKey
        : notes.length > 60
          ? `${notes.slice(0, 57)}…`
          : notes;
      if (startRelease) {
        touchChat(session.id, {
          threadId: session.thread.id,
          title: session.stored?.title && session.stored.title !== "New chat" ? session.stored.title : title,
          updatedAt: new Date().toISOString(),
        });
        setStarter("");
        return;
      }
      const result = await sendAgentChatMessage(session.thread.id, content);
      touchChat(session.id, {
        threadId: session.thread.id,
        title: session.stored?.title && session.stored.title !== "New chat" ? session.stored.title : title,
        updatedAt: new Date().toISOString(),
      });
      setMessages((prev) => {
        const withoutPending = prev.filter((m) => m.id !== optimistic.id);
        const next = [...withoutPending, result.userMessage ?? optimistic];
        if (result.assistantMessage) next.push(result.assistantMessage);
        return next;
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

  async function handleConfirm(body) {
    if (!ticketKey) return;
    setSending(true);
    setChatError(null);
    try {
      await confirmVirinDirection(ticketKey, body);
      void refetchAnalysis();
    } catch (err) {
      setChatError(err instanceof Error ? err.message : "Could not continue");
    } finally {
      setSending(false);
    }
  }

  async function handleResume(resumeFrom) {
    if (!ticketKey) return;
    setSending(true);
    setChatError(null);
    try {
      await resumePmAnalysis(ticketKey, {
        resumeFrom: resumeFrom || getPmResumeStage(virinAnalysis),
      });
      void refetchAnalysis();
    } catch (err) {
      setChatError(err instanceof Error ? err.message : "Could not resume");
    } finally {
      setSending(false);
    }
  }

  async function handleResumePipeline(id) {
    if (!id) return;
    setSending(true);
    setChatError(null);
    try {
      await resumePipeline(id);
    } catch (err) {
      setChatError(err instanceof Error ? err.message : "Could not resume pipeline");
    } finally {
      setSending(false);
    }
  }

  async function handleStartHandoff() {
    if (!ticketKey) return;
    setStartingHandoff(true);
    setChatError(null);
    try {
      await startPmCodingPipeline(ticketKey);
      void refetchAnalysis();
    } catch (err) {
      setChatError(err instanceof Error ? err.message : "Could not start coding pipeline");
    } finally {
      setStartingHandoff(false);
    }
  }

  const chatMessages = useMemo(
    () =>
      mergeReleaseMessages(messages, virinAnalysis, livePipeline, {
        engineeringRun,
        qaReport,
        codingThoughts,
      }),
    [messages, virinAnalysis, livePipeline, engineeringRun, qaReport, codingThoughts]
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
  const thinking =
    sending ||
    releaseKickoff ||
    virinAnalysis?.status === "RUNNING" ||
    livePipeline?.status === "RUNNING" ||
    engineeringRun?.status === "RUNNING";
  const thinkingAgent = liveThinkingAgent(virinAnalysis, livePipeline);
  const progress = releaseProgress(virinAnalysis, livePipeline, engineeringRun);

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
            loadingChat={thinking}
            loadingOps={false}
            answering={sending}
            onAnswerQuestion={
              virinAnalysis?.status === "AWAITING_INPUT" && ticketKey
                ? (answer) => handleSend(answer)
                : undefined
            }
            onConfirm={
              virinAnalysis?.status === "AWAITING_CONFIRMATION" ? handleConfirm : undefined
            }
            onStartHandoff={handleStartHandoff}
            onResume={handleResume}
            onResumePipeline={handleResumePipeline}
            startingHandoff={startingHandoff}
            liveThinking={liveThinkingLines(virinAnalysis, livePipeline, {
              engineeringRun,
              qaReport,
              codingThoughts,
            })}
            liveThinkingLabel={
              livePipeline?.currentAction ||
              (progress ? `Thinking · ${progress.label}` : undefined)
            }
            liveThinkingDomain={thinkingAgent}
            progress={progress}
          />
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center px-2 pb-8 pt-6 text-center">
          <h2 className="text-[2.35rem] font-light tracking-[-0.03em] text-app-ink sm:text-[2.75rem]">
            {dayGreeting()}, {firstName}.
          </h2>
          <p className="mt-3 text-[15px] text-app-ink-dim">
            Ask Virin, Ananta, or Neel. Tag a ticket and describe the requirement to run the whole release in this chat.
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
