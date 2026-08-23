import { useMemo, useState } from "react";
import { useWorkspaceBilling } from "../../../entities/billing";
import { usePipelineList } from "../../../entities/pipeline";
import { useSettings } from "../../../entities/settings";
import { useAuth } from "../../../shared/providers/useAuth";
import { AGENT_NAMES } from "../../../shared/config/app";
import { PILOT_PLAN } from "../../../shared/config/billingPlans";
import { getAgentModelForSurface } from "../../../shared/config/agentModels";
import { SettingsPageHeader } from "../../layout/SettingsLayout";

const SURFACE_FILTERS = [
  { id: "all", label: "All Surfaces" },
  { id: "Added", label: "Added" },
  { id: AGENT_NAMES.VIRIN, label: AGENT_NAMES.VIRIN },
  { id: AGENT_NAMES.ANANTA, label: AGENT_NAMES.ANANTA },
  { id: AGENT_NAMES.NEEL, label: AGENT_NAMES.NEEL },
];

const RANGE_FILTERS = [
  { id: "today", label: "Today" },
  { id: "7d", label: "7 days" },
  { id: "month", label: "Month" },
  { id: "all", label: "All" },
];

function surfaceFromStage(stage) {
  const value = String(stage || "");
  if (value.includes("QA")) return AGENT_NAMES.NEEL;
  if (value.includes("IMPLEMENT") || value.includes("ENGINEER")) return AGENT_NAMES.ANANTA;
  return AGENT_NAMES.VIRIN;
}

function inRange(iso, range) {
  if (!iso || range === "all") return true;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return true;
  const now = new Date();
  if (range === "today") return date.toDateString() === now.toDateString();
  if (range === "7d") return now.getTime() - date.getTime() <= 7 * 24 * 60 * 60 * 1000;
  if (range === "month") {
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  }
  return true;
}

function formatActivityDate(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatCredits(value) {
  const abs = Math.abs(value).toFixed(2);
  return value > 0 ? `+${abs}` : value < 0 ? `-${abs}` : abs;
}

export default function SettingsUsagePage() {
  const { organization, session } = useAuth();
  const { data: billing } = useWorkspaceBilling();
  const { data: settings } = useSettings();
  const { items: pipelines } = usePipelineList(undefined, { pollMs: 60_000 });
  const [surface, setSurface] = useState("all");
  const [range, setRange] = useState("all");

  const workspace = organization?.name?.trim() || organization?.slug || "Personal";
  const cap = billing?.runsCap ?? PILOT_PLAN.pipelineRunsCap;
  const used = billing?.runsUsed ?? 0;

  const activity = useMemo(() => {
    const welcomeAt = session?.issuedAt ?? new Date().toISOString();
    const rows = [
      {
        id: "welcome",
        at: welcomeAt,
        action: "Welcome credits",
        detail: "Pilot plan credits on signup",
        surface: "Added",
        credits: cap,
        model: "—",
      },
      ...(pipelines ?? []).map((pipeline) => {
        const surface = surfaceFromStage(pipeline.currentStage);
        const model = getAgentModelForSurface(settings, surface);
        return {
          id: pipeline.id,
          at: pipeline.completedAt ?? pipeline.startedAt,
          action: pipeline.summary || pipeline.jiraKey || "Pipeline run",
          detail: pipeline.jiraKey && pipeline.summary ? pipeline.jiraKey : "Pipeline run",
          surface,
          credits: model ? -model.creditsPerRun : -1,
          model: model?.label ?? "—",
        };
      }),
    ];
    return rows.sort((a, b) => new Date(b.at) - new Date(a.at));
  }, [cap, pipelines, session?.issuedAt, settings]);

  const visible = activity.filter((row) => {
    if (!inRange(row.at, range)) return false;
    if (surface === "all") return true;
    return row.surface === surface;
  });

  const surfaceCounts = activity.reduce((acc, row) => {
    if (row.surface === "Added") return acc;
    acc[row.surface] = (acc[row.surface] ?? 0) + 1;
    return acc;
  }, {});
  const mostUsed =
    Object.entries(surfaceCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";

  const metrics = [
    { label: "Credits used this month", value: String(used) },
    { label: "Credits added this month", value: `+${cap}` },
    { label: "Total AI requests", value: String(pipelines?.length ?? 0) },
    { label: "Most used surface", value: mostUsed },
  ];

  return (
    <div>
      <SettingsPageHeader
        title="Usage History"
        description={`Your AI generation history and credit usage across all AgentOX surfaces in the ${workspace} workspace.`}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="app-card rounded-2xl px-5 py-4"
          >
            <p className="text-[12px] text-app-ink-mute">{metric.label}</p>
            <p className="mt-2 text-[22px] font-semibold tracking-tight text-app-ink">
              {metric.value}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1">
          {SURFACE_FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSurface(item.id)}
              className={`rounded-lg px-3 py-1.5 text-[12px] font-medium transition ${
                surface === item.id
                  ? "bg-app-surface-muted text-app-ink"
                  : "text-app-ink-dim hover:bg-app-surface-muted/60 hover:text-app-ink"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="inline-flex self-start rounded-lg bg-app-surface-muted p-0.5">
          {RANGE_FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setRange(item.id)}
              className={`rounded-md px-2.5 py-1 text-[12px] font-medium transition ${
                range === item.id
                  ? "bg-app-surface text-app-ink shadow-sm"
                  : "text-app-ink-dim hover:text-app-ink"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="app-card mt-5 overflow-hidden rounded-2xl">
        <div className="px-5 py-4">
          <h2 className="text-[15px] font-semibold text-app-ink">Credit Activity</h2>
          <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-app-ink-dim">
            Every credit in and out — deductions follow the model selected for Product, Tech, and
            QA (ChatGPT 1, Grok 2, Claude 3), plus credits added by a plan renewal or the AgentOX
            team.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left">
            <thead>
              <tr className="text-[10px] font-semibold uppercase tracking-[0.12em] text-app-ink-mute">
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Action</th>
                <th className="px-5 py-3">Surface</th>
                <th className="px-5 py-3">Credits</th>
                <th className="px-5 py-3">Model</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-[13px] text-app-ink-mute">
                    No credit activity in this range.
                  </td>
                </tr>
              ) : (
                visible.map((row) => (
                  <tr key={row.id} className="last:border-b-0">
                    <td className="whitespace-nowrap px-5 py-3.5 text-[13px] text-app-ink-dim">
                      {formatActivityDate(row.at)}
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="text-[13px] font-medium text-app-ink">{row.action}</p>
                      <p className="text-[12px] text-app-ink-mute">{row.detail}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-medium ${
                          row.surface === "Added"
                            ? "bg-success/15 text-success"
                            : "bg-app-surface-muted text-app-ink-dim"
                        }`}
                      >
                        {row.surface}
                      </span>
                    </td>
                    <td
                      className={`px-5 py-3.5 text-[13px] font-medium ${
                        row.credits > 0 ? "text-success" : "text-app-ink"
                      }`}
                    >
                      {formatCredits(row.credits)}
                    </td>
                    <td className="px-5 py-3.5 text-[13px] text-app-ink-mute">{row.model}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
