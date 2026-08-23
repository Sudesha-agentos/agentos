import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { useWorkspaceBilling } from "../../entities/billing";
import { BILLING_PLANS, PILOT_PLAN } from "../../shared/config/billingPlans";
import { useAuth } from "../../shared/providers/useAuth";
import { useOrg } from "../../shared/providers/OrgRouteProvider";
import ThemeSegmentedControl from "../../shared/ui/ThemeSegmentedControl";

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

function planDisplayName(planId) {
  if (planId === "pilot") return PILOT_PLAN.name;
  return BILLING_PLANS.find((plan) => plan.id === planId)?.name ?? "Free";
}

export default function SidebarUserCard({ collapsed = false }) {
  const { user, logout } = useAuth();
  const { orgPath } = useOrg();
  const { data: billing } = useWorkspaceBilling();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const [menuPos, setMenuPos] = useState(null);

  const cap = billing?.runsCap ?? PILOT_PLAN.pipelineRunsCap;
  const used = billing?.runsUsed ?? 0;
  const left = Math.max(0, cap - used);
  const remainingPct = cap > 0 ? Math.min(100, (left / cap) * 100) : 0;
  const planName = planDisplayName(billing?.planId ?? "pilot");

  useEffect(() => {
    if (!open) return undefined;

    function place() {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setMenuPos({
        left: Math.round(rect.right + 10),
        bottom: Math.round(window.innerHeight - rect.bottom),
      });
    }

    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);

    function onDoc(event) {
      const target = event.target;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(event) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!user) return null;

  const displayName = user.name?.trim() || user.email?.split("@")[0];

  async function handleLogout() {
    setOpen(false);
    await logout();
  }

  const menu =
    open && menuPos
      ? createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{ left: menuPos.left, bottom: menuPos.bottom }}
            className="fixed z-[80] w-[272px] overflow-hidden rounded-2xl app-glass shadow-app-float"
          >
            <div className="flex items-center justify-between gap-3 px-3.5 py-3">
              <span className="text-[13px] text-app-ink">Theme</span>
              <ThemeSegmentedControl size="sm" />
            </div>

            <div className="px-3.5 py-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-app-ink-mute">
                  Credits
                </p>
                <p className="text-[11px] text-app-ink-dim">{left} left this month</p>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-app-surface-muted">
                <div
                  className="h-full rounded-full bg-app-ink"
                  style={{ width: `${remainingPct}%` }}
                />
              </div>
              <div className="mt-2.5 flex items-center justify-between gap-2">
                <p className="min-w-0 truncate text-[11px] text-app-ink-mute">
                  Monthly credits · {planName}
                </p>
                <Link
                  to={orgPath("settings", "plan")}
                  onClick={() => setOpen(false)}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-app-ink px-2.5 py-1 text-[11px] font-semibold text-app-canvas"
                >
                  <IconUpgrade />
                  Upgrade
                </Link>
              </div>
            </div>

            <div className="p-1.5">
              <Link
                to={orgPath("settings", "profile")}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-app-ink hover:bg-app-surface-muted"
              >
                <span className="text-app-ink-dim">
                  <IconGear />
                </span>
                Account settings
              </Link>
              <button
                type="button"
                role="menuitem"
                onClick={handleLogout}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] text-rose-400/90 hover:bg-app-surface-muted"
              >
                <IconSignOut />
                Sign out
              </button>
            </div>
          </div>,
          document.body
        )
      : null;

  if (collapsed) {
    return (
      <div className="px-1.5 py-3">
        <button
          ref={triggerRef}
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label="Account menu"
          onClick={() => setOpen((value) => !value)}
          className={`flex size-8 items-center justify-center rounded-full bg-app-surface-muted text-[11px] font-semibold text-app-ink ${
            open ? "ring-2 ring-app-ink/20" : ""
          }`}
        >
          {userInitials(user)}
        </button>
        {menu}
      </div>
    );
  }

  return (
    <div className="px-1.5 py-2">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        onClick={() => setOpen((value) => !value)}
        className={`flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition hover:bg-app-surface-muted/70 ${
          open ? "bg-app-surface-muted/70" : ""
        }`}
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-app-surface-muted text-[11px] font-semibold text-app-ink">
          {userInitials(user)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold text-app-ink">{displayName}</span>
          <span className="block truncate text-[11px] text-app-ink-mute">{user.email}</span>
        </span>
      </button>
      {menu}
    </div>
  );
}

function IconGear() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M12 3.5v1.8M12 18.7v1.8M3.5 12h1.8M18.7 12h1.8M6.1 6.1l1.3 1.3M16.6 16.6l1.3 1.3M17.9 6.1l-1.3 1.3M7.4 16.6l-1.3 1.3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconSignOut() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9.5 6.5H7.2A1.7 1.7 0 0 0 5.5 8.2v7.6c0 .9.8 1.7 1.7 1.7h2.3M14 8l4 4-4 4M10 12h8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconUpgrade() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M8 1.6 9.7 5.3 13.6 6 10.8 8.8 11.4 12.8 8 11 4.6 12.8 5.2 8.8 2.4 6l3.9-.7L8 1.6Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}
