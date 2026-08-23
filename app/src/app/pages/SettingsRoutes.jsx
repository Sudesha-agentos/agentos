import { Navigate, Route, Routes } from "react-router-dom";
import SettingsLayout from "../layout/SettingsLayout";
import SettingsPlanPage from "./settings/SettingsPlanPage";
import SettingsPipelinePage from "./settings/SettingsPipelinePage";
import SettingsCodebaseIndexPage from "./settings/SettingsCodebaseIndexPage";
import SettingsProfilePage from "./settings/SettingsProfilePage";
import SettingsUsagePage from "./settings/SettingsUsagePage";
import SettingsAppearancePage from "./settings/SettingsAppearancePage";
import SettingsConnectionsPage from "./settings/SettingsConnectionsPage";
import CompanyIntelligence from "./CompanyIntelligence";
import { RedirectSettingsIntegrations } from "./IntegrationsRoutes";
import { useOrg } from "../../shared/providers/OrgRouteProvider";

function RedirectUnknownSettings() {
  const { orgPath } = useOrg();
  return <Navigate to={orgPath("settings", "usage")} replace />;
}

export default function SettingsRoutes() {
  return (
    <Routes>
      <Route path="integrations" element={<RedirectSettingsIntegrations />} />
      <Route path="integrations/*" element={<RedirectSettingsIntegrations />} />
      <Route element={<SettingsLayout />}>
        <Route index element={<Navigate to="usage" replace />} />
        <Route path="profile" element={<SettingsProfilePage />} />
        <Route path="plan" element={<SettingsPlanPage />} />
        <Route path="usage" element={<SettingsUsagePage />} />
        <Route path="appearance" element={<SettingsAppearancePage />} />
        <Route path="connections" element={<SettingsConnectionsPage />} />
        <Route path="codebase-index" element={<SettingsCodebaseIndexPage />} />
        <Route path="company" element={<CompanyIntelligence embedded />} />
        <Route path="pipeline" element={<SettingsPipelinePage />} />
        <Route path="*" element={<RedirectUnknownSettings />} />
      </Route>
    </Routes>
  );
}
