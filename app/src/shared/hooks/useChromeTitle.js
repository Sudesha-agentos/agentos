import { useAuth } from "../providers/useAuth";
import { useOrgNavigation } from "../routing/useOrgNavigation";

export function useChromeTitle() {
  const { organization } = useAuth();
  const { orgPath, pathMatches, location } = useOrgNavigation();
  const orgName = organization?.name?.trim() || organization?.slug || "Workspace";

  if (location.pathname === orgPath()) return orgName;
  if (pathMatches("board")) return "Board";
  if (pathMatches("pipelines")) return "Pipelines";
  if (pathMatches("roadmap")) return "Roadmap";
  if (pathMatches("pm-agents")) return "Virin";
  if (pathMatches("codebase")) return "Ananta Brain";
  if (pathMatches("ananta")) return "Ananta";
  if (pathMatches("qa")) return "Neel";
  if (pathMatches("projects")) return "All projects";
  if (pathMatches("integrations")) return "Integrations";
  if (pathMatches("logs")) return "Log Intelligence";
  if (pathMatches("settings")) return "Settings";
  if (pathMatches("audit")) return "Audit Trail";
  return orgName;
}
