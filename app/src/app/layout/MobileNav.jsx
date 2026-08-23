import { NavLink } from "react-router-dom";
import { useOrgNavigation } from "../../shared/routing/useOrgNavigation";

export default function MobileNav() {
  const { appNav, orgPath } = useOrgNavigation();

  return (
    <nav className="sticky top-14 z-10 flex gap-2 overflow-x-auto bg-app-canvas/80 px-4 py-2 backdrop-blur-xl md:hidden">
      {appNav.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === orgPath("settings") ? false : item.end}
          className={({ isActive }) =>
            `shrink-0 rounded-full px-3.5 py-2 text-xs font-medium transition-all ${
              isActive
                ? "bg-app-surface text-app-ink shadow-app-nav-active"
                : "text-app-ink-dim hover:bg-app-surface/70 hover:text-app-ink"
            }`
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
