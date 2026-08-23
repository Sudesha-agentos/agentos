import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import LabelPill from "../../app/components/LabelPill";
import {
  createLogSource,
  deleteLogSource,
  fetchLogSourceCatalog,
  fetchLogSources,
  validateLogSource,
} from "../../entities/logIntelligence";
import { notifyIntegrationsChanged } from "../../shared/lib/chromeEvents";
import { useOrg } from "../../shared/providers/OrgRouteProvider";
import { Panel, PanelHeader } from "../../shared/ui/Panel";
import { SettingsPageShell } from "../../app/layout/SettingsPageShell";

const FALLBACK_SCHEMAS = {
  datadog: {
    displayName: "Datadog",
    mode: "pull",
    docsUrl: "https://docs.datadoghq.com/api/latest/authentication/",
    docsLabel: "Datadog authentication",
    docsHint:
      "Organization Settings → API Keys and Application Keys. The app key needs logs_read.",
    configSchema: [
      { key: "apiKey", label: "API key", type: "password", required: true, secret: true },
      { key: "appKey", label: "Application key", type: "password", required: true, secret: true },
      { key: "site", label: "Site", type: "text", placeholder: "datadoghq.com" },
      { key: "query", label: "Search query", type: "text", placeholder: "status:(error OR critical)" },
    ],
  },
  sentry: {
    displayName: "Sentry",
    mode: "both",
    docsUrl: "https://docs.sentry.io/api/auth/",
    docsLabel: "Sentry authentication",
    docsHint: "Settings → Auth Tokens with event:read. Add organization and project slugs.",
    configSchema: [
      { key: "authToken", label: "Auth token", type: "password", required: true, secret: true },
      { key: "organizationSlug", label: "Organization slug", type: "text", required: true },
      { key: "projectSlug", label: "Project slug", type: "text", required: true },
    ],
  },
  grafana_loki: {
    displayName: "Grafana Loki",
    mode: "pull",
    docsUrl: "https://grafana.com/docs/loki/latest/query/",
    docsLabel: "Grafana Loki query API",
    docsHint: "Grafana Cloud: instance URL + username (instance ID) + API key.",
    configSchema: [
      { key: "baseUrl", label: "Base URL", type: "url", required: true },
      { key: "username", label: "Username / instance ID", type: "text", required: true },
      { key: "apiKey", label: "API key / password", type: "password", required: true, secret: true },
      { key: "query", label: "LogQL query", type: "text", placeholder: '{job="api"} |= "error"' },
    ],
  },
  render: {
    displayName: "Render",
    mode: "pull",
    docsUrl: "https://api-docs.render.com/reference/create-api-key",
    docsLabel: "Render API keys",
    docsHint: "Account Settings → API Keys, then the srv-… ID from the service URL.",
    configSchema: [
      { key: "apiKey", label: "API key", type: "password", required: true, secret: true, placeholder: "rnd_…" },
      { key: "serviceId", label: "Service ID", type: "text", required: true, placeholder: "srv-…" },
    ],
  },
  railway: {
    displayName: "Railway",
    mode: "pull",
    docsUrl: "https://docs.railway.com/guides/public-api",
    docsLabel: "Railway public API",
    docsHint: "Account token from Railway. Prefer environmentId.",
    configSchema: [
      { key: "apiToken", label: "API token", type: "password", required: true, secret: true },
      { key: "environmentId", label: "Environment ID", type: "text" },
    ],
  },
  cloudwatch: {
    displayName: "AWS CloudWatch",
    mode: "pull",
    docsUrl:
      "https://docs.aws.amazon.com/AmazonCloudWatch/latest/logs/Working-with-log-groups-and-streams.html",
    docsLabel: "CloudWatch Logs",
    docsHint: "IAM needs logs:FilterLogEvents on the log group. Region must match.",
    configSchema: [
      { key: "accessKeyId", label: "Access key ID", type: "password", required: true, secret: true },
      { key: "secretAccessKey", label: "Secret access key", type: "password", required: true, secret: true },
      { key: "region", label: "Region", type: "text", required: true, placeholder: "us-east-1" },
      { key: "logGroupName", label: "Log group name", type: "text", required: true },
    ],
  },
  otlp: {
    displayName: "OTLP / OpenTelemetry",
    mode: "push",
    docsUrl: "https://opentelemetry.io/docs/specs/otlp/",
    docsLabel: "OTLP specification",
    docsHint: "Save this source, then point your OTLP exporter at the ingest URL AgentOX shows.",
    configSchema: [
      { key: "serviceName", label: "Default service name", type: "text", placeholder: "backend" },
    ],
  },
};

