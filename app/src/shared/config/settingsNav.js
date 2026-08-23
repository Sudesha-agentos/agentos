import { orgPath } from "../routing/orgPaths";

export function buildSettingsNav(slug) {
  return [
    { id: "profile", label: "Profile", to: orgPath(slug, "settings", "profile") },
    { id: "plan", label: "Plans & Credits", to: orgPath(slug, "settings", "plan") },
    { id: "usage", label: "Usage History", to: orgPath(slug, "settings", "usage") },
    { id: "appearance", label: "Appearance", to: orgPath(slug, "settings", "appearance") },
    { id: "connections", label: "Connections", to: orgPath(slug, "settings", "connections") },
    { id: "company", label: "Company", to: orgPath(slug, "settings", "company") },
    {
      id: "codebase-index",
      label: "Codebase indexing",
      to: orgPath(slug, "settings", "codebase-index"),
    },
    { id: "pipeline", label: "Pipeline & quality", to: orgPath(slug, "settings", "pipeline") },
    {
      id: "bug",
      label: "Report a Bug",
      href: "mailto:hello@agentox.io?subject=AgentOX%20bug%20report",
    },
  ];
}

/** @deprecated Use buildSettingsNav(slug) */
export const SETTINGS_NAV = buildSettingsNav("app");
