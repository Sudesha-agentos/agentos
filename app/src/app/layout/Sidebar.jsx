import { NavLink, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { LogoMark } from "../../components/Logo";
import { usePipelineList } from "../../entities/pipeline";
import { derivePipelineCounts } from "../../shared/lib/pipelineCounts";
import { useSidebarCollapsed } from "../../shared/hooks/useSidebarCollapsed";
import { useNavExpanded } from "../../shared/hooks/useNavExpanded";
import { useOrgNavigation } from "../../shared/routing/useOrgNavigation";
import { useCodebaseCommandPalette } from "../../widgets/codebase-search/useCodebaseCommandPalette";
import { openCreateNew } from "../../shared/lib/chromeEvents";
import { useStoredChats } from "../../entities/chats";
import { PRODUCT_TOUR_START_EVENT } from "../../features/product-tour/productTourStorage";
import { useAuth } from "../../shared/providers/useAuth";
import SidebarUserCard from "./SidebarUserCard";

function navItemClass(active, collapsed, { isGroupHeader = false, childActive = false } = {}) {
  const showActiveBg = Boolean(active && (collapsed || !isGroupHeader || !childActive));
  return [
    "group flex w-full items-center text-[13px] font-medium transition-colors duration-150",
    collapsed ? "justify-center rounded-lg px-2 py-1.5" : "gap-2 rounded-lg px-2.5 py-1.5",
    showActiveBg
      ? "bg-app-surface-muted text-app-ink"
      : active && isGroupHeader && childActive
        ? "text-app-ink"
        : "text-app-ink-dim hover:bg-app-surface-muted/60 hover:text-app-ink",
  ].join(" ");
}

function subNavItemClass(active) {
  return [
    "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition-colors",
    active
      ? "bg-app-surface-muted text-app-ink"
      : "text-app-ink-dim hover:bg-app-surface-muted/60 hover:text-app-ink",
  ].join(" ");
}

function sectionLabelClass(collapsed) {
  return collapsed ? "sr-only" : "mb-1 px-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-app-ink-mute";
}

const NAV_ICONS = {
  dashboard: IconDashboard,
  board: IconBoard,
  pipelines: IconPipeline,
  virin: IconProduct,
  ananta: IconCodebase,
  neel: IconQa,
  roadmap: IconRoadmap,
  logs: IconAudit,
  audit: IconAudit,
  settings: IconSettings,
  integrations: IconIntegrations,
};

export default function Sidebar() {
  const { orgPath, sections, pipelineSubNav, agentNav, pathMatches } = useOrgNavigation();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const pipelineTab = pathMatches("pipelines")
    ? (searchParams.get("tab") ?? "active")
    : "active";
  const navigate = useNavigate();
  const { organization } = useAuth();
  const { openPalette } = useCodebaseCommandPalette();
  const workspaceLabel = organization?.name?.trim() || organization?.slug || "Workspace";
  const { collapsed, toggleCollapsed } = useSidebarCollapsed();
  const { isExpanded, toggle } = useNavExpanded(location.pathname);
  const { items: pipelines } = usePipelineList(undefined, { pollMs: 60_000 });
  const counts = derivePipelineCounts(pipelines);
  const recentWork = [...(pipelines ?? [])]
    .sort(
      (a, b) =>
        new Date(b.updatedAt ?? b.startedAt ?? b.completedAt ?? 0) -
        new Date(a.updatedAt ?? a.startedAt ?? a.completedAt ?? 0)
    )
    .slice(0, 8);
  const chats = useStoredChats();
  const activeChatId = searchParams.get("chat");

  function handleNew() {
    if (location.pathname !== orgPath()) {
      navigate(`${orgPath()}?new=1`);
    }
    window.setTimeout(() => openCreateNew(), 80);
  }

  function agentIsActive(agent) {
    if (agent.id === "virin") {
      return pathMatches("pm-agents") || pathMatches("roadmap");
    }
    if (agent.id === "ananta") {
      return pathMatches("ananta");
    }
    if (agent.id === "neel") {
      return pathMatches("qa");
    }
    return false;
  }

  function subIsActive(sub) {
    return location.pathname + location.search === sub.to;
  }

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-30 hidden flex-col bg-app-surface transition-[width,padding] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] md:flex ${
        collapsed ? "w-14 px-1.5" : "w-[17rem] px-3"
      }`}
    >
      <div
        className={`flex shrink-0 items-center py-3 ${
          collapsed ? "flex-col gap-2" : "justify-between gap-2 px-1"
        }`}
      >
        {collapsed ? (
          <NavLink to={orgPath()} aria-label="AgentOX home" className="inline-flex">
            <LogoMark size={24} />
          </NavLink>
        ) : (
          <NavLink
            to={orgPath()}
            className="flex min-w-0 items-center gap-2 rounded-lg px-1 py-0.5 hover:bg-app-surface-muted/50"
          >
            <LogoMark size={22} />
            <span className="min-w-0">
              <span className="flex items-center gap-1.5">
                <span className="truncate text-[13px] font-semibold text-app-ink">
                  {workspaceLabel}
                </span>
                <span className="rounded-md border border-app-border px-1.5 py-px text-[10px] font-medium text-app-ink-mute">
                  Free
                </span>
              </span>
            </span>
          </NavLink>
        )}
        <button
          type="button"
          onClick={toggleCollapsed}
          className="flex size-8 shrink-0 items-center justify-center rounded-lg text-app-ink-dim transition hover:bg-app-surface-muted hover:text-app-ink"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
        >
          <IconChevron collapsed={collapsed} />
        </button>
      </div>

      <div className={`flex shrink-0 items-center gap-1.5 pb-3 ${collapsed ? "flex-col" : "px-0.5"}`}>
        <button
          type="button"
          onClick={handleNew}
          className={
            collapsed
              ? "flex size-9 items-center justify-center rounded-xl bg-app-ink text-app-canvas"
              : "flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-app-ink text-[13px] font-semibold text-app-canvas"
          }
          title={collapsed ? "Create New" : undefined}
        >
          <IconPlus />
          {!collapsed ? <span>Create New</span> : null}
        </button>
        <button
          type="button"
          onClick={openPalette}
          className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-app-border text-app-ink-dim transition hover:bg-app-surface-muted hover:text-app-ink"
          aria-label="Search"
          title="Search (⌘K)"
        >
          <IconSearch />
        </button>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-0.5 py-1">
        {sections.map((section, sectionIndex) => (
          <div key={section.id} className={sectionIndex > 0 ? "mt-4" : ""}>
            {section.id !== "workspace" ? (
              <p className={sectionLabelClass(collapsed)}>
                {section.id === "analytics" ? "Insights" : section.label}
              </p>
            ) : null}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                if ("end" in item && item.end) {
                  const Icon = NAV_ICONS.dashboard ?? IconDashboard;
                  return (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        end
                        data-tour="dashboard"
                        title={collapsed ? item.label : undefined}
                        className={({ isActive }) =>
                          navItemClass(isActive, collapsed)
                        }
                      >
                        <span className="flex size-5 shrink-0 items-center justify-center text-app-ink-mute group-hover:text-app-ink">
                          <Icon />
                        </span>
                        {!collapsed ? <span className="min-w-0 truncate">{item.label}</span> : null}
                      </NavLink>
                    </li>
                  );
                }
                if (item.navId === "board") {
                  return (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        data-tour="board"
                        title={collapsed ? item.label : undefined}
                        className={({ isActive }) =>
                          navItemClass(isActive || pathMatches("board"), collapsed)
                        }
                      >
                        <span className="flex size-5 shrink-0 items-center justify-center text-app-ink-mute group-hover:text-app-ink">
                          <IconBoard />
                        </span>
                        {!collapsed ? <span className="min-w-0 truncate">{item.label}</span> : null}
                      </NavLink>
                    </li>
                  );
                }
                if (item.navId === "integrations") {
                  const integrationsActive =
                    location.pathname.includes("/integrations") &&
                    !location.pathname.includes("/settings/");
                  return (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        data-tour="integrations"
                        title={collapsed ? item.label : undefined}
                        className={() => navItemClass(integrationsActive, collapsed)}
                      >
                        <span className="flex size-5 shrink-0 items-center justify-center text-app-ink-mute group-hover:text-app-ink">
                          <IconIntegrations />
                        </span>
                        {!collapsed ? <span className="min-w-0 truncate">{item.label}</span> : null}
                      </NavLink>
                    </li>
                  );
                }
                return null;
              })}

              {"pipelineGroup" in section && section.pipelineGroup ? (
                <>
                  <li>
                    {collapsed ? (
                      <NavLink
                        to={orgPath("pipelines")}
                        data-tour="pipelines"
                        title="Pipelines"
                        className={({ isActive }) =>
                          navItemClass(
                            isActive || pathMatches("pipelines"),
                            true
                          )
                        }
                      >
                        <span className="relative flex size-5 items-center justify-center">
                          <IconPipeline />
                          {counts.review > 0 ? (
                            <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-danger ring-2 ring-app-surface" />
                          ) : null}
                        </span>
                      </NavLink>
                    ) : (
                    <button
                      type="button"
                      onClick={() => !collapsed && toggle("pipelines")}
                      data-tour="pipelines"
                      title={collapsed ? "Pipelines" : undefined}
                      className={navItemClass(
                        pathMatches("pipelines"),
                        collapsed,
                        {
                          isGroupHeader: true,
                          childActive:
                            !collapsed &&
                            isExpanded("pipelines") &&
                            pathMatches("pipelines"),
                        }
                      )}
                    >
                      <span className="relative flex size-5 shrink-0 items-center justify-center text-app-ink-mute group-hover:text-app-ink">
                        <IconPipeline />
                        {collapsed && counts.review > 0 ? (
                          <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-danger ring-2 ring-app-surface" />
                        ) : null}
                      </span>
                      {!collapsed ? (
                        <>
                          <span className="min-w-0 flex-1 truncate text-left">Pipelines</span>
                          <IconExpandChevron open={isExpanded("pipelines")} />
                          {counts.review > 0 ? (
                            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-danger text-[10px] font-semibold text-white">
                              {counts.review > 9 ? "9+" : counts.review}
                            </span>
                          ) : null}
                        </>
                      ) : null}
                    </button>
                    )}
                  </li>
                  {!collapsed && isExpanded("pipelines") ? (
                    <ul className="mt-0.5 space-y-0.5">
                      {pipelineSubNav.map((sub) => {
                        const count =
                          sub.badgeKey === "active"
                            ? counts.active
                            : sub.badgeKey === "review"
                              ? counts.review
                              : 0;
                        const isReview = sub.badgeKey === "review";
                        const active = pathMatches("pipelines") && pipelineTab === sub.tab;
                        return (
                          <li key={sub.tab}>
                            <NavLink to={sub.to} className={subNavItemClass(active)}>
                              <span className="flex size-5 shrink-0 items-center justify-center" aria-hidden>
                                <span className="size-1 rounded-full bg-current opacity-40" />
                              </span>
                              <span className="min-w-0 flex-1 truncate">{sub.label}</span>
                              {count > 0 && sub.badgeKey ? (
                                <span
                                  className={`flex min-w-[1.1rem] shrink-0 items-center justify-center rounded-full px-1 py-0.5 text-[9px] font-semibold ${
                                    isReview
                                      ? "bg-danger text-white"
                                      : "bg-app-surface-muted text-app-ink-dim"
                                  }`}
                                >
                                  {count > 9 ? "9+" : count}
                                </span>
                              ) : null}
                            </NavLink>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </>
              ) : null}

              {"agentGroup" in section && section.agentGroup
                ? agentNav.map((agent) => {
                    const Icon = NAV_ICONS[agent.id] ?? IconProduct;
                    const active = agentIsActive(agent);
                    const expanded = isExpanded(agent.id);
                    const hasSub = agent.subNav.length > 1;
                    const showSub = !collapsed && expanded && hasSub;

                    if (!hasSub) {
                      return (
                        <li key={agent.id}>
                          <NavLink
                            to={agent.to}
                            data-tour={agent.id}
                            title={collapsed ? agent.label : undefined}
                            className={({ isActive }) =>
                              navItemClass(isActive || active, collapsed)
                            }
                          >
                            <span className="flex size-5 shrink-0 items-center justify-center text-app-ink-mute group-hover:text-app-ink">
                              <Icon />
                            </span>
                            {!collapsed ? (
                              <span className="min-w-0 truncate">{agent.label}</span>
                            ) : null}
                          </NavLink>
                        </li>
                      );
                    }

                    return (
                      <li key={agent.id}>
                        <button
                          type="button"
                          onClick={() => !collapsed && toggle(agent.id)}
                          data-tour={agent.id}
                          title={collapsed ? agent.label : undefined}
                          className={navItemClass(active, collapsed, {
                            isGroupHeader: true,
                            childActive:
                              !collapsed &&
                              showSub &&
                              agent.subNav.some((sub) => subIsActive(sub, agent.id)),
                          })}
                        >
                          <span className="flex size-5 shrink-0 items-center justify-center text-app-ink-mute group-hover:text-app-ink">
                            <Icon />
                          </span>
                          {!collapsed ? (
                            <>
                              <span className="min-w-0 flex-1 truncate text-left">{agent.label}</span>
                              <IconExpandChevron open={expanded} />
                            </>
                          ) : null}
                        </button>
                        {showSub ? (
                          <ul className="mt-0.5 space-y-0.5">
                            {agent.subNav.map((sub) => {
                              const subActive = subIsActive(sub, agent.id);
                              return (
                                <li key={sub.to}>
                                  <NavLink
                                    to={sub.to}
                                    data-tour={
                                      String(sub.to).includes("/codebase") ? "codebase" : undefined
                                    }
                                    className={subNavItemClass(subActive)}
                                  >
                                    <span
                                      className="flex size-5 shrink-0 items-center justify-center"
                                      aria-hidden
                                    >
                                      <span className="size-1 rounded-full bg-current opacity-40" />
                                    </span>
                                    <span className="min-w-0 flex-1 truncate">{sub.label}</span>
                                  </NavLink>
                                </li>
                              );
                            })}
                          </ul>
                        ) : null}
                      </li>
                    );
                  })
                : null}

              {!("pipelineGroup" in section) &&
              !("agentGroup" in section) &&
              !section.items.every((i) => "end" in i)
                ? null
                : null}

              {section.id !== "workspace" && section.id !== "agents"
                ? section.items.map((item) => {
                    const iconKey = String(item.breadcrumb ?? item.label ?? "")
                      .toLowerCase()
                      .includes("log")
                      ? "logs"
                      : String(item.to).includes("/projects")
                        ? "pipelines"
                      : String(item.to).includes("/audit")
                          ? "audit"
                          : String(item.to).includes("/integrations")
                        ? "integrations"
                        : String(item.to).includes("/settings")
                            ? "settings"
                            : item.to;
                    const Icon = NAV_ICONS[iconKey] ?? IconSettings;
                    return (
                      <li key={item.to}>
                        <NavLink
                          to={item.to}
                          data-tour={NAV_ICONS[iconKey] ? iconKey : undefined}
                          title={collapsed ? item.label : undefined}
                          className={({ isActive }) => navItemClass(isActive, collapsed)}
                        >
                          <span className="flex size-5 shrink-0 items-center justify-center text-app-ink-mute group-hover:text-app-ink">
                            <Icon />
                          </span>
                          {!collapsed ? (
                            <span className="min-w-0 truncate">{item.label}</span>
                          ) : null}
                        </NavLink>
                      </li>
                    );
                  })
                : null}
            </ul>
          </div>
        ))}
        {!collapsed && chats.length > 0 ? (
          <div className="mt-5">
            <p className={sectionLabelClass(false)}>Chats</p>
            <ul className="space-y-0.5">
              {chats.slice(0, 12).map((chat) => {
                const to = `${orgPath()}?chat=${encodeURIComponent(chat.id)}`;
                const active = location.pathname === orgPath() && activeChatId === chat.id;
                return (
                  <li key={chat.id}>
                    <NavLink to={to} className={subNavItemClass(active)} title={chat.title}>
                      <span className="flex size-5 shrink-0 items-center justify-center" aria-hidden>
                        <IconChat />
                      </span>
                      <span className="min-w-0 flex-1 truncate">{chat.title || "Chat"}</span>
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
        {!collapsed && recentWork.length > 0 ? (
          <div className="mt-5">
            <p className={sectionLabelClass(false)}>Projects</p>
            <ul className="space-y-0.5">
              {recentWork.map((item) => {
                const to = orgPath("pipelines", item.id);
                const active = location.pathname.startsWith(to);
                const needsReview = ["PAUSED", "AWAITING_HUMAN"].includes(item.status);
                return (
                  <li key={item.id}>
                    <NavLink to={to} className={subNavItemClass(active)} title={item.summary}>
                      <span className="flex size-5 shrink-0 items-center justify-center" aria-hidden>
                        <span
                          className={`size-1.5 rounded-full ${
                            needsReview ? "bg-warning" : "bg-current opacity-35"
                          }`}
                        />
                      </span>
                      <span className="min-w-0 flex-1 truncate">
                        {item.jiraKey || item.summary || "Pipeline"}
                      </span>
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </nav>
      <div className={`shrink-0 pb-1 ${collapsed ? "px-0" : "px-0.5"}`}>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent(PRODUCT_TOUR_START_EVENT))}
          className={navItemClass(false, collapsed)}
          title={collapsed ? "Help & Tour" : undefined}
        >
          <span className="flex size-5 shrink-0 items-center justify-center text-app-ink-mute">
            <IconHelp />
          </span>
          {!collapsed ? <span>Help & Tour</span> : null}
        </button>
      </div>
      <SidebarUserCard collapsed={collapsed} />
    </aside>
  );
}

function IconPlus() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M8 3.5v9M3.5 8h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconIntegrations() {
  return (
    <svg width="16" height="16" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M6 3.5h2.5a2 2 0 1 1 0 4H6" stroke="currentColor" />
      <path d="M8 10.5H5.5a2 2 0 1 1 0-4H8" stroke="currentColor" />
    </svg>
  );
}

function IconHelp() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M9.6 9.3a2.5 2.5 0 0 1 4.86.83c0 1.67-2.46 2.08-2.46 3.37"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="12" cy="16.6" r="0.9" fill="currentColor" />
    </svg>
  );
}

function IconSearch() {
  return (
    <svg width="16" height="16" viewBox="0 0 14 14" fill="none" aria-hidden>
      <circle cx="6" cy="6" r="3.5" stroke="currentColor" />
      <path d="M8.5 8.5L12 12" stroke="currentColor" />
    </svg>
  );
}

function IconExpandChevron({ open }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden
      className={`shrink-0 text-app-ink-mute transition-transform ${open ? "rotate-180" : ""}`}
    >
      <path
        d="M3 4.5 L6 7.5 L9 4.5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconChevron({ collapsed }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path
        d={collapsed ? "M4 2.5 L7.5 6 L4 9.5" : "M8 2.5 L4.5 6 L8 9.5"}
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconBoard() {
  return (
    <svg width="16" height="16" viewBox="0 0 14 14" fill="none" aria-hidden>
      <rect x="1.5" y="2.5" width="3.2" height="9" rx="0.8" stroke="currentColor" />
      <rect x="5.4" y="2.5" width="3.2" height="6.5" rx="0.8" stroke="currentColor" />
      <rect x="9.3" y="2.5" width="3.2" height="8" rx="0.8" stroke="currentColor" />
    </svg>
  );
}
function IconDashboard() {
  return (
    <svg width="16" height="16" viewBox="0 0 14 14" fill="none" aria-hidden>
      <rect x="1.5" y="1.5" width="4.5" height="6" rx="1" stroke="currentColor" />
      <rect x="1.5" y="9" width="4.5" height="3.5" rx="1" stroke="currentColor" />
      <rect x="8" y="1.5" width="4.5" height="3.5" rx="1" stroke="currentColor" />
      <rect x="8" y="6.5" width="4.5" height="6" rx="1" stroke="currentColor" />
    </svg>
  );
}
function IconPipeline() {
  return (
    <svg width="16" height="16" viewBox="0 0 14 14" fill="none" aria-hidden>
      <circle cx="3" cy="7" r="1.5" stroke="currentColor" />
      <circle cx="11" cy="7" r="1.5" stroke="currentColor" />
      <circle cx="7" cy="7" r="1.5" stroke="currentColor" />
      <path d="M4.5 7 H5.5 M8.5 7 H9.5" stroke="currentColor" />
    </svg>
  );
}
function IconProduct() {
  return (
    <svg width="16" height="16" viewBox="0 0 14 14" fill="none" aria-hidden>
      <circle cx="7" cy="4.5" r="2" stroke="currentColor" />
      <path d="M3 12c0-2.2 1.8-4 4-4s4 1.8 4 4" stroke="currentColor" />
    </svg>
  );
}
function IconSettings() {
  return (
    <svg width="16" height="16" viewBox="0 0 14 14" fill="none" aria-hidden>
      <circle cx="7" cy="7" r="2" stroke="currentColor" />
      <path
        d="M7 1.5v1.4M7 11.1v1.4M1.5 7h1.4M11.1 7h1.4M3.2 3.2l1 1M9.8 9.8l1 1M9.8 4.2l1-1M3.2 10.8l1-1"
        stroke="currentColor"
      />
    </svg>
  );
}
function IconCodebase() {
  return (
    <svg width="16" height="16" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M4 4L2 7l2 3M10 4l2 3-2 3" stroke="currentColor" />
    </svg>
  );
}
function IconRoadmap() {
  return (
    <svg width="16" height="16" viewBox="0 0 14 14" fill="none" aria-hidden>
      <rect x="2" y="3" width="10" height="8" rx="1" stroke="currentColor" />
      <path d="M4.5 6.5h5M4.5 8.5h3" stroke="currentColor" />
    </svg>
  );
}
function IconQa() {
  return (
    <svg width="16" height="16" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M7 2v4M5 9h4M7 11v1" stroke="currentColor" />
      <circle cx="7" cy="7" r="5" stroke="currentColor" />
    </svg>
  );
}
function IconChat() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M3 3.2h8A1.3 1.3 0 0 1 12.3 4.5v4.2A1.3 1.3 0 0 1 11 10H7.2L4.4 12v-2H3A1.3 1.3 0 0 1 1.7 8.7V4.5A1.3 1.3 0 0 1 3 3.2Z"
        stroke="currentColor"
      />
    </svg>
  );
}
function IconAudit() {
  return (
    <svg width="16" height="16" viewBox="0 0 14 14" fill="none" aria-hidden>
      <rect x="3" y="2" width="8" height="10" rx="1" stroke="currentColor" />
      <path d="M5 5h4M5 7.5h4M5 10h2" stroke="currentColor" />
    </svg>
  );
}
