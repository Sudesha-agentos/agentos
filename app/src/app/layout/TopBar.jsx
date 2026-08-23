import { Link, useLocation } from "react-router-dom";
import NotificationCenter from "../../shared/components/NotificationCenter";
import { useAppTheme } from "../../shared/hooks/useAppTheme";
import { useChromeTitle } from "../../shared/hooks/useChromeTitle";
import { useOrg } from "../../shared/providers/OrgRouteProvider";
import { PRODUCT_TOUR_START_EVENT } from "../../features/product-tour/productTourStorage";
import WorkspaceModeSwitch from "../../shared/ui/WorkspaceModeSwitch";
import { useWorkspaceMode } from "../../shared/hooks/useWorkspaceMode";

export default function TopBar() {
  const { orgPath } = useOrg();
  const location = useLocation();
  const { isDark, toggleTheme } = useAppTheme();
  const title = useChromeTitle();
  const { isPreview } = useWorkspaceMode();
  const onHome = location.pathname === orgPath();

  return (
    <header className="app-glass sticky top-0 z-40 flex h-14 items-center gap-3 px-4 sm:px-6">
      <div className="flex min-w-0 flex-1 items-center">
        <div className="w-10 shrink-0 md:hidden" />
        {isPreview && onHome ? (
          <p className="hidden min-w-0 truncate text-[13px] text-app-ink-mute sm:block">
            Live preview
          </p>
        ) : onHome ? (
          <Link
            to={orgPath("settings", "plan")}
            className="min-w-0 truncate text-[12px] text-app-ink-mute"
          >
            Free plan · <span className="font-medium text-app-ink">Upgrade</span>
          </Link>
        ) : (
          <h1 className="min-w-0 truncate text-[15px] font-medium text-app-ink">{title}</h1>
        )}
      </div>
      {onHome ? (
        <div className="shrink-0">
          <WorkspaceModeSwitch />
        </div>
      ) : null}
      <div className="flex min-w-0 flex-1 items-center justify-end gap-1">
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent(PRODUCT_TOUR_START_EVENT))}
          className="hidden size-9 items-center justify-center rounded-lg text-app-ink-dim transition-colors hover:bg-app-surface-muted hover:text-app-ink md:flex"
          aria-label="Replay product tour"
          title="Replay product tour"
        >
          <IconTour />
        </button>
        <button
          type="button"
          onClick={toggleTheme}
          className="flex size-9 items-center justify-center rounded-lg text-app-ink-dim transition-colors hover:bg-app-surface-muted hover:text-app-ink"
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          title={isDark ? "Light mode" : "Dark mode"}
        >
          {isDark ? <IconSun /> : <IconMoon />}
        </button>
        <Link
          to={orgPath("settings")}
          className="flex size-9 items-center justify-center rounded-lg text-app-ink-dim transition-colors hover:bg-app-surface-muted hover:text-app-ink md:hidden"
          aria-label="Settings"
        >
          <svg width="18" height="18" viewBox="0 0 14 14" fill="none" aria-hidden>
            <circle cx="7" cy="7" r="2" stroke="currentColor" />
            <path
              d="M7 1.5v1.4M7 11.1v1.4M1.5 7h1.4M11.1 7h1.4M3.2 3.2l1 1M9.8 9.8l1 1M9.8 4.2l1-1M3.2 10.8l1-1"
              stroke="currentColor"
            />
          </svg>
        </Link>
        <NotificationCenter />
      </div>
    </header>
  );
}

function IconTour() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
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

function IconMoon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M21 14.3A8.5 8.5 0 0 1 9.7 3 7 7 0 1 0 21 14.3Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconSun() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.1 5.1l1.6 1.6M17.3 17.3l1.6 1.6M17.3 6.7l1.6-1.6M5.1 18.9l1.6-1.6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