function emptyConfig(schema) {
  const cfg = {};
  for (const field of schema ?? []) {
    cfg[field.key] = field.type === "select" && field.options?.[0] ? field.options[0].value : "";
  }
  return cfg;
}

export default function LogSourceConnectWidget({ integration, sourceType }) {
  const { orgPath } = useOrg();
  const [catalogEntry, setCatalogEntry] = useState(FALLBACK_SCHEMAS[sourceType] ?? null);
  const [ingestDocs, setIngestDocs] = useState(null);
  const [sources, setSources] = useState([]);
  const [displayName, setDisplayName] = useState("");
  const [config, setConfig] = useState(() =>
    emptyConfig(FALLBACK_SCHEMAS[sourceType]?.configSchema)
  );
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [testOut, setTestOut] = useState("");

  const selected = catalogEntry || FALLBACK_SCHEMAS[sourceType];
  const matching = useMemo(
    () =>
      sources.filter(
        (source) =>
          String(source.sourceType || "").toLowerCase() === String(sourceType).toLowerCase() ||
          (sourceType === "grafana_loki" && source.sourceType === "loki")
      ),
    [sources, sourceType]
  );

  async function refresh() {
    try {
      const [src, types] = await Promise.all([
        fetchLogSources(),
        fetchLogSourceCatalog().catch(() => ({ catalog: [], ingestDocs: null })),
      ]);
      const list = Array.isArray(src) ? src : src?.sources ?? [];
      setSources(list);
      const fromApi = (types.catalog ?? []).find((entry) => entry.id === sourceType);
      if (fromApi) setCatalogEntry(fromApi);
      setIngestDocs(types.ingestDocs ?? null);
    } catch {
      setSources([]);
    }
  }

  useEffect(() => {
    void refresh();
  }, [sourceType]);

  useEffect(() => {
    setConfig(emptyConfig(selected?.configSchema));
    setDisplayName("");
    setError("");
    setTestOut("");
  }, [sourceType]); // eslint-disable-line react-hooks/exhaustive-deps

  function setField(key, value) {
    setConfig((prev) => ({ ...prev, [key]: value }));
  }

  function buildPayload() {
    const out = {};
    for (const field of selected?.configSchema ?? []) {
      const raw = config[field.key];
      if (raw === "" || raw == null) {
        if (field.required) throw new Error(`${field.label} is required`);
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
      const result = await validateLogSource({ sourceType, config: buildPayload() });
      setTestOut(result.message || "Connection looks good.");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy("");
    }
  }

  async function handleCreate(event) {
    event.preventDefault();
    setBusy("save");
    setError("");
    try {
      const result = await createLogSource({
        sourceType,
        displayName: displayName || selected?.displayName || integration.name,
        config: buildPayload(),
        pullNow: selected?.mode !== "push",
      });
      setConfig(emptyConfig(selected?.configSchema));
      setDisplayName("");
      if (result.pull?.error) {
        setError(`Saved, but the first pull failed: ${result.pull.error}`);
      } else if (result.source?.endpoints && selected?.mode !== "pull") {
        setTestOut(
          ["Source saved. Ingest URLs:", result.source.endpoints.otlpIngest, result.source.endpoints.customIngest]
            .filter(Boolean)
            .join("\n")
        );
      } else {
        setTestOut("Connected. AgentOX can pull this source into Log Intelligence.");
      }
      notifyIntegrationsChanged();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy("");
    }
  }

  return (
    <SettingsPageShell
      embedded
      kicker="Observability"
      title={integration.name}
      info={integration.description}
      logo={integration.icon}
    >
      <Panel>
        <PanelHeader
          kicker="Status"
          title={matching.length ? "Connected" : "Not connected"}
          right={
            <LabelPill
              label={matching.length ? `${matching.length} source${matching.length === 1 ? "" : "s"}` : "Not connected"}
              tone={matching.length ? "success" : "muted"}
            />
          }
        />
        {matching.length ? (
          <ul className="divide-y divide-app-border px-5 pb-4">
            {matching.map((source) => (
              <li key={source.id} className="flex items-center justify-between gap-3 py-3 text-[13px]">
                <div>
                  <p className="font-medium text-app-ink">{source.displayName}</p>
                  <p className="text-[12px] text-app-ink-mute">
                    {source.lastPullStatus || "saved"}
                    {source.lastError ? ` · ${source.lastError.slice(0, 120)}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-lg border border-app-border px-2 py-1 text-[12px] text-app-ink-dim"
                  onClick={async () => {
                    await deleteLogSource(source.id);
                    notifyIntegrationsChanged();
                    await refresh();
                  }}
                >
                  Disconnect
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 pb-4 text-[13px] text-app-ink-dim">
            Paste credentials from the official {integration.name} docs. AgentOX tests them before saving.
          </p>
        )}
      </Panel>

      <Panel>
        <PanelHeader
          kicker="Connect"
          title={`Link ${integration.name}`}
          subtitle={selected?.docsHint}
          right={
            selected?.docsUrl ? (
              <a
                href={selected.docsUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[12px] font-medium text-indigo hover:underline"
              >
                {selected.docsLabel || "Official docs"} →
              </a>
            ) : null
          }
        />
        <form onSubmit={handleCreate} className="space-y-3 px-5 pb-5">
          <div>
            <label className="type-kicker">Display name</label>
            <input
              className="mt-1 w-full"
              placeholder={selected?.displayName || integration.name}
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
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
                  onChange={(event) => setField(field.key, event.target.value)}
                >
                  {(field.options ?? []).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={field.type === "password" ? "password" : "text"}
                  className="mt-1 w-full"
                  placeholder={field.placeholder || ""}
                  value={config[field.key] ?? ""}
                  onChange={(event) => setField(field.key, event.target.value)}
                  autoComplete="off"
                />
              )}
              {field.help ? <p className="mt-1 text-[11px] text-app-ink-mute">{field.help}</p> : null}
            </div>
          ))}
          {sourceType === "otlp" && ingestDocs?.otlpIngestTemplate ? (
            <p className="rounded-lg border border-indigo/20 bg-indigo/5 px-3 py-2 font-mono text-[11px] text-app-ink-dim">
              {ingestDocs.otlpIngestTemplate}
            </p>
          ) : null}
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
              {busy === "save" ? "Connecting…" : matching.length ? "Add another source" : "Connect"}
            </button>
          </div>
        </form>
        {testOut ? (
          <pre className="mx-5 mb-5 max-h-48 overflow-auto rounded-lg border border-app-ink/15 bg-app-canvas p-3 text-[11px]">
            {testOut}
          </pre>
        ) : null}
      </Panel>

      <p className="text-[12px] text-app-ink-mute">
        After connecting, open{" "}
        <Link to={orgPath("logs")} className="text-indigo hover:underline">
          Log Intelligence
        </Link>{" "}
        to pull errors and feed them into Virin.
      </p>
    </SettingsPageShell>
  );
}
