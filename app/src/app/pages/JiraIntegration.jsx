import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  advanceIssue,
  connectJiraIntegration,
  getBoardColumns,
  getIntegrationSetup,
  listAiWorkerIssues,
  saveIntegrationMapping,
  syncWorkingColumn,
} from "../../entities/jira-intake";
import { settingsAdapter } from "../../entities/settings";
import { useResource } from "../../shared/lib/useResource";
import EmptyState from "../components/EmptyState";
import LabelPill from "../components/LabelPill";
import Spinner from "../components/Spinner";
import { PageIntro, Panel, PanelHeader } from "../../shared/ui/Panel";

export default function JiraIntegration() {
  const {
    data: setup,
    error: setupError,
    loading: setupLoading,
    refetch: refetchSetup,
  } = useResource(() => getIntegrationSetup(), []);

  const {
    data: issuesData,
    error: issuesError,
    loading: issuesLoading,
    refetch: refetchIssues,
  } = useResource(() => listAiWorkerIssues("1"), [], {
    pollMs: 10000,
    enabled: Boolean(setup?.connected),
  });

  const [baseUrl, setBaseUrl] = useState("");
  const [email, setEmail] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [boardId, setBoardId] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [columns, setColumns] = useState([]);
  const [workingColumn, setWorkingColumn] = useState("");
  const [nextColumn, setNextColumn] = useState("");
  const [connectPending, setConnectPending] = useState(false);
  const [connectError, setConnectError] = useState("");
  const [mappingPending, setMappingPending] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [syncPending, setSyncPending] = useState(false);
  const [advancePendingKey, setAdvancePendingKey] = useState(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);

  const connected = Boolean(setup?.connected);
  const items = issuesData?.items ?? [];

  const applySetupToForm = useCallback((data) => {
    if (!data?.jira) return;
    setBaseUrl(data.jira.baseUrl || "");
    setEmail(data.jira.email || "");
    setBoardId(data.jira.boardId || "");
    setWebhookSecret(data.jira.webhookSecret || "");
    if (data.mapping?.workingColumnName) {
      setWorkingColumn(data.mapping.workingColumnName);
    }
    if (data.mapping?.nextColumnName) {
      setNextColumn(data.mapping.nextColumnName);
    }
  }, []);

  useEffect(() => {
    applySetupToForm(setup);
  }, [setup, applySetupToForm]);

  useEffect(() => {
    if (!connected) return;
    let cancelled = false;
    (async () => {
      try {
        const { columns: cols } = await getBoardColumns();
        if (!cancelled && cols?.length) {
          setColumns(cols);
        }
      } catch {
        /* columns load optional until mapping step */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [connected]);

  const columnOptions = useMemo(
    () => columns.map((c) => c.name).filter(Boolean),
    [columns]
  );

  async function handleConnect() {
    setConnectPending(true);
    setConnectError("");
    setStatusMessage("");
    try {
      const result = await connectJiraIntegration({
        baseUrl,
        email,
        boardId,
        apiToken: apiToken.trim() || undefined,
        webhookSecret: webhookSecret.trim() || undefined,
      });

      setColumns(result.columns ?? []);
      if (result.mapping?.workingColumnName) {
        setWorkingColumn(result.mapping.workingColumnName);
      } else if (result.columns?.length >= 2 && !workingColumn) {
        setWorkingColumn(result.columns[0].name);
      }
      if (result.mapping?.nextColumnName) {
        setNextColumn(result.mapping.nextColumnName);
      } else if (result.columns?.length >= 2 && !nextColumn) {
        setNextColumn(result.columns[1].name);
      }
      if (result.jira?.webhookSecret) {
        setWebhookSecret(result.jira.webhookSecret);
      }

      await settingsAdapter.save({
        ...(await settingsAdapter.get()),
        jiraBaseUrl: baseUrl,
        jiraEmail: email,
        jiraApiToken: apiToken.trim() ? apiToken : "stored-on-server",
        webhookSecret: result.jira?.webhookSecret || webhookSecret,
      });

      setStatusMessage(
        result.board?.name
          ? `Connected to Jira board “${result.board.name}”.`
          : "Connected to Jira."
      );
      await refetchSetup();
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setConnectPending(false);
    }
  }

  async function handleSaveMapping(e) {
    e.preventDefault();
    if (!connected) return;
    setMappingPending(true);
    setStatusMessage("");
    try {
      await saveIntegrationMapping({
        workingColumnName: workingColumn,
        nextColumnName: nextColumn,
      });
      setStatusMessage("Column mapping saved. Webhook will track the working column.");
      await refetchSetup();
      await refetchIssues();
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : "Save failed");
    } finally {
      setMappingPending(false);
    }
  }

  async function handleSync() {
    setSyncPending(true);
    try {
      const result = await syncWorkingColumn();
      setStatusMessage(`Synced ${result.synced} ticket(s) from Jira.`);
      await refetchIssues();
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncPending(false);
    }
  }

  async function handleAdvance(issueKey) {
    setAdvancePendingKey(issueKey);
    try {
      const result = await advanceIssue(issueKey);
      setStatusMessage(
        `${result.issueKey} → ${result.column} (${result.toStatus})`
      );
      await refetchIssues();
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : "Advance failed");
    } finally {
      setAdvancePendingKey(null);
    }
  }

  async function copyText(text, setter) {
    await navigator.clipboard.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 2000);
  }

  if (setupLoading && !setup) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (setupError) {
    return (
      <EmptyState
        title="Cannot reach API"
        body="Set VITE_API_URL on Vercel to your Render URL and redeploy."
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-[82rem] space-y-6">
      <PageIntro
        kicker="Jira intake"
        title={connected ? "Jira connected" : "Connect Jira"}
        body={
          connected
            ? "Webhook URL and secrets are ready. Map columns, sync your working queue, and advance tickets in one click."
            : "Enter your Atlassian details once. We verify the board, generate your webhook URL, and wire the integration."
        }
        right={
          connected ? (
            <LabelPill label="Integrated" tone="success" />
          ) : (
            <Link
              to="/app/jira-search"
              className="rounded-full border border-hairline px-4 py-2 font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink-dim"
            >
              Board search
            </Link>
          )
        }
      />

      <Panel>
        <PanelHeader
          kicker={connected ? "Connected" : "Step 1"}
          title="Jira account"
          body="Values are loaded from the server when already configured (Render env or a previous connect)."
        />
        <div className="space-y-4 p-5 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Base URL"
              value={baseUrl}
              onChange={setBaseUrl}
              placeholder="https://your-domain.atlassian.net"
            />
            <Field
              label="Service email"
              value={email}
              onChange={setEmail}
              placeholder="you@company.com"
            />
            <Field
              label="API token"
              value={apiToken}
              onChange={setApiToken}
              placeholder={
                setup?.jira?.hasApiToken
                  ? `Saved (${setup.jira.tokenHint}) — leave blank to keep`
                  : "Atlassian API token"
              }
              type="password"
            />
            <Field
              label="Board ID"
              value={boardId}
              onChange={setBoardId}
              placeholder="e.g. 123"
            />
          </div>

          {connectError ? (
            <p className="font-mono text-[11px] text-danger">{connectError}</p>
          ) : null}

          {!connected ? (
            <button
              type="button"
              disabled={connectPending || !baseUrl || !email || !boardId}
              onClick={() => void handleConnect()}
              className="w-full rounded-full bg-indigo py-3 font-mono text-[11px] uppercase tracking-[0.18em] text-white disabled:opacity-50 sm:w-auto sm:px-8"
            >
              {connectPending ? "Connecting…" : "Connect Jira"}
            </button>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={connectPending}
                onClick={() => void handleConnect()}
                className="rounded-full border border-hairline px-4 py-2 font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink-dim"
              >
                {connectPending ? "Refreshing…" : "Re-test connection"}
              </button>
              {setup?.jira?.source === "environment" ? (
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute">
                  Credentials from server environment
                </span>
              ) : (
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute">
                  Credentials saved on server
                </span>
              )}
            </div>
          )}
        </div>
      </Panel>

      {connected ? (
        <>
          <Panel>
            <PanelHeader
              kicker="Step 2"
              title="Webhook (auto-configured)"
              body="Copy into Jira → System → Webhooks. Issue updated keeps the working column in sync."
            />
            <div className="space-y-4 p-5 sm:p-6">
              <CopyRow
                label="Webhook URL"
                value={setup?.webhookUrl}
                copied={copiedUrl}
                onCopy={() => void copyText(setup?.webhookUrl, setCopiedUrl)}
              />
              <CopyRow
                label="Optional header x-agentos-secret"
                value={setup?.jira?.webhookSecret || webhookSecret}
                copied={copiedSecret}
                onCopy={() =>
                  void copyText(
                    setup?.jira?.webhookSecret || webhookSecret,
                    setCopiedSecret
                  )
                }
              />
              <p className="text-[13px] text-ink-dim">{setup?.webhookHint}</p>
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              kicker="Step 3"
              title="Board columns"
              body="Pick working vs next column. Statuses under the working column are tracked automatically."
            />
            <form onSubmit={handleSaveMapping} className="space-y-4 p-5 sm:p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <SelectField
                  label="Working column"
                  value={workingColumn}
                  onChange={setWorkingColumn}
                  options={columnOptions}
                />
                <SelectField
                  label="Next column (Advance)"
                  value={nextColumn}
                  onChange={setNextColumn}
                  options={columnOptions}
                />
              </div>
              <button
                type="submit"
                disabled={mappingPending || !workingColumn || !nextColumn}
                className="rounded-full bg-indigo px-5 py-2.5 font-mono text-[10.5px] uppercase tracking-[0.16em] text-white disabled:opacity-50"
              >
                {mappingPending ? "Saving…" : "Save column mapping"}
              </button>
            </form>
          </Panel>

          <Panel>
            <PanelHeader
              kicker="Step 4"
              title="Working queue"
              right={
                <button
                  type="button"
                  onClick={() => void handleSync()}
                  disabled={syncPending}
                  className="rounded-full border border-hairline px-4 py-2 font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink-dim"
                >
                  {syncPending ? "Syncing…" : "Sync from Jira"}
                </button>
              }
            />
            <div className="p-5 sm:p-6">
              {statusMessage ? (
                <p className="mb-4 font-mono text-[11px] text-ink-dim">{statusMessage}</p>
              ) : null}
              {issuesLoading && !items.length ? (
                <div className="flex justify-center py-8">
                  <Spinner />
                </div>
              ) : issuesError ? (
                <EmptyState title="Queue error" body={issuesError.message} />
              ) : !items.length ? (
                <EmptyState
                  title="No tickets yet"
                  body="Move a card into the working column or click Sync from Jira."
                />
              ) : (
                <ul className="space-y-3">
                  {items.map((issue) => (
                    <li
                      key={issue.issueKey}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-[1rem] border border-hairline bg-canvas/40 px-4 py-4"
                    >
                      <div>
                        <p className="font-mono text-[12px] text-indigo">{issue.issueKey}</p>
                        <p className="text-[15px] text-ink">{issue.summary}</p>
                      </div>
                      <button
                        type="button"
                        disabled={advancePendingKey === issue.issueKey}
                        onClick={() => void handleAdvance(issue.issueKey)}
                        className="rounded-full border border-indigo/40 bg-indigo/10 px-4 py-2 font-mono text-[10.5px] uppercase tracking-[0.16em] text-indigo"
                      >
                        {advancePendingKey === issue.issueKey
                          ? "Moving…"
                          : `Advance → ${nextColumn || "next"}`}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Panel>
        </>
      ) : null}
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text" }) {
  return (
    <label className="block">
      <span className="editorial-kicker text-ink-mute">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-2 w-full rounded-[0.85rem] border border-hairline bg-canvas/50 px-4 py-2.5 text-[14px] text-ink outline-none focus:border-indigo/50"
      />
    </label>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span className="editorial-kicker text-ink-mute">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-[0.85rem] border border-hairline bg-canvas/50 px-4 py-2.5 text-[14px] text-ink"
      >
        <option value="">Select…</option>
        {options.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
    </label>
  );
}

function CopyRow({ label, value, copied, onCopy }) {
  return (
    <div>
      <span className="editorial-kicker text-ink-mute">{label}</span>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
        <code className="flex-1 break-all rounded-[0.85rem] border border-hairline bg-canvas/50 px-3 py-2 font-mono text-[11px] text-indigo">
          {value || "—"}
        </code>
        <button
          type="button"
          onClick={onCopy}
          disabled={!value}
          className="shrink-0 rounded-full border border-hairline px-4 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-dim"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
