import { Link } from "react-router-dom";
import { useGitIntegrationSummary } from "../../entities/git-integration";
import LabelPill from "../../app/components/LabelPill";
import Spinner from "../../app/components/Spinner";
import { AGENT_NAMES } from "../../shared/config/app";
import { useOrgPathBuilder } from "../../shared/providers/OrgRouteProvider";
import { Panel, PanelHeader } from "../../shared/ui/Panel";

export default function GitHubIntegrationOverviewWidget({ embedded = false }) {
  const orgPath = useOrgPathBuilder();
  const { data, error, loading } = useGitIntegrationSummary();

  const connected = Boolean(data?.connected);
  const needsRepoSelection = Boolean(data?.needsRepoSelection);
  const installationDetected = Boolean(data?.installationDetected);
  const repoLabel = data?.repoLabel;

  const body = (
      <div className={embedded ? "space-y-4" : "space-y-4 px-5 py-4 sm:px-6"}>
        {loading && !data ? (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        ) : error ? (
          <p className="text-[13px] leading-relaxed text-ink-dim">
            Could not load Git setup. If a repository is not connected yet,{" "}
            <Link
              to={orgPath("integrations", "github")}
              className="text-indigo hover:underline"
            >
              connect GitHub
            </Link>{" "}
            or Bitbucket in Settings.
          </p>
        ) : (
          <>
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-dim">
              {repoLabel
                ? `Repository · ${repoLabel}`
                : needsRepoSelection || installationDetected
                  ? "GitHub App installed: select a repository on the Git page"
                  : data?.githubAppConfigured
                    ? "GitHub App ready: install to pick a repository"
                    : "Not connected · install GitHub App or use PAT"}
            </p>
            {data?.authMethod ? (
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-mute">
                Auth · {data.authMethod === "github_app" ? "GitHub App" : data.authMethod}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-4 text-[13px]">
              <Link
                to={orgPath("integrations", "github")}
                className="text-ink-dim transition-colors hover:text-indigo"
              >
                Open GitHub integration →
              </Link>
              <Link
                to={orgPath("ananta")}
                className="text-ink-dim transition-colors hover:text-indigo"
              >
                {AGENT_NAMES.ANANTA} →
              </Link>
            </div>
          </>
        )}
      </div>
  );

  if (embedded) {
    return (
      <div className="min-w-0 overflow-hidden rounded-app-sm border border-app-border bg-app-surface-muted/60 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-app-ink-mute">
            <img src="/marketing/integrations/github.svg" alt="" className="integration-logo size-5 rounded object-contain p-0.5" />
            GitHub
          </p>
          <LabelPill
            label={
              connected
                ? "Connected"
                : needsRepoSelection || installationDetected
                  ? "Select repo"
                  : "Not connected"
            }
            tone={
              connected ? "success" : needsRepoSelection || installationDetected ? "warning" : "muted"
            }
          />
        </div>
        {body}
      </div>
    );
  }

  return (
    <Panel>
      <PanelHeader
        kicker="GitHub"
        title="Repository connection"
        right={
          <LabelPill
            label={
              connected
                ? "Connected"
                : needsRepoSelection || installationDetected
                  ? "Select repo"
                  : "Not connected"
            }
            tone={
              connected ? "success" : needsRepoSelection || installationDetected ? "warning" : "muted"
            }
          />
        }
      />
      {body}
    </Panel>
  );
}
