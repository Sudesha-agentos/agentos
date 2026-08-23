import { useEffect, useMemo, useState } from "react";
import { useGitIntegrationSummary } from "../../entities/git-integration";
import { listCustomerDatabases } from "../../entities/customer-db";
import { fetchLogSources } from "../../entities/logIntelligence";
import { listWorkspaceConnections } from "../../entities/workspace-connections";
import { usePipelineJiraSetup } from "../../entities/pipeline-jira";
import { useWorkBoardStatus } from "../../entities/work-board";
import {
  buildIntegrationsCatalog,
  groupIntegrationsByCategory,
} from "../config/integrationsCatalog";
import { INTEGRATIONS_CHANGED } from "../lib/chromeEvents";
import { useOrgOptional } from "../providers/OrgRouteProvider";

function resolveDisplayStatus(integration, live) {
  if (integration.catalogStatus === "coming_soon") {
    return "coming_soon";
  }
  if (integration.liveStatusKey === "github") {
    if (live.githubConnected) return "connected";
    if (live.githubNeedsSetup) return "setup_incomplete";
    return "not_connected";
  }
  if (integration.liveStatusKey === "bitbucket") {
    if (live.bitbucketConnected) return "connected";
    if (live.bitbucketNeedsSetup) return "setup_incomplete";
    return "not_connected";
  }
  if (integration.liveStatusKey === "jira") {
    return live.jiraConnected ? "connected" : "not_connected";
  }
  if (integration.liveStatusKey === "spreadsheet") {
    return live.workBoardReady ? "connected" : "not_connected";
  }
  if (
    typeof integration.liveStatusKey === "string" &&
    integration.liveStatusKey.startsWith("log:")
  ) {
    const sourceType = integration.liveStatusKey.slice(4);
    return live.logConnectedTypes?.has(sourceType) ? "connected" : "not_connected";
  }
  if (
    typeof integration.liveStatusKey === "string" &&
    integration.liveStatusKey.startsWith("database:")
  ) {
    const provider = integration.liveStatusKey.slice("database:".length);
    return live.databaseProviders?.has(provider) ? "connected" : "not_connected";
  }
  if (
    typeof integration.liveStatusKey === "string" &&
    integration.liveStatusKey.startsWith("workspace:")
  ) {
    const provider = integration.liveStatusKey.slice("workspace:".length);
    return live.workspaceProviders?.has(provider) ? "connected" : "not_connected";
  }
  return "not_connected";
}

/** Jira + Git only — use this to gate agent/pipeline pages without waiting on logs/DBs. */
export function useCoreIntegrations() {
  const { data: git, loading: gitLoading, error: gitError } = useGitIntegrationSummary({
    pollMs: 12000,
  });
  const { data: jira, loading: jiraLoading, error: jiraError } = usePipelineJiraSetup({
    pollMs: 12000,
  });
  const { data: boardStatus, loading: boardLoading } = useWorkBoardStatus({ pollMs: 12000 });

  const jiraConnected = Boolean(jira?.connected);
  const workBoardReady = Boolean(boardStatus?.ready);
  const issueTrackingReady = jiraConnected || workBoardReady;
  const gitConnected = Boolean(git?.connected);
  const githubConnected = Boolean(git?.connected && git?.provider !== "bitbucket");
  const bitbucketConnected = Boolean(
    git?.connected && (git?.provider === "bitbucket" || git?.authMethod === "oauth")
  );
  const gitNeedsSetup = Boolean(
    !git?.connected && (git?.needsRepoSelection || git?.installationDetected)
  );
  const intakeReady = Boolean(jiraConnected && jira?.intake?.aiWorkerColumnName);

  const missing = [];
  if (!issueTrackingReady) missing.push("jira");
  if (!gitConnected) {
    missing.push(git?.provider === "bitbucket" || git?.authMethod === "oauth" ? "bitbucket" : "github");
  }

  return {
    loading: gitLoading || jiraLoading || boardLoading,
    jiraConnected,
    workBoardReady,
    issueTrackingReady,
    gitConnected,
    githubConnected,
    bitbucketConnected,
    gitNeedsSetup,
    intakeReady,
    gitProvider: git?.provider ?? null,
    gitAuthMethod: git?.authMethod ?? null,
    missing,
    git,
    jira,
    gitError,
    jiraError,
  };
}

