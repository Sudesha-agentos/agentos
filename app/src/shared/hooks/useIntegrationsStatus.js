import { useEffect, useMemo, useState } from "react";
import { useGitIntegrationSummary } from "../../entities/git-integration";
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
  return "not_connected";
}

export function useIntegrationsStatus() {
  const org = useOrgOptional();
  const orgSlug = org?.orgSlug ?? "workspace";
  const { data: git, loading: gitLoading } = useGitIntegrationSummary({ pollMs: 12000 });
  const { data: jira, loading: jiraLoading } = usePipelineJiraSetup({ pollMs: 12000 });
  const [logTypes, setLogTypes] = useState(() => new Set());
  const [logsLoading, setLogsLoading] = useState(true);

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

  const live = useMemo(
    () => ({
      githubConnected: Boolean(git?.connected),
      githubNeedsSetup: Boolean(
        !git?.connected && (git?.needsRepoSelection || git?.installationDetected)
      ),
      jiraConnected: Boolean(jira?.connected),
      logConnectedTypes: logTypes,
    }),
    [
      git?.connected,
      git?.needsRepoSelection,
      git?.installationDetected,
      jira?.connected,
      logTypes,
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
    loading: gitLoading || jiraLoading || logsLoading,
  };
}
