import { useMemo, useState } from "react";
import LabelPill from "../components/LabelPill";
import Spinner from "../components/Spinner";
import EmptyState from "../components/EmptyState";
import { Panel, PanelHeader } from "../../shared/ui/Panel";
import { SettingsPageShell } from "../layout/SettingsPageShell";
import { SettingsRow, SettingsSection } from "../../shared/ui/SettingsForm";
import { DATA_MODE, DATA_MODES } from "../../shared/config/app";
import {
  confirmCustomerDatabaseMigration,
  createCustomerDatabase,
  deleteCustomerDatabase,
  introspectCustomerDatabase,
  listCustomerDatabaseMigrations,
  testCustomerDatabase,
  useCustomerDatabases,
} from "../../entities/customer-db";

const INPUT = "mt-1.5 w-full";

const PROVIDER_COPY = {
  postgresql: {
    title: "PostgreSQL",
    kicker: "Existing database",
    info: "Attach RDS, Neon, Cloud SQL, or any Postgres the AgentOX API can reach. Agents reference tables by database id + schema.table.",
    hostPlaceholder: "db.example.com",
    defaultPort: 5432,
  },
  supabase: {
    title: "Supabase",
    kicker: "Existing database",
    info: "Paste the Supabase Postgres URI from Project Settings → Database. This is your project database, not AgentOX’s.",
    hostPlaceholder: "db.xxxxx.supabase.co",
    defaultPort: 5432,
  },
  mysql: {
    title: "MySQL",
    kicker: "Existing database",
    info: "Attach Aurora MySQL, Cloud SQL, or self-hosted MySQL. Allow the AgentOX API IP if the instance is firewalled.",
    hostPlaceholder: "mysql.example.com",
    defaultPort: 3306,
  },
};

function emptyForm(provider) {
  return {
    name: "",
    connectionString: "",
    host: "",
    port: PROVIDER_COPY[provider]?.defaultPort ?? 5432,
    databaseName: provider === "supabase" ? "postgres" : "",
    username: provider === "supabase" ? "postgres" : "",
    password: "",
    environment: "staging",
    ssl: true,
    schemaAllowlist: "",
    autoMigrate: provider !== "postgresql" ? true : true,
  };
}

export default function DatabaseIntegration({ embedded = false, defaultProvider = "postgresql" }) {
  const copy = PROVIDER_COPY[defaultProvider] ?? PROVIDER_COPY.postgresql;
  const { data, error, loading, refetch } = useCustomerDatabases({ pollMs: 12000 });
  const databases = useMemo(() => {
    const list = data?.databases ?? [];
    return list;
  }, [data]);

  const forProvider = databases.filter((db) => db.provider === defaultProvider);
  const others = databases.filter((db) => db.provider !== defaultProvider);

  if (loading && !data) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (error && DATA_MODE !== DATA_MODES.MOCK) {
    return (
      <EmptyState
        title="Cannot reach API"
        body="Set VITE_API_URL on Vercel to your Render URL and redeploy."
      />
    );
  }

  return (
    <SettingsPageShell
      embedded={embedded}
      kicker={copy.kicker}
      title={copy.title}
      info={copy.info}
      logo={`/marketing/integrations/${defaultProvider === "postgresql" ? "postgresql" : defaultProvider}.svg`}
    >
      <div className="space-y-6">
        {forProvider.map((db) => (
          <DatabaseCard key={db.id} database={db} onChanged={refetch} />
        ))}
        <AddDatabaseForm provider={defaultProvider} onCreated={refetch} />
        {others.length > 0 ? (
          <Panel>
            <PanelHeader
              kicker="Workspace"
              title="Other connected databases"
              info="This workspace can attach many databases. Open PostgreSQL, MySQL, or Supabase to manage those connections."
            />
            <ul className="divide-y divide-app-border px-5 py-2 text-sm">
              {others.map((db) => (
                <li key={db.id} className="flex items-center justify-between py-3">
                  <span className="text-app-ink">
                    {db.name}{" "}
                    <span className="text-app-ink-dim">
                      ({db.provider} · {db.environment})
                    </span>
                  </span>
                  <LabelPill
                    label={db.tableCount ? `${db.tableCount} tables` : "Not introspected"}
                    tone={db.tableCount ? "success" : "muted"}
                  />
                </li>
              ))}
            </ul>
          </Panel>
        ) : null}
      </div>
    </SettingsPageShell>
  );
}

