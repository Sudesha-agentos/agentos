import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useOrg } from "../../shared/providers/OrgRouteProvider";
import { AnimatedAppPage } from "../../shared/ui/AnimatedAppPage";
import GitIntegration from "./GitIntegration";
import JiraIntegration from "./JiraIntegration";
import DatabaseIntegration from "./DatabaseIntegration";
import SpreadsheetIntegration from "./settings/SpreadsheetIntegration";
import SettingsIntegrationDetailPage from "./settings/SettingsIntegrationDetailPage";
import IntegrationsPage from "./IntegrationsPage";

function IntegrationsDetailLayout({ children }) {
  return (
    <AnimatedAppPage className="max-w-5xl">
      <div className="rounded-2xl border border-app-border bg-app-surface p-6 sm:p-8">
        {children}
      </div>
    </AnimatedAppPage>
  );
}

/** Old Settings URLs keep working and land on the standalone Integrations page. */
export function RedirectSettingsIntegrations() {
  const { orgPath } = useOrg();
  const location = useLocation();
  const marker = "/settings/integrations";
  const idx = location.pathname.indexOf(marker);
  const rest = idx >= 0 ? location.pathname.slice(idx + marker.length) : "";
  return <Navigate to={`${orgPath("integrations")}${rest}${location.search}`} replace />;
}

export default function IntegrationsRoutes() {
  return (
    <Routes>
      <Route index element={<IntegrationsPage />} />
      <Route
        path="github"
        element={
          <IntegrationsDetailLayout>
            <GitIntegration embedded />
          </IntegrationsDetailLayout>
        }
      />
      <Route
        path="bitbucket"
        element={
          <IntegrationsDetailLayout>
            <GitIntegration embedded defaultTab="bitbucket" />
          </IntegrationsDetailLayout>
        }
      />
      <Route
        path="jira"
        element={
          <IntegrationsDetailLayout>
            <JiraIntegration embedded />
          </IntegrationsDetailLayout>
        }
      />
      <Route
        path="spreadsheet"
        element={
          <IntegrationsDetailLayout>
            <SpreadsheetIntegration embedded />
          </IntegrationsDetailLayout>
        }
      />
      <Route
        path="postgresql"
        element={
          <IntegrationsDetailLayout>
            <DatabaseIntegration embedded defaultProvider="postgresql" />
          </IntegrationsDetailLayout>
        }
      />
      <Route
        path="supabase"
        element={
          <IntegrationsDetailLayout>
            <DatabaseIntegration embedded defaultProvider="supabase" />
          </IntegrationsDetailLayout>
        }
      />
      <Route
        path="mysql"
        element={
          <IntegrationsDetailLayout>
            <DatabaseIntegration embedded defaultProvider="mysql" />
          </IntegrationsDetailLayout>
        }
      />
      <Route
        path=":integrationId"
        element={
          <IntegrationsDetailLayout>
            <SettingsIntegrationDetailPage />
          </IntegrationsDetailLayout>
        }
      />
    </Routes>
  );
}
