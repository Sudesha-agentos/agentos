import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  acknowledgePattern,
  analysePattern,
  createLogSource,
  deleteLogSource,
  fetchLogPattern,
  resolvePattern,
  testLogSource,
  useLogIntelligenceDashboard,
} from "../../entities/logIntelligence";
import { useOrg } from "../../shared/providers/OrgRouteProvider";
import { PageIntro, Panel, PanelHeader } from "../../shared/ui/Panel";
import { AnimatedAppPage } from "../../shared/ui/AnimatedAppPage";
import { AppTabButton } from "../../shared/ui/AppChrome";

function Metric({ label, value }) {
  return (
    <div className="rounded-xl border border-app-line bg-app-panel px-4 py-3">
      <p className="text-[11px] uppercase tracking-wide text-app-ink-mute">{label}</p>
      <p className="mt-1 text-xl font-semibold text-app-ink">{value ?? "—"}</p>
    </div>
  );
}

function PatternDetail({ patternId, onBack }) {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setError("");
    fetchLogPattern(patternId)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [patternId]);

  const pattern = data?.pattern;
  const entries = data?.entries ?? [];

  async function run(action, fn) {
    setBusy(action);
    setError("");
    try {
      await fn();
      const refreshed = await fetchLogPattern(patternId);
      setData(refreshed);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy("");
    }
  }

  if (!pattern && !error) {
    return <p className="text-[13px] text-app-ink-mute">Loading pattern…</p>;
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        className="text-[13px] text-indigo hover:underline"
        onClick={onBack}
      >
        ← Back to patterns
      </button>
      {error ? <p className="text-[13px] text-rose-500">{error}</p> : null}
      {pattern ? (
        <>
          <Panel>
            <PanelHeader
              kicker={pattern.errorType}
              title={pattern.messageTemplate?.slice(0, 120) || pattern.patternHash}
            />
            <div className="space-y-2 px-5 pb-5 text-[13px] text-app-ink-dim">
              <p>
                Occurrences: <strong>{pattern.occurrenceCount}</strong> · Status:{" "}
                <strong>{pattern.status}</strong>
                {pattern.isQaGap ? " · QA gap" : ""}
              </p>
              {pattern.jiraKey ? <p>Related ticket: {pattern.jiraKey}</p> : null}
              {pattern.pipelineId ? <p>Pipeline: {pattern.pipelineId}</p> : null}
              {pattern.qaGapReason ? <p>QA gap: {pattern.qaGapReason}</p> : null}
              {pattern.rootCauseHypothesis ? (
                <div className="rounded-lg bg-app-bg p-3 whitespace-pre-wrap">
                  {pattern.rootCauseHypothesis}
                </div>
              ) : (
                <p className="text-app-ink-mute">No root-cause analysis yet.</p>
              )}
              {pattern.remediationSteps ? (
                <div className="rounded-lg border border-app-line p-3 whitespace-pre-wrap">
                  {pattern.remediationSteps}
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="button"
                  disabled={Boolean(busy)}
                  className="rounded-lg bg-indigo px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-50"
                  onClick={() => run("analyse", () => analysePattern(pattern.id))}
                >
                  {busy === "analyse" ? "Analysing…" : "Run AI analysis"}
                </button>
                <button
                  type="button"
                  disabled={Boolean(busy)}
                  className="rounded-lg border border-app-line px-3 py-1.5 text-[12px]"
                  onClick={() =>
                    run("ack", () => acknowledgePattern(pattern.id))
                  }
                >
                  Acknowledge
                </button>
                <button
                  type="button"
                  disabled={Boolean(busy)}
                  className="rounded-lg border border-app-line px-3 py-1.5 text-[12px]"
                  onClick={() => run("resolve", () => resolvePattern(pattern.id))}
                >
                  Resolve
                </button>
              </div>
            </div>
          </Panel>
          <Panel>
            <PanelHeader kicker="Entries" title="Recent matching logs" />
            <ul className="divide-y divide-app-line px-5 pb-3">
              {entries.length === 0 ? (
                <li className="py-3 text-[13px] text-app-ink-mute">No entries.</li>
              ) : (
                entries.map((e) => (
                  <li key={e.id} className="py-3 text-[13px]">
                    <div className="flex justify-between gap-3">
                      <span className="font-medium text-app-ink">{e.severity}</span>
                      <span className="text-app-ink-mute">
                        {new Date(e.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <p className="mt-1 text-app-ink-dim line-clamp-3">{e.message}</p>
                  </li>
                ))
              )}
            </ul>
          </Panel>
        </>
      ) : null}
    </div>
  );
}

function SourcesPanel({ sources, onChanged }) {
  const [sourceType, setSourceType] = useState("render");
  const [displayName, setDisplayName] = useState("");
  const [configText, setConfigText] = useState(
    '{\n  "apiKey": "",\n  "serviceId": ""\n}'
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [testOut, setTestOut] = useState("");

  async function handleCreate(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const config = JSON.parse(configText);
      await createLogSource({
        sourceType,
        displayName: displayName || sourceType,
        config,
      });
      setDisplayName("");
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel>
      <PanelHeader kicker="Sources" title="Log sources" />
      <div className="space-y-4 px-5 pb-5">
        <ul className="divide-y divide-app-line">
          {(sources ?? []).length === 0 ? (
            <li className="py-2 text-[13px] text-app-ink-mute">
              No sources configured yet. Add Render or Sentry to start ingesting.
            </li>
          ) : (
            sources.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2 text-[13px]"
              >
                <div>
                  <p className="font-medium text-app-ink">
                    {s.displayName}{" "}
                    <span className="text-app-ink-mute">({s.sourceType})</span>
                  </p>
                  <p className="text-app-ink-mute">
                    Last pull:{" "}
                    {s.lastPulledAt
                      ? new Date(s.lastPulledAt).toLocaleString()
                      : "never"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="rounded border border-app-line px-2 py-1 text-[12px]"
                    onClick={async () => {
                      try {
                        const r = await testLogSource(s.id);
                        setTestOut(JSON.stringify(r.sample ?? r, null, 2));
                      } catch (err) {
                        setError(err instanceof Error ? err.message : String(err));
                      }
                    }}
                  >
                    Test
                  </button>
                  <button
                    type="button"
                    className="rounded border border-rose-300 px-2 py-1 text-[12px] text-rose-600"
                    onClick={async () => {
                      await deleteLogSource(s.id);
                      onChanged?.();
                    }}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))
          )}
        </ul>

        <form onSubmit={handleCreate} className="space-y-2 rounded-xl border border-dashed border-app-line p-3">
          <p className="text-[12px] font-medium text-app-ink">Add source</p>
          <select
            className="w-full rounded-lg border border-app-line bg-app-bg px-2 py-1.5 text-[13px]"
            value={sourceType}
            onChange={(ev) => {
              setSourceType(ev.target.value);
              if (ev.target.value === "sentry") {
                setConfigText(
                  '{\n  "authToken": "",\n  "organizationSlug": "",\n  "projectSlug": ""\n}'
                );
              } else if (ev.target.value === "render") {
                setConfigText('{\n  "apiKey": "",\n  "serviceId": ""\n}');
              } else {
                setConfigText("{}");
              }
            }}
          >
            <option value="render">Render</option>
            <option value="sentry">Sentry</option>
            <option value="railway">Railway</option>
            <option value="cloudwatch">CloudWatch</option>
            <option value="grafana_loki">Grafana Loki</option>
            <option value="datadog">Datadog</option>
            <option value="otlp">OTLP</option>
            <option value="custom">Custom / Vector</option>
          </select>
          <input
            className="w-full rounded-lg border border-app-line bg-app-bg px-2 py-1.5 text-[13px]"
            placeholder="Display name"
            value={displayName}
            onChange={(ev) => setDisplayName(ev.target.value)}
          />
          <textarea
            className="h-28 w-full rounded-lg border border-app-line bg-app-bg px-2 py-1.5 font-mono text-[12px]"
            value={configText}
            onChange={(ev) => setConfigText(ev.target.value)}
          />
          {error ? <p className="text-[12px] text-rose-500">{error}</p> : null}
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-indigo px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save source"}
          </button>
        </form>
        {testOut ? (
          <pre className="max-h-48 overflow-auto rounded-lg bg-app-bg p-3 text-[11px]">
            {testOut}
          </pre>
        ) : null}
      </div>
    </Panel>
  );
}

export default function LogIntelligence() {
  const { patternId } = useParams();
  const { orgPath } = useOrg();
  const [tab, setTab] = useState("patterns");
  const { summary, patterns, anomalies, sources, loading, error, refresh } =
    useLogIntelligenceDashboard();
  const [selectedId, setSelectedId] = useState(patternId || null);

  if (selectedId) {
    return (
      <AnimatedAppPage wide>
        <PageIntro kicker="Observability" title="Log Intelligence" />
        <PatternDetail
          patternId={selectedId}
          onBack={() => {
            setSelectedId(null);
            window.history.replaceState(null, "", orgPath("logs"));
          }}
        />
      </AnimatedAppPage>
    );
  }

  return (
    <AnimatedAppPage wide>
      <PageIntro
        kicker="Observability"
        title="Log Intelligence"
        info="Production errors correlated back to the AI pipeline that shipped the code."
      />

      {error ? (
        <Panel className="border-rose-200">
          <p className="px-5 py-4 text-[13px] text-rose-600">{error}</p>
        </Panel>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Errors today" value={summary?.totalErrorsToday} />
        <Metric label="New error types" value={summary?.newErrorTypesToday} />
        <Metric label="Critical anomalies" value={summary?.criticalAnomalies} />
        <Metric label="Open QA gaps" value={summary?.qaGapsFound} />
      </div>

      <div className="flex flex-wrap gap-1.5">
        <AppTabButton active={tab === "patterns"} onClick={() => setTab("patterns")}>
          Patterns
        </AppTabButton>
        <AppTabButton active={tab === "anomalies"} onClick={() => setTab("anomalies")}>
          Anomalies
        </AppTabButton>
        <AppTabButton active={tab === "sources"} onClick={() => setTab("sources")}>
          Sources
        </AppTabButton>
      </div>

      {loading ? (
        <p className="text-[13px] text-app-ink-mute">Loading…</p>
      ) : null}

      {tab === "patterns" ? (
        <Panel>
          <PanelHeader
            kicker="Open"
            title="Error patterns"
            right={
              <span className="text-[12px] text-app-ink-mute">
                Trend: {summary?.errorRateTrend ?? "—"}
              </span>
            }
          />
          <ul className="divide-y divide-app-line px-5 pb-3">
            {patterns.length === 0 ? (
              <li className="py-4 text-[13px] text-app-ink-mute">
                No open patterns yet. Connect a log source or wait for the next ingestion cycle.
              </li>
            ) : (
              patterns.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className="flex w-full flex-col gap-1 py-3 text-left hover:bg-app-bg/60"
                    onClick={() => {
                      setSelectedId(p.id);
                      window.history.replaceState(
                        null,
                        "",
                        orgPath("logs", "patterns", p.id)
                      );
                    }}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[13px] font-medium text-app-ink">
                        {p.errorType}
                        {p.isQaGap ? (
                          <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-800">
                            QA gap
                          </span>
                        ) : null}
                      </span>
                      <span className="text-[12px] text-app-ink-mute">
                        ×{p.occurrenceCount}
                      </span>
                    </div>
                    <p className="line-clamp-2 text-[12px] text-app-ink-dim">
                      {p.messageTemplate}
                    </p>
                    {p.jiraKey ? (
                      <p className="text-[11px] text-app-ink-mute">
                        Linked: {p.jiraKey}
                      </p>
                    ) : null}
                  </button>
                </li>
              ))
            )}
          </ul>
        </Panel>
      ) : null}

      {tab === "anomalies" ? (
        <Panel>
          <PanelHeader kicker="Alerts" title="Recent anomalies" />
          <ul className="divide-y divide-app-line px-5 pb-3">
            {anomalies.length === 0 ? (
              <li className="py-4 text-[13px] text-app-ink-mute">
                No unacknowledged anomalies.
              </li>
            ) : (
              anomalies.map((a) => (
                <li key={a.id} className="py-3 text-[13px]">
                  <div className="flex justify-between gap-2">
                    <span className="font-medium text-app-ink">
                      {a.anomalyType} · {a.severity}
                    </span>
                    <span className="text-app-ink-mute">
                      {new Date(a.detectedAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-1 text-app-ink-dim">{a.description}</p>
                </li>
              ))
            )}
          </ul>
        </Panel>
      ) : null}

      {tab === "sources" ? (
        <SourcesPanel sources={sources} onChanged={() => void refresh()} />
      ) : null}
    </AnimatedAppPage>
  );
}
