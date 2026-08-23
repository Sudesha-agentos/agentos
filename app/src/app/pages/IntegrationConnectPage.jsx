import { Navigate, useParams } from "react-router-dom";
import { getIntegrationById } from "../../shared/config/integrationsCatalog";
import { useOrg } from "../../shared/providers/OrgRouteProvider";
import { AnimatedAppPage } from "../../shared/ui/AnimatedAppPage";
import GitIntegration from "./GitIntegration";
import JiraIntegration from "./JiraIntegration";
import DatabaseIntegration from "./DatabaseIntegration";
import SpreadsheetIntegration from "./settings/SpreadsheetIntegration";
import SettingsIntegrationDetailPage from "./settings/SettingsIntegrationDetailPage";
import LogSourceConnectWidget from "../../widgets/integration-connect/LogSourceConnectWidget";
import WorkspaceConnectWidget from "../../widgets/integration-connect/WorkspaceConnectWidget";

export default function IntegrationConnectPage() {
  const { integrationId } = useParams();
  const { orgSlug, orgPath } = useOrg();
  const integration = getIntegrationById(integrationId, orgSlug);

  if (!integrationId || !integration) {
    return <Navigate to={orgPath("integrations")} replace />;
  }

  if (integrationId === "github") {
    return (
      <ConnectShell>
        <GitIntegration embedded />
      </ConnectShell>
    );
  }
  if (integrationId === "bitbucket") {
    return (
      <ConnectShell>
        <GitIntegration embedded defaultTab="bitbucket" />
      </ConnectShell>
    );
  }
  if (integrationId === "jira") {
    return (
      <ConnectShell>
        <JiraIntegration embedded />
      </ConnectShell>
    );
  }
  if (integrationId === "spreadsheet") {
    return (
      <ConnectShell>
        <SpreadsheetIntegration embedded />
      </ConnectShell>
    );
  }
  if (integrationId === "postgresql" || integrationId === "supabase" || integrationId === "mysql") {
    return (
      <ConnectShell>
        <DatabaseIntegration embedded defaultProvider={integrationId} />
      </ConnectShell>
    );
  }
  if (integration.connectKind === "log_source" && integration.logSourceType) {
    return (
      <ConnectShell>
        <LogSourceConnectWidget integration={integration} sourceType={integration.logSourceType} />
      </ConnectShell>
    );
  }
  if (integration.connectKind === "workspace") {
    return (
      <ConnectShell>
        <WorkspaceConnectWidget integration={integration} />
      </ConnectShell>
    );
  }

  return (
    <ConnectShell>
      <SettingsIntegrationDetailPage />
    </ConnectShell>
  );
}

function ConnectShell({ children }) {
  return (
    <AnimatedAppPage className="max-w-5xl">
      <div className="rounded-2xl border border-app-border bg-app-surface p-6 sm:p-8">
        {children}
      </div>
    </AnimatedAppPage>
  );
}
