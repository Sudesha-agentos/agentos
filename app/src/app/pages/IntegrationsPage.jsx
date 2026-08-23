import { Link } from "react-router-dom";
import { useIntegrationsStatus } from "../../shared/hooks/useIntegrationsStatus";
import { useOrg } from "../../shared/providers/OrgRouteProvider";
import { AnimatedAppPage } from "../../shared/ui/AnimatedAppPage";
import { IntegrationLogo } from "../../shared/ui/IntegrationLogo";

const CTA = {
  connected: "Manage",
  setup_incomplete: "Finish setup",
  not_connected: "Connect",
  coming_soon: "Connect",
};

export default function IntegrationsPage() {
  const { grouped } = useIntegrationsStatus();

  return (
    <AnimatedAppPage className="max-w-[44rem]">
      <header className="pt-2">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-[10px] border border-app-border bg-app-surface text-app-ink">
            <IconPlug />
          </div>
          <h1 className="text-[1.75rem] font-semibold tracking-tight text-app-ink">Integrations</h1>
        </div>
        <p className="mt-2 text-[14px] text-app-ink-dim">
          Personal · Connect data sources and AI tools
        </p>
      </header>

      <div className="space-y-10 pt-2" data-tour="integrations">
        {grouped.map((section) => (
          <section key={section.id}>
            <h2 className="text-[15px] font-semibold text-app-ink">{section.label}</h2>
            {section.description ? (
              <p className="mt-1 text-[13px] leading-relaxed text-app-ink-dim">
                {section.description}
              </p>
            ) : null}
            <div className="mt-4 overflow-hidden rounded-2xl border border-app-border bg-app-surface">
              {section.items.map((integration, index) => (
                <IntegrationRow
                  key={integration.id}
                  integration={integration}
                  divided={index > 0}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </AnimatedAppPage>
  );
}

function IntegrationRow({ integration, divided }) {
  const { orgPath } = useOrg();
  const cta = CTA[integration.displayStatus] ?? "Connect";
  const to = orgPath("integrations", integration.id);

  return (
    <div
      className={`flex items-center gap-4 px-4 py-4 sm:px-5 ${
        divided ? "border-t border-app-border" : ""
      }`}
    >
      <IntegrationLogo integration={integration} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-[14px] font-semibold text-app-ink">{integration.name}</h3>
          {integration.tag ? (
            <span className="rounded-full bg-app-surface-muted px-2 py-0.5 text-[11px] font-medium text-app-ink-mute">
              {integration.tag}
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-[13px] leading-relaxed text-app-ink-dim">{integration.description}</p>
      </div>
      <Link
        to={to}
        className="shrink-0 rounded-lg border border-app-border px-3 py-1.5 text-[13px] font-medium text-app-ink transition hover:bg-app-surface-muted"
      >
        {cta}
      </Link>
    </div>
  );
}

function IconPlug() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M6.2 3.2v3.1M9.8 3.2v3.1M4.6 7.2h6.8c.6 0 1.1.5 1.1 1.1v1.2A4.5 4.5 0 0 1 8 14a4.5 4.5 0 0 1-4.5-4.5V8.3c0-.6.5-1.1 1.1-1.1Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
