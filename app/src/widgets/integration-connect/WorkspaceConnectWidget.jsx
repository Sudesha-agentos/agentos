import { useEffect, useState } from "react";
import LabelPill from "../../app/components/LabelPill";
import {
  connectWorkspace,
  disconnectWorkspace,
  fetchWorkspaceCatalog,
  listWorkspaceConnections,
  validateWorkspaceConnection,
} from "../../entities/workspace-connections";
import { notifyIntegrationsChanged } from "../../shared/lib/chromeEvents";
import { Panel, PanelHeader } from "../../shared/ui/Panel";
import { SettingsPageShell } from "../../app/layout/SettingsPageShell";

function emptyConfig(schema) {
  const cfg = {};
  for (const field of schema ?? []) cfg[field.key] = "";
  return cfg;
}

export default function WorkspaceConnectWidget({ integration }) {
  const providerId = integration.id;
  const [catalog, setCatalog] = useState(null);
  const [connection, setConnection] = useState(null);
  const [config, setConfig] = useState({});
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  async function refresh() {
    const [cat, list] = await Promise.all([
      fetchWorkspaceCatalog(),
      listWorkspaceConnections().catch(() => ({ connections: [] })),
    ]);
    const entry = (cat.catalog ?? []).find((item) => item.id === providerId) ?? null;
    setCatalog(entry);
    setConnection((list.connections ?? []).find((item) => item.provider === providerId) ?? null);
    return entry;
  }

  useEffect(() => {
    setError("");
    setStatus("");
    setConnection(null);
    void refresh()
      .then((entry) => {
        setConfig(emptyConfig(entry?.configSchema));
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err));
      });
  }, [providerId]); // eslint-disable-line react-hooks/exhaustive-deps

  function setField(key, value) {
    setConfig((prev) => ({ ...prev, [key]: value }));
  }

  function buildPayload() {
    const out = {};
    for (const field of catalog?.configSchema ?? []) {
      const raw = String(config[field.key] ?? "").trim();
      if (!raw) {
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
    setStatus("");
    try {
      const result = await validateWorkspaceConnection(providerId, buildPayload());
      const bits = Object.entries(result.metadata || {})
        .filter(([, value]) => value)
        .map(([key, value]) => `${key}: ${value}`);
      setStatus(bits.length ? `Verified. ${bits.join(" · ")}` : "Verified. Those credentials work.");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy("");
    }
  }

  async function handleConnect(event) {
    event.preventDefault();
    setBusy("save");
    setError("");
    setStatus("");
    try {
      const result = await connectWorkspace(providerId, buildPayload(), integration.name);
      setConnection(result.connection);
      setConfig(emptyConfig(catalog?.configSchema));
      setStatus("Connected. Agents can use this as read context.");
      notifyIntegrationsChanged();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy("");
    }
  }

  async function handleDisconnect() {
    setBusy("delete");
    setError("");
    try {
      await disconnectWorkspace(providerId);
      setConnection(null);
      notifyIntegrationsChanged();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy("");
    }
  }

  const connected = Boolean(connection);

  return (
    <SettingsPageShell
      embedded
      kicker={integration.tag || "Business Data"}
      title={integration.name}
      info={integration.description}
    >
      <Panel>
        <PanelHeader
          kicker="Status"
          title={connected ? "Connected" : "Not connected"}
          right={
            <LabelPill
              label={connected ? "Connected" : "Not connected"}
              tone={connected ? "success" : "muted"}
            />
          }
        />
        <div className="space-y-3 px-5 py-4 sm:px-6">
          {connected ? (
            <>
              <p className="text-[13px] text-app-ink-dim">
                {connection.displayName}
                {connection.metadata?.team ? ` · ${connection.metadata.team}` : ""}
                {connection.metadata?.organization ? ` · ${connection.metadata.organization}` : ""}
                {connection.lastVerifiedAt
                  ? ` · verified ${new Date(connection.lastVerifiedAt).toLocaleString()}`
                  : ""}
              </p>
              <button
                type="button"
                disabled={!!busy}
                onClick={() => void handleDisconnect()}
                className="rounded-lg border border-app-border px-3 py-1.5 text-[12px] font-medium text-app-ink-dim disabled:opacity-50"
              >
                {busy === "delete" ? "Disconnecting…" : "Disconnect"}
              </button>
            </>
          ) : (
            <p className="text-[13px] text-app-ink-dim">
              Follow the official {integration.name} steps, then paste credentials here. AgentOX
              verifies them against the vendor API before saving.
            </p>
          )}
        </div>
      </Panel>

      <Panel>
        <PanelHeader
          kicker={connected ? "Reconnect" : "Connect"}
          title={connected ? "Replace credentials" : `Connect ${integration.name}`}
          right={
            catalog?.docsUrl ? (
              <a
                href={catalog.docsUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[12px] font-medium text-indigo hover:underline"
              >
                {catalog.docsLabel || "Official docs"} →
              </a>
            ) : null
          }
        />
        <form onSubmit={handleConnect} className="space-y-4 px-5 pb-5">
          {catalog?.steps?.length ? (
            <ol className="list-decimal space-y-1.5 pl-5 text-[13px] leading-relaxed text-app-ink-dim">
              {catalog.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          ) : null}
          {(catalog?.configSchema ?? []).map((field) => (
            <div key={field.key}>
              <label className="type-kicker">
                {field.label}
                {field.required ? " *" : ""}
              </label>
              <input
                type={field.type === "password" ? "password" : "text"}
                className="mt-1 w-full rounded-lg border border-app-border bg-app-bg px-2 py-1.5 text-[13px]"
                placeholder={field.placeholder || ""}
                value={config[field.key] ?? ""}
                onChange={(event) => setField(field.key, event.target.value)}
                autoComplete="off"
              />
              {field.help ? <p className="mt-1 text-[11px] text-app-ink-mute">{field.help}</p> : null}
            </div>
          ))}
          {error ? <p className="text-[12px] text-danger">{error}</p> : null}
          {status ? <p className="text-[12px] text-success">{status}</p> : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!!busy}
              onClick={() => void handleValidate()}
              className="rounded-lg border border-app-border px-3 py-1.5 text-[12px] font-medium disabled:opacity-50"
            >
              {busy === "validate" ? "Testing…" : "Test connection"}
            </button>
            <button
              type="submit"
              disabled={!!busy}
              className="rounded-lg bg-indigo px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-50"
            >
              {busy === "save" ? "Connecting…" : connected ? "Save new credentials" : "Connect"}
            </button>
          </div>
        </form>
      </Panel>
    </SettingsPageShell>
  );
}
