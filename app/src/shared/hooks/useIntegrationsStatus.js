import { useEffect, useMemo, useState } from "react";
import { useGitIntegrationSummary } from "../../entities/git-integration";
import { listCustomerDatabases } from "../../entities/customer-db";
import { fetchLogSources } from "../../entities/logIntelligence";
import { usePipelineJiraSetup } from "../../entities/pipeline-jira";
import {
  buildIntegrationsCatalog,
  groupIntegrationsByCategory,
} from "../config/integrationsCatalog";
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
  return "not_connected";
}

export function useIntegrationsStatus() {
  const org = useOrgOptional();
  const orgSlug = org?.orgSlug ?? "workspace";
  const { data: git, loading: gitLoading } = useGitIntegrationSummary({ pollMs: 12000 });
  const { data: jira, loading: jiraLoading } = usePipelineJiraSetup({ pollMs: 12000 });
  const [logTypes, setLogTypes] = useState(() => new Set());
  const [logsLoading, setLogsLoading] = useState(true);
  const [databaseProviders, setDatabaseProviders] = useState(() => new Set());
  const [databasesLoading, setDatabasesLoading] = useState(true);

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
  }, [orgSlug]);

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
  }, [orgSlug]);

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
      logConnectedTypes: logTypes,
      databaseProviders,
    }),
    [
      git?.connected,
      git?.provider,
      git?.authMethod,
      git?.needsRepoSelection,
      git?.installationDetected,
      jira?.connected,
      logTypes,
      databaseProviders,
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
    loading: gitLoading || jiraLoading || logsLoading || databasesLoading,
  };
}
