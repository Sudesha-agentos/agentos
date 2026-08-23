import { useAuth } from "../../../shared/providers/useAuth";
import { SettingsPageHeader } from "../../layout/SettingsLayout";

const ROLE_LABELS = {
  OWNER: "Owner",
  ADMIN: "Admin",
  MEMBER: "Member",
};

export default function SettingsProfilePage() {
  const { user, organization } = useAuth();
  const displayName = user?.name?.trim() || user?.email?.split("@")[0] || "—";
  const workspace = organization?.name?.trim() || organization?.slug || "Workspace";
  const role = ROLE_LABELS[user?.organizationRole ?? organization?.role] ?? "Member";

  const rows = [
    { label: "Name", value: displayName },
    { label: "Email", value: user?.email ?? "—" },
    { label: "Workspace", value: workspace },
    { label: "Role", value: role },
  ];

  return (
    <div>
      <SettingsPageHeader
        title="Profile"
        description="Your account on this AgentOX workspace."
      />
      <div className="overflow-hidden rounded-xl border border-app-border bg-app-surface">
        {rows.map((row, index) => (
          <div
            key={row.label}
            className={`flex items-baseline justify-between gap-6 px-5 py-4 ${
              index > 0 ? "border-t border-app-border" : ""
            }`}
          >
            <p className="text-[13px] text-app-ink-mute">{row.label}</p>
            <p className="truncate text-right text-[14px] font-medium text-app-ink">{row.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
