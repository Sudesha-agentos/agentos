import { Link } from "react-router-dom";
import { PageIntro } from "../../shared/ui/Panel";
import { TitleWithInfo } from "../../shared/ui/InfoTip";
import { IntegrationLogo } from "../../shared/ui/IntegrationLogo";
import { AnimatedAppPage } from "../../shared/ui/AnimatedAppPage";
import { useOrgPathBuilder } from "../../shared/providers/OrgRouteProvider";

export function SettingsPageShell({
  embedded = false,
  showBack = true,
  backTo,
  backLabel = "← Integrations",
  kicker,
  title,
  info,
  logo,
  wide = true,
  className = "",
  children,
}) {
  const orgPath = useOrgPathBuilder();
  const resolvedBack = backTo ?? orgPath("integrations");
  if (embedded) {
    return (
      <div className={`space-y-6 ${className}`}>
        {showBack ? (
          <Link
            to={resolvedBack}
            className="inline-flex items-center gap-1 text-sm font-medium text-app-ink-dim transition hover:text-indigo"
          >
            {backLabel}
          </Link>
        ) : null}
        {kicker || title ? (
          <div className="border-b border-app-ink/6 pb-6">
            {kicker ? <p className="text-xs font-semibold text-app-ink-dim">{kicker}</p> : null}
            {title ? (
              <h2 className="mt-1 flex items-center gap-2.5 text-sm font-semibold text-app-ink">
                {logo ? (
                  <IntegrationLogo src={logo} name={typeof title === "string" ? title : ""} size="sm" />
                ) : null}
                <TitleWithInfo info={info}>{title}</TitleWithInfo>
              </h2>
            ) : null}
          </div>
        ) : null}
        {children}
      </div>
    );
  }

  return (
    <AnimatedAppPage wide={wide} className={className}>
      {kicker || title ? (
        <PageIntro
          kicker={kicker}
          title={
            logo ? (
              <span className="inline-flex items-center gap-3">
                <IntegrationLogo src={logo} name={typeof title === "string" ? title : ""} size="md" />
                {title}
              </span>
            ) : (
              title
            )
          }
          info={info}
        />
      ) : null}
      {children}
    </AnimatedAppPage>
  );
}
