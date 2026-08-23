import { useAuth } from "../../shared/providers/useAuth";

function userInitials(user) {
  if (!user) return "?";
  if (user.name?.trim()) {
    return user.name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase();
  }
  return user.email?.[0]?.toUpperCase() ?? "?";
}

export default function SidebarUserCard({ collapsed = false }) {
  const { user, organization, logout } = useAuth();

  if (!user) return null;

  const displayName = user.name?.trim() || user.email?.split("@")[0];
  const planLine = organization?.name?.trim() || organization?.slug || "Workspace";

  async function handleLogout() {
    await logout();
  }

  if (collapsed) {
    return (
      <div className="px-1.5 py-3">
        <div className="group relative flex justify-center">
          <button
            type="button"
            className="flex size-8 items-center justify-center rounded-full bg-app-surface-muted text-[11px] font-semibold text-app-ink"
            aria-label={user.email}
          >
            {userInitials(user)}
          </button>
          <div className="invisible absolute bottom-full left-1/2 z-50 mb-2 w-48 -translate-x-1/2 rounded-xl border border-app-border bg-app-surface p-2 opacity-0 shadow-app-float transition-all group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
            <p className="truncate px-2 py-1 text-xs text-app-ink-mute">{user.email}</p>
            <button
              type="button"
              onClick={handleLogout}
              className="w-full rounded-lg px-2 py-1.5 text-left text-sm text-app-ink-dim hover:bg-app-surface-muted hover:text-app-ink"
            >
              Log out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-1.5 py-2">
      <div className="group relative">
        <button
          type="button"
          className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition hover:bg-app-surface-muted/70"
          aria-label="Account menu"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-app-surface-muted text-[11px] font-semibold text-app-ink">
            {userInitials(user)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium text-app-ink">
              {displayName}
            </span>
            <span className="block truncate text-[11px] text-app-ink-mute">{planLine}</span>
          </span>
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden
            className="shrink-0 text-app-ink-mute"
          >
            <path
              d="M4 6l4 4 4-4"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <div className="invisible absolute bottom-full left-0 right-0 z-50 mb-2 rounded-xl border border-app-border bg-app-surface p-2 opacity-0 shadow-app-float transition-all group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full rounded-lg px-3 py-2 text-left text-sm text-app-ink-dim hover:bg-app-surface-muted hover:text-app-ink"
          >
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}
