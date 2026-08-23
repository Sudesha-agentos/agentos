import { useMemo } from "react";
import { usePipelineList } from "../../entities/pipeline";
import { useCostsDaily } from "../../entities/costs";
import { useQaReports } from "../../entities/qa";
import { useOrgPathBuilder } from "../../shared/providers/OrgRouteProvider";
import { useCoreIntegrations } from "../../shared/hooks/useIntegrationsStatus";
import {
  derivePipelineCounts,
  deriveRecentCompletions,
  deriveReviewQueueItems,
} from "../../shared/lib/pipelineCounts";
import { formatCostToday, derivePassRate } from "../../shared/lib/dashboardMetrics";
import {
  useActivityEvents,
  useAgentHealth,
  useWeeklyTrend,
} from "../../entities/workspace";
import DashboardWorkspace from "./DashboardWorkspace";

function buildStatusMetrics(orgPath, counts, costToday = "—", passRate = "—") {
  return [
    {
      id: "running",
      label: "Running",
      value: String(counts.running),
      tone: "running",
      href: `${orgPath("pipelines")}?tab=active`,
    },
    {
      id: "review",
      label: "Needs your review",
      value: String(counts.review),
      tone: "review",
      href: `${orgPath("pipelines")}?tab=review`,
    },
    {
      id: "completed",
      label: "Completed",
      value: String(counts.completedToday),
      tone: "success",
      href: `${orgPath("pipelines")}?tab=history`,
    },
    {
      id: "cost",
      label: "Cost today",
      value: costToday,
      tone: "neutral",
      href: orgPath("costs"),
    },
    {
      id: "pass_rate",
      label: "Pass rate",
      value: passRate,
      tone: "success",
      href: orgPath("qa"),
    },
  ];
}

export default function LandingDashboardWidget() {
  const orgPath = useOrgPathBuilder();
  const {
    loading: integrationsLoading,
    issueTrackingReady,
    gitConnected,
    missing,
  } = useCoreIntegrations();
  const needsSetup = !integrationsLoading && (!issueTrackingReady || !gitConnected);
  const { items: pipelines, loading: pipelinesLoading } = usePipelineList(undefined, {
    pollMs: 10_000,
  });
  const counts = useMemo(() => derivePipelineCounts(pipelines), [pipelines]);
  const reviewItems = useMemo(
    () => deriveReviewQueueItems(pipelines, orgPath),
    [pipelines, orgPath]
  );
  const completions = useMemo(() => deriveRecentCompletions(pipelines), [pipelines]);

  const { data: costsDaily, loading: costsLoading } = useCostsDaily({ pollMs: 30_000 });
  const { data: qaReports, loading: qaLoading } = useQaReports({ pollMs: 30_000 });
  const costToday = useMemo(() => formatCostToday(costsDaily), [costsDaily]);
  const passRate = useMemo(() => derivePassRate(qaReports), [qaReports]);
  const statusMetrics = useMemo(
    () => buildStatusMetrics(orgPath, counts, costToday, passRate),
    [orgPath, counts, costToday, passRate]
  );
  const metricsLoading = pipelinesLoading || costsLoading || qaLoading;

  const { data: eventsData, loading: eventsLoading } = useActivityEvents({ pollMs: 30_000 });
  const { data: trendData, loading: trendLoading } = useWeeklyTrend();
  const { data: healthData, loading: healthLoading } = useAgentHealth({ pollMs: 30_000 });

  return (
    <DashboardWorkspace
      needsSetup={needsSetup}
      missing={missing}
      statusMetrics={statusMetrics}
      metricsLoading={metricsLoading}
      reviewItems={reviewItems}
      completions={completions}
      events={eventsData?.events}
      eventsLoading={eventsLoading}
      pipelinesLoading={pipelinesLoading}
      trendData={trendData}
      trendLoading={trendLoading}
      healthData={healthData}
      healthLoading={healthLoading}
    />
  );
}
