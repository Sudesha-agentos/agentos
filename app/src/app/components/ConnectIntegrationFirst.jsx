import { Link } from "react-router-dom";
import EmptyState from "./EmptyState";
import { useOrg } from "../../shared/providers/OrgRouteProvider";

const INTEGRATION_META = {
  jira: {
    name: "Jira",
    segment: "jira",
  },
  github: {
    name: "GitHub",
    segment: "github",
  },
  bitbucket: {
    name: "Bitbucket",
    segment: "bitbucket",
  },
  spreadsheet: {
    name: "Spreadsheet",
    href: "board",
    cta: "Upload a spreadsheet",
  },
};

const DEFAULT_COPY = {
  jira: {
    title: "Connect issue tracking first",
    body: "Connect Jira, or upload an Excel/CSV to the work board, so AgentOX has tickets to run.",
  },
  git: {
    title: "Connect a repository first",
    body: "This page needs GitHub or Bitbucket so AgentOX can read your codebase, open pull requests, and run QA.",
  },
  both: {
    title: "Connect integrations first",
    body: "Connect Jira or upload a spreadsheet, plus a Git provider, before running agents and pipelines.",
  },
};

export default function ConnectIntegrationFirst({
  integrations = ["jira", "github"],
  title,
  body,
}) {
  const { orgPath } = useOrg();
  const ids = [...integrations];
  if (ids.includes("jira") && !ids.includes("spreadsheet")) ids.push("spreadsheet");
  const items = ids.map((id) => ({ id, ...INTEGRATION_META[id] })).filter((item) => item.name);

  const hasJira = items.some((item) => item.id === "jira" || item.id === "spreadsheet");
  const hasGit = items.some((item) => item.id === "github" || item.id === "bitbucket");
  const copy = hasJira && hasGit ? DEFAULT_COPY.both : hasJira ? DEFAULT_COPY.jira : DEFAULT_COPY.git;

  return (
    <EmptyState
      kicker="Setup required"
      title={title ?? copy.title}
      body={body ?? copy.body}
      action={
        <div className="flex flex-wrap items-center justify-center gap-3">
          {items.map((item) => (
            <Link
              key={item.id}
              to={item.href === "board" ? orgPath("board") : orgPath("integrations", item.segment)}
              className="app-btn-primary"
            >
              {item.cta ?? `Connect ${item.name}`}
            </Link>
          ))}
          {items.length > 1 ? (
            <Link
              to={orgPath("integrations")}
              className="rounded-full border border-app-border bg-app-surface px-4 py-2 text-sm font-medium text-app-ink transition hover:border-indigo/40"
            >
              All integrations
            </Link>
          ) : null}
        </div>
      }
    />
  );
}

export function missingCoreIntegrations({
  jiraConnected,
  workBoardReady,
  gitConnected,
  gitProvider,
  gitAuthMethod,
}) {
  const missing = [];
  if (!jiraConnected && !workBoardReady) missing.push("jira");
  if (!gitConnected) {
    missing.push(gitProvider === "bitbucket" || gitAuthMethod === "oauth" ? "bitbucket" : "github");
  }
  return missing;
}
