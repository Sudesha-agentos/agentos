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
};

const DEFAULT_COPY = {
  jira: {
    title: "Connect Jira first",
    body: "This page needs a Jira workspace so AgentOX can load tickets and run the AI Worker intake.",
  },
  git: {
    title: "Connect a repository first",
    body: "This page needs GitHub or Bitbucket so AgentOX can read your codebase, open pull requests, and run QA.",
  },
  both: {
    title: "Connect integrations first",
    body: "Connect Jira and a Git provider in Settings before running agents, pipelines, or search.",
  },
};

export default function ConnectIntegrationFirst({
  integrations = ["jira", "github"],
  title,
  body,
}) {
  const { orgPath } = useOrg();
  const items = integrations
    .map((id) => ({ id, ...INTEGRATION_META[id] }))
    .filter((item) => item.name);

  const hasJira = items.some((item) => item.id === "jira");
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
              to={orgPath("settings", "integrations", item.segment)}
              className="app-btn-primary"
            >
              Connect {item.name}
            </Link>
          ))}
          {items.length > 1 ? (
            <Link
              to={orgPath("settings", "integrations")}
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

export function missingCoreIntegrations({ jiraConnected, gitConnected, gitProvider, gitAuthMethod }) {
  const missing = [];
  if (!jiraConnected) missing.push("jira");
  if (!gitConnected) {
    missing.push(gitProvider === "bitbucket" || gitAuthMethod === "oauth" ? "bitbucket" : "github");
  }
  return missing;
}