export function useIntegrationsStatus() {
  const org = useOrgOptional();
  const orgSlug = org?.orgSlug ?? "workspace";
  const { data: git, loading: gitLoading } = useGitIntegrationSummary({ pollMs: 12000 });
  const { data: jira, loading: jiraLoading } = usePipelineJiraSetup({ pollMs: 12000 });
  const { data: boardStatus, loading: boardLoading } = useWorkBoardStatus({ pollMs: 12000 });
  const [logTypes, setLogTypes] = useState(() => new Set());
  const [logsLoading, setLogsLoading] = useState(true);
  const [databaseProviders, setDatabaseProviders] = useState(() => new Set());
  const [databasesLoading, setDatabasesLoading] = useState(true);
  const [workspaceProviders, setWorkspaceProviders] = useState(() => new Set());
  const [workspaceLoading, setWorkspaceLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    function onChanged() {
      setRefreshTick((n) => n + 1);
    }
    window.addEventListener(INTEGRATIONS_CHANGED, onChanged);
    return () => window.removeEventListener(INTEGRATIONS_CHANGED, onChanged);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLogsLoading(true);
      try {
        const res = await fetchLogSources();
        const list = Array.isArray(res) ? res : res?.sources ?? res?.items ?? [];
        const types = new Set(
          list
            .map((s) => s.sourceType || s.type)
            .filter(Boolean)
            .map((t) => String(t).toLowerCase())
        );
        // grafana alias
        if (types.has("loki")) types.add("grafana_loki");
        if (!cancelled) setLogTypes(types);
      } catch {
        if (!cancelled) setLogTypes(new Set());
      } finally {
        if (!cancelled) setLogsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orgSlug, refreshTick]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setDatabasesLoading(true);
      try {
        const res = await listCustomerDatabases();
        const list = Array.isArray(res) ? res : res?.databases ?? [];
        const providers = new Set(
          list
            .map((db) => db.provider)
            .filter(Boolean)
            .map((t) => String(t).toLowerCase())
        );
        if (!cancelled) setDatabaseProviders(providers);
      } catch {
        if (!cancelled) setDatabaseProviders(new Set());
      } finally {
        if (!cancelled) setDatabasesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orgSlug, refreshTick]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setWorkspaceLoading(true);
      try {
        const res = await listWorkspaceConnections();
        const list = Array.isArray(res) ? res : res?.connections ?? [];
        const providers = new Set(
          list
            .map((item) => item.provider)
            .filter(Boolean)
            .map((value) => String(value).toLowerCase())
        );
        if (!cancelled) setWorkspaceProviders(providers);
      } catch {
        if (!cancelled) setWorkspaceProviders(new Set());
      } finally {
        if (!cancelled) setWorkspaceLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orgSlug, refreshTick]);

  const live = useMemo(
    () => ({
      githubConnected: Boolean(git?.connected && git?.provider !== "bitbucket"),
      githubNeedsSetup: Boolean(
        !git?.connected &&
          git?.provider !== "bitbucket" &&
          (git?.needsRepoSelection || git?.installationDetected)
      ),
      bitbucketConnected: Boolean(
        git?.connected && (git?.provider === "bitbucket" || git?.authMethod === "oauth")
      ),
      bitbucketNeedsSetup: Boolean(
        !git?.connected &&
          (git?.provider === "bitbucket" || git?.authMethod === "oauth") &&
          git?.needsRepoSelection
      ),
      jiraConnected: Boolean(jira?.connected),
      workBoardReady: Boolean(boardStatus?.ready),
      logConnectedTypes: logTypes,
      databaseProviders,
      workspaceProviders,
    }),
    [
      git?.connected,
      git?.provider,
      git?.authMethod,
      git?.needsRepoSelection,
      git?.installationDetected,
      jira?.connected,
      boardStatus?.ready,
      logTypes,
      databaseProviders,
      workspaceProviders,
    ]
  );

  const integrations = useMemo(
    () =>
      buildIntegrationsCatalog(orgSlug).map((item) => ({
        ...item,
        displayStatus: resolveDisplayStatus(item, live),
      })),
    [live, orgSlug]
  );

  const grouped = useMemo(() => groupIntegrationsByCategory(integrations), [integrations]);

  return {
    integrations,
    grouped,
    loading: gitLoading || jiraLoading || boardLoading || logsLoading || databasesLoading || workspaceLoading,
  };
}
