import { Navigate, Route, Routes } from "react-router-dom";
import SettingsLayout from "../layout/SettingsLayout";
import SettingsPlanPage from "./settings/SettingsPlanPage";
import SettingsPipelinePage from "./settings/SettingsPipelinePage";
import SettingsCodebaseIndexPage from "./settings/SettingsCodebaseIndexPage";
import CompanyIntelligence from "./CompanyIntelligence";
import { RedirectSettingsIntegrations } from "./IntegrationsRoutes";

export default function SettingsRoutes() {
  return (
    <Routes>
      <Route path="integrations" element={<RedirectSettingsIntegrations />} />
      <Route path="integrations/*" element={<RedirectSettingsIntegrations />} />
      <Route element={<SettingsLayout />}>
        <Route index element={<Navigate to="plan" replace />} />
        <Route path="plan" element={<SettingsPlanPage />} />
        <Route path="codebase-index" element={<SettingsCodebaseIndexPage />} />
        <Route path="company" element={<CompanyIntelligence embedded />} />
        <Route path="pipeline" element={<SettingsPipelinePage />} />
        <Route path="*" element={<Navigate to="../plan" replace />} />
      </Route>
    </Routes>
  );
}
