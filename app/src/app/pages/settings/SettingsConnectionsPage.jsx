import { Link } from "react-router-dom";
import { useIntegrationsStatus } from "../../../shared/hooks/useIntegrationsStatus";
import { useOrg } from "../../../shared/providers/OrgRouteProvider";
import { IntegrationLogo } from "../../../shared/ui/IntegrationLogo";
import { SettingsPageHeader } from "../../layout/SettingsLayout";

const STATUS_LABEL = {
  connected: { label: "Connected", className: "text-success" },
  setup_incomplete: { label: "Finish setup", className: "text-warning" },
  not_connected: { label: "Not connected", className: "text-app-ink-mute" },
  coming_soon: { label: "Coming soon", className: "text-app-ink-mute" },
};

export default function SettingsConnectionsPage() {
  const { orgPath } = useOrg();
  const { grouped, loading } = useIntegrationsStatus();

  return (
    <div>
      <SettingsPageHeader
        title="Connections"
        description="Tools linked to this workspace. Connect or manage them from the Integrations hub."
      />
      <div className="mb-4 flex justify-end">
        <Link
          to={orgPath("integrations")}
          className="text-[13px] font-medium text-app-ink-dim hover:text-app-ink"
        >
          Open Integrations hub →
        </Link>
      </div>
      <div className="app-card overflow-hidden rounded-2xl">
        {loading && grouped.length === 0 ? (
          <p className="px-5 py-10 text-center text-[13px] text-app-ink-mute">Loading connections…</p>
        ) : (
          grouped.map((section, index) => (
            <div key={section.id} className={index > 0 ? "mt-1" : ""}>
              <p className="bg-app-surface-muted/30 px-5 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-app-ink-mute">
                {section.label}
              </p>
              {section.items.map((integration) => {
                const status = STATUS_LABEL[integration.displayStatus] ?? STATUS_LABEL.not_connected;
                const to = integration.route ?? orgPath("integrations", integration.id);
                return (
                  <Link
                    key={integration.id}
                    to={to}
                    className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-app-surface-muted/40"
                  >
                    <IntegrationLogo integration={integration} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-medium text-app-ink">{integration.name}</p>
                      <p className="truncate text-[12px] text-app-ink-mute">{integration.description}</p>
                    </div>
                    <span className={`shrink-0 text-[12px] font-medium ${status.className}`}>
                      {status.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
