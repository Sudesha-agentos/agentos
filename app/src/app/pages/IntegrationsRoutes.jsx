import { Navigate, useLocation } from "react-router-dom";
import { useOrg } from "../../shared/providers/OrgRouteProvider";

/** Old Settings URLs land on the standalone Integrations pages. */
export function RedirectSettingsIntegrations() {
  const { orgPath } = useOrg();
  const location = useLocation();
  const marker = "/settings/integrations";
  const idx = location.pathname.indexOf(marker);
  const rest = idx >= 0 ? location.pathname.slice(idx + marker.length) : "";
  return <Navigate to={`${orgPath("integrations")}${rest}${location.search}`} replace />;
}

export default RedirectSettingsIntegrations;