function DatabaseCard({ database, onChanged }) {
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [migrations, setMigrations] = useState([]);

  async function run(label, fn) {
    setBusy(label);
    setMessage("");
    try {
      const result = await fn();
      setMessage(result?.message || `${label} succeeded`);
      await onChanged();
      return result;
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      setBusy("");
    }
  }

  return (
    <Panel>
      <PanelHeader
        kicker={database.environment}
        title={database.name}
        info={`${database.username}@${database.host}:${database.port}/${database.databaseName}`}
        right={
          <LabelPill
            label={database.lastError ? "Error" : database.tableCount ? "Connected" : "Needs introspect"}
            tone={database.lastError ? "danger" : database.tableCount ? "success" : "warning"}
          />
        }
      />
      <div className="space-y-4 p-5 sm:p-6">
        <p className="text-[13px] text-app-ink-dim">
          SSL {database.ssl ? "on" : "off"} · auto-migrate {database.autoMigrate ? "on" : "off"} ·
          production confirm {database.requireConfirmToApply ? "required" : "not required"} ·{" "}
          {database.tableCount} tables cached
        </p>
        {database.lastError ? (
          <p className="rounded-app-sm border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-800">
            {database.lastError}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={() => run("Test", () => testCustomerDatabase(database.id))}
            className="rounded-full border border-app-border px-3 py-1.5 text-[13px] font-medium text-app-ink transition hover:border-indigo/30"
          >
            {busy === "Test" ? "Testing…" : "Test connection"}
          </button>
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={() => run("Introspect", () => introspectCustomerDatabase(database.id))}
            className="rounded-full border border-app-border px-3 py-1.5 text-[13px] font-medium text-app-ink transition hover:border-indigo/30"
          >
            {busy === "Introspect" ? "Reading schema…" : "Introspect schema"}
          </button>
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={async () => {
              const result = await run("Migrations", () =>
                listCustomerDatabaseMigrations(database.id)
              );
              setMigrations(result?.migrations ?? []);
            }}
            className="rounded-full border border-app-border px-3 py-1.5 text-[13px] font-medium text-app-ink transition hover:border-indigo/30"
          >
            Pending migrations
          </button>
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={() => {
              if (!window.confirm(`Disconnect ${database.name}? Agents will lose access immediately.`)) return;
              run("Disconnect", () => deleteCustomerDatabase(database.id));
            }}
            className="rounded-full border border-red-200 px-3 py-1.5 text-[13px] font-medium text-red-700 transition hover:bg-red-50"
          >
            Disconnect
          </button>
        </div>
        {message ? <p className="text-[13px] text-app-ink-dim">{message}</p> : null}
        {migrations.length > 0 ? (
          <ul className="space-y-2 text-[13px]">
            {migrations.map((m) => (
              <li
                key={m.id}
                className="rounded-app-sm border border-app-border bg-app-surface-muted/40 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <LabelPill
                    label={m.status}
                    tone={
                      m.status === "applied"
                        ? "success"
                        : m.status === "failed"
                          ? "danger"
                          : "warning"
                    }
                  />
                  {m.status === "awaiting_confirm" ? (
                    <button
                      type="button"
                      className="text-indigo"
                      onClick={() =>
                        run("Confirm", () =>
                          confirmCustomerDatabaseMigration(database.id, m.id)
                        )
                      }
                    >
                      Confirm & apply
                    </button>
                  ) : null}
                </div>
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-[12px] text-app-ink-dim">
                  {m.sql}
                </pre>
                {m.error ? <p className="mt-1 text-red-700">{m.error}</p> : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </Panel>
  );
}

function AddDatabaseForm({ provider, onCreated }) {
  const [form, setForm] = useState(() => emptyForm(provider));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setPending(true);
    setError("");
    try {
      const schemaAllowlist = form.schemaAllowlist
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      await createCustomerDatabase({
        name: form.name,
        provider,
        environment: form.environment,
        connectionString: form.connectionString || undefined,
        host: form.host,
        port: Number(form.port),
        databaseName: form.databaseName,
        username: form.username,
        password: form.password,
        ssl: form.ssl,
        schemaAllowlist,
        autoMigrate: form.environment !== "production",
        requireConfirmToApply: form.environment === "production",
      });
      setForm(emptyForm(provider));
      await onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Panel>
      <PanelHeader
        kicker="Add database"
        title={`Connect ${PROVIDER_COPY[provider]?.title ?? "database"}`}
        info="Credentials are encrypted at rest. The AgentOX API host must be able to reach this database (SSL + IP allowlist)."
      />
      <form onSubmit={handleSubmit} className="p-5 sm:p-6">
        <SettingsSection>
          <SettingsRow label="Display name" info="Shown to agents and in this list. You can attach many databases.">
            <input
              className={INPUT}
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              placeholder={provider === "supabase" ? "Production Supabase" : "Staging Postgres"}
              required
            />
          </SettingsRow>
          <SettingsRow label="Environment">
            <select
              className={INPUT}
              value={form.environment}
              onChange={(e) => setField("environment", e.target.value)}
            >
              <option value="development">Development — auto-migrate</option>
              <option value="staging">Staging — auto-migrate</option>
              <option value="production">Production — human confirm before DDL</option>
            </select>
          </SettingsRow>
          <SettingsRow
            label="Connection string"
            info="Optional. postgres:// or mysql:// URI fills host, user, password, and database."
          >
            <input
              className={INPUT}
              value={form.connectionString}
              onChange={(e) => setField("connectionString", e.target.value)}
              placeholder={
                provider === "mysql"
                  ? "mysql://user:pass@host:3306/app"
                  : "postgresql://user:pass@host:5432/app?sslmode=require"
              }
              autoComplete="off"
            />
          </SettingsRow>
          <SettingsRow label="Host">
            <input
              className={INPUT}
              value={form.host}
              onChange={(e) => setField("host", e.target.value)}
              placeholder={PROVIDER_COPY[provider]?.hostPlaceholder}
            />
          </SettingsRow>
          <SettingsRow label="Port">
            <input
              className={INPUT}
              type="number"
              value={form.port}
              onChange={(e) => setField("port", e.target.value)}
            />
            <p className="mt-1 text-[12px] text-app-ink-mute">
              Ignored when a connection string is pasted.
            </p>
          </SettingsRow>
          <SettingsRow label="Database name">
            <input
              className={INPUT}
              value={form.databaseName}
              onChange={(e) => setField("databaseName", e.target.value)}
            />
          </SettingsRow>
          <SettingsRow label="Username">
            <input
              className={INPUT}
              value={form.username}
              onChange={(e) => setField("username", e.target.value)}
              autoComplete="off"
            />
          </SettingsRow>
          <SettingsRow label="Password">
            <input
              className={INPUT}
              type="password"
              value={form.password}
              onChange={(e) => setField("password", e.target.value)}
              autoComplete="new-password"
            />
          </SettingsRow>
          <SettingsRow label="SSL">
            <label className="mt-2 flex items-center gap-2 text-sm text-app-ink">
              <input
                type="checkbox"
                checked={form.ssl}
                onChange={(e) => setField("ssl", e.target.checked)}
              />
              Require SSL
            </label>
          </SettingsRow>
          <SettingsRow
            label="Schema allowlist"
            info="Comma-separated. Empty means all non-system schemas. Agents only see listed schemas."
          >
            <input
              className={INPUT}
              value={form.schemaAllowlist}
              onChange={(e) => setField("schemaAllowlist", e.target.value)}
              placeholder="public, app"
            />
          </SettingsRow>
        </SettingsSection>
        {error ? <p className="mt-4 text-[13px] text-red-700">{error}</p> : null}
        <div className="mt-6 flex justify-end">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-indigo px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo/90 disabled:opacity-50"
          >
            {pending ? "Connecting…" : "Connect database"}
          </button>
        </div>
      </form>
    </Panel>
  );
}
