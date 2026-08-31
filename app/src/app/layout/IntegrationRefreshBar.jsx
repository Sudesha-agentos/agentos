import { useState } from "react";
import { runJiraSync } from "../../entities/jira-sync";
import { scanPipelineIntake, usePipelineJiraSetup } from "../../entities/pipeline-jira";
import { refreshGitConnection, useGitIntegrationSummary } from "../../entities/git-integration";
import { notifyIntegrationsChanged } from "../../shared/lib/chromeEvents";

export default function IntegrationRefreshBar() {
  const { data: git } = useGitIntegrationSummary({ pollMs: 0 });
  const { data: jira } = usePipelineJiraSetup({ pollMs: 0 });
  const jiraConnected = Boolean(jira?.connected);
  const gitConnected = Boolean(git?.connected);
  const gitLabel =
    git?.provider === "bitbucket" || git?.authMethod === "oauth" ? "Bitbucket" : "GitHub";

  const [jiraBusy, setJiraBusy] = useState(false);
  const [gitBusy, setGitBusy] = useState(false);
  const [note, setNote] = useState("");

  if (!jiraConnected && !gitConnected) return null;

  async function refreshJira() {
    setJiraBusy(true);
    setNote("");
    try {
      await runJiraSync({ mode: "incremental" });
      await scanPipelineIntake();
      notifyIntegrationsChanged();
      setNote("Jira refreshed");
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Jira refresh failed");
    } finally {
      setJiraBusy(false);
    }
  }

  async function refreshGit() {
    setGitBusy(true);
    setNote("");
    try {
      await refreshGitConnection();
      notifyIntegrationsChanged();
      setNote(`${gitLabel} refreshed`);
    } catch (err) {
      setNote(err instanceof Error ? err.message : `${gitLabel} refresh failed`);
    } finally {
      setGitBusy(false);
    }
  }

  return (
    <div className="flex h-8 items-center gap-2 border-b border-app-border bg-app-canvas px-4 text-[11px] sm:px-6">
      <span className="hidden text-app-ink-mute sm:inline">Refresh sources</span>
      {jiraConnected ? (
        <button
          type="button"
          disabled={jiraBusy}
          onClick={() => void refreshJira()}
          className="rounded-md border border-app-border px-2 py-0.5 text-app-ink-dim transition-colors hover:bg-app-surface-muted hover:text-app-ink disabled:opacity-50"
        >
          {jiraBusy ? "Refreshing Jira…" : "Refresh Jira"}
        </button>
      ) : null}
      {gitConnected ? (
        <button
          type="button"
          disabled={gitBusy}
          onClick={() => void refreshGit()}
          className="rounded-md border border-app-border px-2 py-0.5 text-app-ink-dim transition-colors hover:bg-app-surface-muted hover:text-app-ink disabled:opacity-50"
        >
          {gitBusy ? `Refreshing ${gitLabel}…` : `Refresh ${gitLabel}`}
        </button>
      ) : null}
      {note ? <span className="min-w-0 truncate text-app-ink-mute">{note}</span> : null}
    </div>
  );
}
