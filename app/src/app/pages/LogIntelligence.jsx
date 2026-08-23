import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import {
  acknowledgePattern,
  analysePattern,
  createLogSource,
  deleteLogSource,
  fetchLogPattern,
  pullLogSource,
  resolvePattern,
  testLogSource,
  validateLogSource,
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

function HealthBadge({ status, lastError }) {
  if (status === "ok") {
    return (
      <span className="rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-success">
        Healthy
      </span>
    );
  }
  if (status === "error") {
    return (
      <span
        className="rounded-full border border-danger/30 bg-danger/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-danger"
        title={lastError || ""}
      >
        Error
      </span>
    );
  }
  if (status === "skipped") {
    return (
      <span className="rounded-full border border-app-border px-2 py-0.5 text-[10px] font-semibold uppercase text-app-ink-mute">
        Push only
      </span>
    );
  }
  return (
    <span className="rounded-full border border-app-border px-2 py-0.5 text-[10px] font-semibold uppercase text-app-ink-mute">
      Never pulled
    </span>
  );
}

function emptyConfigFromSchema(schema) {
  const cfg = {};
  for (const field of schema ?? []) {
    if (field.type === "select" && field.options?.[0]) {
      cfg[field.key] = field.options[0].value;
    } else {
      cfg[field.key] = "";
    }
  }
  return cfg;
}

function SourcesPanel({ sources, catalog, ingestDocs, onChanged, initialProvider }) {
  const providers =
    (catalog ?? []).filter((c) => !c.aliasOf).length > 0
      ? (catalog ?? []).filter((c) => !c.aliasOf)
      : [
          {
            id: "render",
            displayName: "Render",
            mode: "pull",
            docsHint: "Render API key + service ID",
            configSchema: [
              { key: "apiKey", label: "API key", type: "password", required: true, secret: true },
              { key: "serviceId", label: "Service ID", type: "text", required: true },
            ],
          },
          {
            id: "custom",
            displayName: "Other (HTTP / Vector)",
            mode: "push",
            docsHint: "Push via HTTP ingest",
            configSchema: [
              { key: "serviceName", label: "Service name", type: "text" },
            ],
          },
        ];
  const resolvedInitial =
    initialProvider && providers.some((p) => p.id === initialProvider)
      ? initialProvider
      : providers[0]?.id || "render";
  const [sourceType, setSourceType] = useState(resolvedInitial);
  const selected = providers.find((p) => p.id === sourceType) || providers[0];
  const [displayName, setDisplayName] = useState("");
  const [config, setConfig] = useState(() =>
    emptyConfigFromSchema(selected?.configSchema)
  );
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [testOut, setTestOut] = useState("");
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    if (!initialProvider) return;
    if (providers.some((p) => p.id === initialProvider)) {
      setSourceType(initialProvider);
    }
  }, [initialProvider]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selected) return;
    setConfig(emptyConfigFromSchema(selected.configSchema));
  }, [sourceType]); // eslint-disable-line react-hooks/exhaustive-deps

  function setField(key, value) {
    setConfig((prev) => ({ ...prev, [key]: value }));
  }

  function buildConfigPayload() {
    const out = {};
    for (const field of selected?.configSchema ?? []) {
      const raw = config[field.key];
      if (raw === "" || raw == null) {
        if (field.required) {
          throw new Error(`${field.label} is required`);
        }
        continue;
      }
      out[field.key] = raw;
    }
    return out;
  }

  async function handleValidate() {
    setBusy("validate");
    setError("");
    setTestOut("");
    try {
      const payload = buildConfigPayload();
      const r = await validateLogSource({
        sourceType,
        config: payload,
      });
      setTestOut(
        r.message +
          (r.sample?.length
            ? `\n\n${JSON.stringify(r.sample, null, 2)}`
            : "")
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy("");
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    setBusy("save");
    setError("");
    try {
      const payload = buildConfigPayload();
      const result = await createLogSource({
        sourceType,
        displayName: displayName || selected?.displayName || sourceType,
        config: payload,
        pullNow: selected?.mode !== "push",
      });
      setDisplayName("");
      setConfig(emptyConfigFromSchema(selected?.configSchema));
      if (result.pull?.error) {
        setError(`Saved, but initial pull failed: ${result.pull.error}`);
      } else if (result.source?.endpoints && selected?.mode !== "pull") {
        setTestOut(
          [
            "Source saved. Use these ingest URLs:",
            result.source.endpoints.otlpIngest,
            result.source.endpoints.customIngest,
            result.source.endpoints.sentryWebhook,
          ]
            .filter(Boolean)
            .join("\n")
        );
      }
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="space-y-5">
      <Panel>
        <PanelHeader
          kicker="Linked"
          title="Log sources"
          subtitle="Pull from Render/Sentry/Datadog/… or push any other stack via OTLP / HTTP."
        />
        <ul className="divide-y divide-app-border px-5 pb-4">
          {(sources ?? []).length === 0 ? (
            <li className="py-4 text-[13px] text-app-ink-mute">
              No sources linked yet. Add a provider below: Test connection before
              saving when possible.
            </li>
          ) : (
            sources.map((s) => (
              <li key={s.id} className="py-3 text-[13px]">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-app-ink">{s.displayName}</p>
                      <span className="text-app-ink-mute">({s.sourceType})</span>
                      <HealthBadge
                        status={s.lastPullStatus}
                        lastError={s.lastError}
                      />
                    </div>
                    <p className="mt-1 text-[12px] text-app-ink-mute">
                      Last activity:{" "}
                      {s.lastPulledAt
                        ? new Date(s.lastPulledAt).toLocaleString()
                        : "never"}
                    </p>
                    {s.lastError ? (
                      <p className="mt-1 text-[12px] text-danger">
                        {s.lastError.slice(0, 240)}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded border border-app-border px-2 py-1 text-[12px]"
                      onClick={async () => {
                        setError("");
                        try {
                          const r = await testLogSource(s.id);
                          setExpandedId(s.id);
                          setTestOut(
                            JSON.stringify(
                              {
                                mode: r.mode,
                                message: r.message,
                                sample: r.sample,
                                endpoints: r.endpoints,
                              },
                              null,
                              2
                            )
                          );
                          onChanged?.();
                        } catch (err) {
                          setError(
                            err instanceof Error ? err.message : String(err)
                          );
                          onChanged?.();
                        }
                      }}
                    >
                      Test
                    </button>
                    {s.catalog?.mode !== "push" ? (
                      <button
                        type="button"
                        className="rounded border border-indigo/30 bg-indigo/10 px-2 py-1 text-[12px] text-indigo"
                        onClick={async () => {
                          setError("");
                          try {
                            const r = await pullLogSource(s.id);
                            setTestOut(
                              r.error
                                ? `Pull failed: ${r.error}`
                                : `Pulled ${r.processed ?? 0} new entr(y/ies).`
                            );
                            onChanged?.();
                          } catch (err) {
                            setError(
                              err instanceof Error ? err.message : String(err)
                            );
                          }
                        }}
                      >
                        Pull now
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="rounded border border-app-border px-2 py-1 text-[12px]"
                      onClick={() =>
                        setExpandedId((id) => (id === s.id ? null : s.id))
                      }
                    >
                      {expandedId === s.id ? "Hide URLs" : "Ingest URLs"}
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
                </div>
                {expandedId === s.id && s.endpoints ? (
                  <div className="mt-2 space-y-1 rounded-app-sm border border-app-border bg-app-surface-muted/30 p-3 font-mono text-[11px] text-app-ink-dim">
                    {Object.entries(s.endpoints).map(([k, v]) =>
                      typeof v === "string" ? (
                        <p key={k}>
                          <span className="text-app-ink-mute">{k}:</span> {v}
                        </p>
                      ) : null
                    )}
                  </div>
                ) : null}
              </li>
            ))
          )}
        </ul>
      </Panel>

      <Panel>
        <PanelHeader
          kicker="Link"
          title="Connect a log system"
          subtitle={selected?.docsHint}
        />
        <form onSubmit={handleCreate} className="space-y-3 px-5 pb-5">
          <div>
            <label className="type-kicker">Choose provider (one click)</label>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {providers.map((p) => {
                const active = p.id === sourceType;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSourceType(p.id)}
                    className={`rounded-app border px-3 py-3 text-left transition ${
                      active
                        ? "border-indigo bg-indigo/10 shadow-sm"
                        : "border-app-border bg-app-surface-muted/20 hover:border-indigo/40"
                    }`}
                  >
                    <p className="text-[13px] font-medium text-app-ink">{p.displayName}</p>
                    <p className="mt-1 text-[10px] uppercase tracking-wide text-app-ink-mute">
                      {p.mode === "push"
                        ? "Push"
                        : p.mode === "both"
                          ? "Pull + push"
                          : "Pull"}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {sourceType === "custom" || sourceType === "otlp" ? (
            <div className="rounded-app-sm border border-indigo/25 bg-indigo/5 px-3 py-2 text-[12px] text-app-ink-dim">
              <p className="font-medium text-app-ink">Any other system</p>
              <p className="mt-1">
                Save this source, then point Vector / Fluent Bit / OTLP exporter
                at the ingest URLs. Templates:
              </p>
              {ingestDocs ? (
                <ul className="mt-2 space-y-1 font-mono text-[11px]">
                  <li>{ingestDocs.customIngestTemplate}</li>
                  <li>{ingestDocs.otlpIngestTemplate}</li>
                </ul>
              ) : null}
            </div>
          ) : null}

          <div>
            <label className="type-kicker">Display name</label>
            <input
              className="mt-1 w-full"
              placeholder={selected?.displayName || "My API logs"}
              value={displayName}
              onChange={(ev) => setDisplayName(ev.target.value)}
            />
          </div>

          {(selected?.configSchema ?? []).map((field) => (
            <div key={field.key}>
              <label className="type-kicker">
                {field.label}
                {field.required ? " *" : ""}
              </label>
              {field.type === "select" ? (
                <select
                  className="mt-1 w-full"
                  value={config[field.key] ?? ""}
                  onChange={(ev) => setField(field.key, ev.target.value)}
                >
                  {(field.options ?? []).map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={field.type === "password" ? "password" : "text"}
                  className="mt-1 w-full"
                  placeholder={field.placeholder || ""}
                  value={config[field.key] ?? ""}
                  onChange={(ev) => setField(field.key, ev.target.value)}
                  autoComplete="off"
                />
              )}
              {field.help ? (
                <p className="mt-1 text-[11px] text-app-ink-mute">{field.help}</p>
              ) : null}
            </div>
          ))}

          {error ? <p className="text-[12px] text-danger">{error}</p> : null}

          <div className="flex flex-wrap gap-2">
            {selected?.mode !== "push" ? (
              <button
                type="button"
                disabled={!!busy}
                onClick={() => void handleValidate()}
                className="rounded-lg border border-app-border px-3 py-1.5 text-[12px] font-medium disabled:opacity-50"
              >
                {busy === "validate" ? "Testing…" : "Test connection"}
              </button>
            ) : null}
            <button
              type="submit"
              disabled={!!busy}
              className="rounded-lg bg-indigo px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-50"
            >
              {busy === "save" ? "Saving…" : "Save & link"}
            </button>
          </div>
        </form>
        {testOut ? (
          <pre className="mx-5 mb-5 max-h-64 overflow-auto rounded-lg border border-app-border bg-app-bg p-3 text-[11px]">
            {testOut}
          </pre>
        ) : null}
      </Panel>
    </div>
  );
}

export default function LogIntelligence() {
  const { patternId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { orgPath } = useOrg();
  const tabFromUrl = searchParams.get("tab");
  const providerFromUrl = searchParams.get("provider");
  const [tab, setTab] = useState(
    tabFromUrl === "sources" || tabFromUrl === "anomalies" || tabFromUrl === "patterns"
      ? tabFromUrl
      : "patterns"
  );
  const {
    summary,
    patterns,
    anomalies,
    sources,
    catalog,
    ingestDocs,
    loading,
    error,
    refresh,
  } = useLogIntelligenceDashboard();
  const [selectedId, setSelectedId] = useState(patternId || null);

  useEffect(() => {
    if (tabFromUrl === "sources" || tabFromUrl === "anomalies" || tabFromUrl === "patterns") {
      setTab(tabFromUrl);
    }
  }, [tabFromUrl]);

  function selectTab(next) {
    setTab(next);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("tab", next);
    if (next !== "sources") nextParams.delete("provider");
    setSearchParams(nextParams, { replace: true });
  }

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
        <AppTabButton active={tab === "patterns"} onClick={() => selectTab("patterns")}>
          Patterns
        </AppTabButton>
        <AppTabButton active={tab === "anomalies"} onClick={() => selectTab("anomalies")}>
          Anomalies
        </AppTabButton>
        <AppTabButton active={tab === "sources"} onClick={() => selectTab("sources")}>
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
        <SourcesPanel
          sources={sources}
          catalog={catalog}
          ingestDocs={ingestDocs}
          onChanged={() => void refresh()}
          initialProvider={providerFromUrl || undefined}
        />
      ) : null}
    </AnimatedAppPage>
  );
}
