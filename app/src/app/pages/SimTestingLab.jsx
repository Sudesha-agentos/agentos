import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDocumentRobots } from "../../shared/seo/useDocumentRobots";
import { apiPath } from "../../shared/config/apiBase";
import { authHeaders } from "../../shared/lib/authHeaders";
import { fetchJson } from "../../shared/lib/fetchJson";

function fmtMs(ms) {
  if (ms == null) return "";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function agentColor(agent) {
  if (agent === "virin") return "text-violet-300";
  if (agent === "ananta") return "text-sky-300";
  if (agent === "neel") return "text-emerald-300";
  return "text-zinc-400";
}

function formatUsd(amount) {
  if (!Number.isFinite(amount) || amount <= 0) return "$0.00";
  return `$${Number(amount).toFixed(4)}`;
}

function formatTokens(n) {
  return Number(n || 0).toLocaleString();
}

export default function SimTestingLab() {
  useDocumentRobots("noindex, nofollow");
  const [requirement, setRequirement] = useState(
    "Add a small calculator module with add, subtract, multiply, and divide. Divide by zero must throw."
  );
  const [status, setStatus] = useState(null);
  const [run, setRun] = useState(null);
  const [events, setEvents] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [drafts, setDrafts] = useState({});
  const logRef = useRef(null);
  const seen = useRef(new Set());

  const mergeRun = useCallback((next) => {
    if (!next) return;
    setRun(next);
    if (!Array.isArray(next.events)) return;
    setEvents((prev) => {
      const map = new Map(prev.map((item) => [item.id, item]));
      for (const item of next.events) {
        if (!item?.id) continue;
        map.set(item.id, item);
        seen.current.add(item.id);
      }
      return [...map.values()].sort((a, b) => (a.t ?? 0) - (b.t ?? 0));
    });
  }, []);

  const loadStatus = useCallback(async () => {
    try {
      const data = await fetchJson(apiPath("/api", "/sim-testing/status"), {
        headers: authHeaders(),
      });
      setStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    logRef.current?.scrollTo(0, logRef.current.scrollHeight);
  }, [events.length]);

  useEffect(() => {
    if (!run?.id) return undefined;
    let closed = false;
    const url = apiPath("/api", `/sim-testing/runs/${encodeURIComponent(run.id)}/events`);
    (async () => {
      try {
        const res = await fetch(url, {
          headers: { ...authHeaders(), Accept: "text/event-stream" },
        });
        if (!res.ok || !res.body || closed) return;
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (!closed) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const chunks = buffer.split("\n\n");
          buffer = chunks.pop() ?? "";
          for (const chunk of chunks) {
            const line = chunk.split("\n").find((row) => row.startsWith("data: "));
            if (!line) continue;
            try {
              const payload = JSON.parse(line.slice(6));
              if (!payload?.id || seen.current.has(payload.id)) continue;
              seen.current.add(payload.id);
              setEvents((prev) => [...prev, payload]);
              if (payload.kind === "prompt" && payload.data?.id) {
                setRun((prev) => {
                  if (!prev) return prev;
                  const existing = (prev.prompts ?? []).filter((item) => item.id !== payload.data.id);
                  return { ...prev, prompts: [...existing, payload.data] };
                });
              }
              if (payload.kind === "done" || payload.kind === "error" && payload.label === "FAILED") {
                setRun((prev) =>
                  prev
                    ? {
                        ...prev,
                        status: payload.kind === "done" ? "completed" : "failed",
                        result: payload.data ?? prev.result,
                        error: payload.kind === "error" ? payload.detail : prev.error,
                      }
                    : prev
                );
              }
            } catch {
              /* ignore */
            }
          }
        }
      } catch {
        /* stream ended — polling still fills the log */
      }
    })();
    return () => {
      closed = true;
    };
  }, [run?.id]);

  useEffect(() => {
    if (!run?.id) return undefined;
    if (run.status === "completed" || run.status === "failed") return undefined;
    let cancelled = false;
    const pull = async () => {
      try {
        const data = await fetchJson(apiPath("/api", `/sim-testing/runs/${encodeURIComponent(run.id)}`), {
          headers: authHeaders(),
        });
        if (!cancelled) mergeRun(data.run);
      } catch {
        /* keep last snapshot */
      }
    };
    void pull();
    const timer = setInterval(pull, 1500);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [run?.id, run?.status, mergeRun]);

  const start = async (event) => {
    event.preventDefault();
    const text = requirement.trim();
    if (text.length < 8) {
      setError("Type a requirement in the box first (a short sentence is enough).");
      return;
    }
    setError("");
    setBusy(true);
    seen.current = new Set();
    setEvents([]);
    setDrafts({});
    try {
      const data = await fetchJson(apiPath("/api", "/sim-testing/runs"), {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ requirement: text }),
      });
      mergeRun(data.run);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const latest = events.at(-1);
  const done = events.find((item) => item.kind === "done" || item.kind === "error" && item.label === "FAILED");
  const timings = useMemo(
    () => events.filter((item) => item.kind === "stage" && item.durationMs != null),
    [events]
  );
  const tools = events.filter((item) => item.kind === "tool");
  const usageLines = useMemo(
    () => events.filter((item) => item.kind === "usage"),
    [events]
  );
  const usageTotals = useMemo(() => {
    const fromDone = done?.data?.usage;
    if (fromDone && typeof fromDone.inputTokens === "number") {
      return fromDone;
    }
    return usageLines.reduce(
      (acc, item) => ({
        inputTokens: acc.inputTokens + (item.data?.inputTokens ?? 0),
        outputTokens: acc.outputTokens + (item.data?.outputTokens ?? 0),
        costUsd: acc.costUsd + (item.data?.costUsd ?? 0),
      }),
      { inputTokens: 0, outputTokens: 0, costUsd: 0 }
    );
  }, [done, usageLines]);
  const qaCases = done?.data?.qaTestCases;
  const prompts = run?.prompts ?? [];
  const openPrompts = prompts.filter((item) => item.status === "open");
  const questionPrompts = prompts.filter((item) => item.kind === "question");
  const answeredQuestions = questionPrompts.filter(
    (item) => item.status === "answered" && Boolean(String(item.answer ?? "").trim())
  ).length;
  const running = run?.status === "queued" || run?.status === "running";

  const resolvePrompt = async (prompt, action) => {
    if (!run?.id) return;
    try {
      const data = await fetchJson(
        apiPath("/api", `/sim-testing/runs/${encodeURIComponent(run.id)}/prompts/${encodeURIComponent(prompt.id)}`),
        {
          method: "POST",
          headers: { ...authHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({ action, answer: drafts[prompt.id] ?? "" }),
        }
      );
      mergeRun(data.run);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="relative flex min-h-svh flex-col bg-zinc-950 font-mono text-[13px] text-zinc-200">
      {openPrompts.length > 0 ? (
        <aside className="fixed right-4 top-4 z-20 flex max-h-[70vh] w-[22rem] flex-col overflow-auto rounded-lg border border-amber-700/70 bg-zinc-950/95 p-3 shadow-2xl">
          <p className="text-[11px] uppercase tracking-widest text-amber-300">Questions &amp; approvals</p>
          <p className="mt-1 text-zinc-500">
            Answer every question. The next stage starts only after all of them have answers
            {questionPrompts.length
              ? ` (${answeredQuestions}/${questionPrompts.length}).`
              : "."}
          </p>
          <ul className="mt-3 space-y-3">
            {openPrompts
              .slice()
              .reverse()
              .map((prompt) => (
                <li key={prompt.id} className="rounded-md border border-zinc-800 bg-zinc-900/80 p-2">
                  <p className={`${agentColor(prompt.agent)} text-[11px] uppercase`}>
                    {prompt.agent} · {prompt.kind}
                    {prompt.status !== "open" ? ` · ${prompt.status}` : ""}
                  </p>
                  <p className="mt-1 text-zinc-100">{prompt.title}</p>
                  {prompt.body && prompt.body !== prompt.title ? (
                    <p className="mt-1 whitespace-pre-wrap text-zinc-400">{prompt.body}</p>
                  ) : null}
                  {prompt.status === "open" ? (
                    <div className="mt-2 space-y-2">
                      {prompt.kind === "question" ? (
                        <textarea
                          value={drafts[prompt.id] ?? ""}
                          onChange={(e) =>
                            setDrafts((prev) => ({ ...prev, [prompt.id]: e.target.value }))
                          }
                          rows={2}
                          className="w-full resize-y rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-zinc-100 outline-none"
                          placeholder="Answer…"
                        />
                      ) : null}
                      <div className="flex flex-wrap gap-2">
                        {prompt.kind === "question" ? (
                          <button
                            type="button"
                            disabled={!String(drafts[prompt.id] ?? "").trim()}
                            onClick={() => resolvePrompt(prompt, "answer")}
                            className="rounded bg-amber-200 px-2 py-1 text-[11px] text-zinc-950 disabled:opacity-40"
                          >
                            Send answer
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => resolvePrompt(prompt, "approve")}
                              className="rounded bg-amber-200 px-2 py-1 text-[11px] text-zinc-950"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => resolvePrompt(prompt, "dismiss")}
                              className="rounded border border-zinc-700 px-2 py-1 text-[11px] text-zinc-300"
                            >
                              Dismiss
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ) : prompt.answer ? (
                    <p className="mt-1 text-emerald-300">You: {prompt.answer}</p>
                  ) : null}
                </li>
              ))}
          </ul>
        </aside>
      ) : null}

      <header className={`border-b border-zinc-800 px-4 py-3 ${openPrompts.length ? "pr-[24rem]" : ""}`}>
        <p className="text-[11px] uppercase tracking-widest text-zinc-500">
          Simulation lab · not a product surface
        </p>
        <h1 className="mt-1 text-[16px] text-zinc-100">sim-testing-for-testing</h1>
        <p className="mt-1 text-zinc-500">
          Same pipeline as production (Virin discovery → Ananta plan/code/push → Neel QA).
          This page only adds logs, tokens, and the question panel.
        </p>
      </header>

      <form onSubmit={start} className={`border-b border-zinc-800 px-4 py-3 ${openPrompts.length ? "pr-[24rem]" : ""}`}>
        <textarea
          value={requirement}
          onChange={(e) => setRequirement(e.target.value)}
          rows={4}
          className="w-full resize-y rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-100 outline-none focus:border-zinc-600"
          placeholder="Requirement…"
        />
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={busy || running || !status?.git?.connected || !status?.openai}
            className="rounded-md bg-zinc-100 px-3 py-1.5 text-[12px] font-medium text-zinc-950 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "Starting…" : running ? "Running…" : "Run simulation"}
          </button>
          <span className={status?.git?.connected ? "text-emerald-400" : "text-amber-400"}>
            GitHub {status?.git?.connected ? `connected · ${status.git.repo}` : "not connected"}
          </span>
          <span className={status?.openai ? "text-emerald-400" : "text-amber-400"}>
            LLM {status?.openai ? "ready" : "OPENAI_API_KEY missing"}
          </span>
          {run?.id ? (
            <span className="text-zinc-500">
              {run.id} · {run.status}
            </span>
          ) : null}
        </div>
        {status?.models ? (
          <p className="mt-2 text-zinc-500">
            Virin {status.models.virin.model} · Ananta {status.models.ananta.model} · Neel {status.models.neel.model}
          </p>
        ) : null}
        {error ? <p className="mt-2 text-rose-400">{error}</p> : null}
      </form>

      <div className="grid flex-1 grid-cols-1 gap-0 lg:grid-cols-[1fr_22rem]">
        <div ref={logRef} className="min-h-0 overflow-auto px-4 py-3">
          {events.length === 0 ? (
            <p className="text-zinc-600">Logs appear here as Virin, Ananta, and Neel run.</p>
          ) : (
            <ol className="space-y-1">
              {events.map((item) => (
                <li key={item.id} className="flex gap-3">
                  <span className="w-14 shrink-0 text-zinc-600">{fmtMs(item.elapsedMs)}</span>
                  <span className={`w-16 shrink-0 ${agentColor(item.agent)}`}>{item.agent}</span>
                  <span className="text-zinc-300">
                    {item.kind === "tool"
                      ? "tool · "
                      : item.kind === "usage"
                        ? "tok · "
                        : item.kind === "prompt"
                          ? "ask · "
                          : item.kind === "log"
                            ? "log · "
                            : item.kind === "error"
                              ? "ERR · "
                              : ""}
                    {item.label}
                    {item.detail ? <span className="text-zinc-500"> — {item.detail}</span> : null}
                    {item.durationMs != null ? (
                      <span className="text-zinc-600"> ({fmtMs(item.durationMs)})</span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>

        <aside className="border-t border-zinc-800 px-4 py-3 lg:border-l lg:border-t-0">
          <p className="text-[11px] uppercase tracking-widest text-zinc-500">Live</p>
          <p className="mt-2 text-zinc-300">{latest?.label ?? "Idle"}</p>
          <p className="mt-4 text-[11px] uppercase tracking-widest text-zinc-500">Stage times</p>
          <ul className="mt-2 space-y-1 text-zinc-400">
            {timings.map((item) => (
              <li key={item.id}>
                {item.label.replace(" finished", "")} · {fmtMs(item.durationMs)}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[11px] uppercase tracking-widest text-zinc-500">Tokens &amp; cost</p>
          <p className="mt-2 text-zinc-300">
            in {formatTokens(usageTotals.inputTokens)} · out {formatTokens(usageTotals.outputTokens)}
          </p>
          <p className="text-amber-200">{formatUsd(usageTotals.costUsd)}</p>
          <ul className="mt-2 space-y-2 text-zinc-400">
            {usageLines.map((item) => (
              <li key={item.id}>
                <div className="text-zinc-300">
                  {item.data?.stage ?? item.label} · {item.data?.model ?? "model"}
                </div>
                <div>
                  {formatTokens(item.data?.inputTokens)} in / {formatTokens(item.data?.outputTokens)} out ·{" "}
                  {formatUsd(item.data?.costUsd)}
                </div>
                <div className="text-zinc-600">
                  ${item.data?.inputUsdPerMillion ?? "—"} / ${item.data?.outputUsdPerMillion ?? "—"} per 1M
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[11px] uppercase tracking-widest text-zinc-500">Tools</p>
          <p className="mt-2 text-zinc-400">{tools.length} calls</p>
          <p className="mt-4 text-[11px] uppercase tracking-widest text-zinc-500">QA cases</p>
          <p className="mt-2 text-zinc-400">{qaCases ?? "—"}</p>
          {done?.data?.testsPassed != null || done?.data?.testConductHeadline ? (
            <>
              <p className="mt-4 text-[11px] uppercase tracking-widest text-zinc-500">Tests conducted</p>
              <p className="mt-2 text-zinc-300">
                {done.data.testConductHeadline ??
                  `${done.data.testsPassed ?? 0} passed · ${done.data.testsFailed ?? 0} failed`}
              </p>
              {Array.isArray(done.data.executed) && done.data.executed.length ? (
                <ul className="mt-2 space-y-1 text-zinc-400">
                  {done.data.executed.map((test) => (
                    <li key={test.name}>
                      [{String(test.status ?? "").toUpperCase()}] {test.name}
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : null}
          {done?.data?.whatWasDone ? (
            <>
              <p className="mt-4 text-[11px] uppercase tracking-widest text-zinc-500">Summary</p>
              <ul className="mt-2 space-y-1 text-zinc-400">
                {done.data.whatWasDone.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
