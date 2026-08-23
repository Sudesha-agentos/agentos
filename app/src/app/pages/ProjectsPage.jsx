import { Link } from "react-router-dom";
import { useMemo, useState } from "react";
import { usePipelineList } from "../../entities/pipeline";
import { usePmAnalyses } from "../../entities/pm-agents";
import { mapPmAnalysisToPipelineSummary, mergePipelineExplorerItems } from "../../widgets/pm-analysis/pipelineIds";
import { useOrgPathBuilder } from "../../shared/providers/OrgRouteProvider";
import { formatRelativeTime } from "../../shared/lib/format";
import StatusPill from "../components/StatusPill";
import { AnimatedAppPage } from "../../shared/ui/AnimatedAppPage";
import Spinner from "../components/Spinner";

export default function ProjectsPage() {
  const orgPath = useOrgPathBuilder();
  const [query, setQuery] = useState("");
  const { items: pipelines, loading: pipelinesLoading } = usePipelineList(undefined, {
    pollMs: 15_000,
  });
  const { data: pmList, loading: pmLoading } = usePmAnalyses({ pollMs: 8000 });

  const items = useMemo(() => {
    const pm = (pmList?.items ?? []).map(mapPmAnalysisToPipelineSummary);
    const classic = (pipelines ?? []).map((p) => ({ ...p, kind: "pipeline" }));
    return mergePipelineExplorerItems(pm, classic, []).sort(
      (a, b) =>
        new Date(b.updatedAt ?? b.startedAt ?? b.completedAt ?? 0) -
        new Date(a.updatedAt ?? a.startedAt ?? a.completedAt ?? 0)
    );
  }, [pmList, pipelines]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.jiraKey?.toLowerCase().includes(q) ||
        item.summary?.toLowerCase().includes(q)
    );
  }, [items, query]);

  const loading = (pipelinesLoading || pmLoading) && items.length === 0;

  return (
    <AnimatedAppPage className="max-w-[72rem]">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[12px] font-medium uppercase tracking-[0.16em] text-app-ink-mute">
            Insights
          </p>
          <h1 className="mt-2 text-[2rem] font-light tracking-tight text-app-ink">All projects</h1>
          <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-app-ink-dim">
            Every pipeline and Virin session in this workspace.
          </p>
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search projects"
          className="h-11 w-full rounded-full border border-app-border bg-app-surface px-4 text-[14px] text-app-ink outline-none placeholder:text-app-ink-mute sm:w-72"
        />
      </header>

      {loading ? (
        <div className="flex justify-center py-20">
          <Spinner />
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-app-border bg-app-surface px-6 py-16 text-center">
          <p className="text-[16px] font-medium text-app-ink">No projects yet</p>
          <p className="mt-2 text-[14px] text-app-ink-dim">
            Start a ticket with Virin or run a pipeline to see it here.
          </p>
        </div>
      ) : (
        <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((item) => (
            <Link
              key={item.id}
              to={
                item.kind === "pm" && item.jiraKey
                  ? `${orgPath("pm-agents")}?ticket=${encodeURIComponent(item.jiraKey)}`
                  : orgPath("pipelines", item.id)
              }
              className="rounded-2xl border border-app-border bg-app-surface p-5 transition hover:bg-app-surface-muted/40"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="font-mono text-[12px] text-app-ink-dim">{item.jiraKey || "Project"}</p>
                <StatusPill status={item.status} />
              </div>
              <h2 className="mt-3 text-[16px] font-medium leading-snug text-app-ink">
                {item.summary || item.jiraKey || "Untitled project"}
              </h2>
              <p className="mt-3 text-[12px] text-app-ink-mute">
                {item.updatedAt || item.completedAt || item.startedAt
                  ? formatRelativeTime(item.updatedAt || item.completedAt || item.startedAt)
                  : "Just now"}
              </p>
            </Link>
          ))}
        </div>
      )}
    </AnimatedAppPage>
  );
}
