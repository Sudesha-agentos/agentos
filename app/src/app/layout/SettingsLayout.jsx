import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { buildSettingsNav } from "../../shared/config/settingsNav";
import { useOrg } from "../../shared/providers/OrgRouteProvider";
import { orgPathMatches } from "../../shared/routing/orgPaths";

const ICONS = {
  profile: IconProfile,
  plan: IconPlan,
  usage: IconUsage,
  appearance: IconAppearance,
  models: IconModels,
  connections: IconConnections,
  company: IconCompany,
  "codebase-index": IconCodebase,
  pipeline: IconPipeline,
  bug: IconBug,
};

function itemActive(item, pathname, orgSlug) {
  if (!item.to) return false;
  if (pathname === item.to) return true;
  return orgPathMatches(pathname, orgSlug, "settings", item.id);
}

export function SettingsPageHeader({ title, description }) {
  return (
    <header className="mb-8">
      <h1 className="text-[22px] font-semibold tracking-tight text-app-ink">{title}</h1>
      {description ? (
        <p className="mt-1.5 max-w-2xl text-[14px] leading-relaxed text-app-ink-dim">
          {description}
        </p>
      ) : null}
    </header>
  );
}

export default function SettingsLayout() {
  const location = useLocation();
  const { orgSlug, orgPath } = useOrg();
  const settingsNav = buildSettingsNav(orgSlug);

  return (
    <div className="flex min-h-full flex-col bg-app-canvas md:flex-row">
      <aside className="app-glass flex w-full shrink-0 flex-col px-3 py-3 md:w-[15.5rem] md:overflow-y-auto md:py-5">
        <Link
          to={orgPath()}
          className="mb-3 inline-flex w-fit items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] text-app-ink-dim transition hover:bg-app-surface-muted hover:text-app-ink"
        >
          <IconBack />
          Back
        </Link>
        <h2 className="px-2.5 pb-3 text-[17px] font-semibold text-app-ink">Settings</h2>
        <nav className="flex gap-1 overflow-x-auto pb-1 md:flex-col md:overflow-visible md:pb-0">
          {settingsNav.map((item) => {
            const Icon = ICONS[item.id] ?? IconProfile;
            if (item.href) {
              return (
                <a
                  key={item.id}
                  href={item.href}
                  className="flex shrink-0 items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] font-medium text-app-ink-dim transition hover:bg-app-surface-muted hover:text-app-ink"
                >
                  <span className="text-app-ink-mute">
                    <Icon />
                  </span>
                  {item.label}
                </a>
              );
            }
            const active = itemActive(item, location.pathname, orgSlug);
            return (
              <NavLink
                key={item.id}
                to={item.to}
                className={`flex shrink-0 items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] font-medium transition ${
                  active
                    ? "bg-app-surface-muted text-app-ink"
                    : "text-app-ink-dim hover:bg-app-surface-muted/70 hover:text-app-ink"
                }`}
              >
                <span className={active ? "text-app-ink" : "text-app-ink-mute"}>
                  <Icon />
                </span>
                {item.label}
              </NavLink>
            );
          })}
        </nav>
      </aside>

      <div className="min-w-0 flex-1 px-4 py-8 sm:px-8 lg:px-12">
        <div className="mx-auto w-full max-w-5xl">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

function IconBack() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M10 3.5 5.5 8 10 12.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconProfile() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M5.5 18.5c.8-3 3.4-4.6 6.5-4.6s5.7 1.6 6.5 4.6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconPlan() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3.5" y="6" width="17" height="12" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3.5 10h17" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function IconUsage() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 18V9M10 18V6M15 18v-7M20 18V8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconAppearance() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8.2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 3.8v16.4M12 12c3.6 0 6.5-3.7 6.5-8.2M12 12c-3.6 0-6.5 3.7-6.5 8.2" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function IconModels() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="8" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="16" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="16" r="2.2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M9.8 9.4 11.2 14.2M14.2 9.4 12.8 14.2" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function IconConnections() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9.2 14.8 7.4 16.6a3.1 3.1 0 0 1-4.4-4.4l2.4-2.4a3.1 3.1 0 0 1 4.4 0"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M14.8 9.2 16.6 7.4a3.1 3.1 0 1 1 4.4 4.4l-2.4 2.4a3.1 3.1 0 0 1-4.4 0"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path d="M9.8 14.2 14.2 9.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IconCompany() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4.5 20V7.5A1.5 1.5 0 0 1 6 6h7.5A1.5 1.5 0 0 1 15 7.5V20M15 10h3.5A1.5 1.5 0 0 1 20 11.5V20M3.5 20h17"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path d="M8 9.5h3M8 13h3M8 16.5h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IconCodebase() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8.5 8.5 5 12l3.5 3.5M15.5 8.5 19 12l-3.5 3.5M13 7l-2 10"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconPipeline() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="6" cy="12" r="2.2" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="18" cy="7" r="2.2" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="18" cy="17" r="2.2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8.2 11.2 15.8 8M8.2 12.8 15.8 16" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function IconBug() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 10.5h8M7 14h10M9.2 8.2 7 6M14.8 8.2 17 6M7 14l-2.2 2.2M17 14l2.2 2.2M12 8.5c2.6 0 4.5 1.6 4.5 4.8v1.4c0 2.4-1.8 4.3-4.5 4.3s-4.5-1.9-4.5-4.3v-1.4c0-3.2 1.9-4.8 4.5-4.8Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
