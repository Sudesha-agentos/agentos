/**
 * Debug GitHub App → Postgres flow using server/.env
 * Usage: npx tsx scripts/debugGithubIntegration.ts
 */
import "dotenv/config";
import { initIntakeDb } from "../src/jira-intake/sqliteStore";
import {
  listAppInstallations,
  probeGithubAppCredentials,
} from "../src/integrations/git/githubApp";
import { completeGithubInstallation } from "../src/git-integration/githubInstall";
import { getLatestGithubInstallState } from "../src/git-integration/githubInstallationStore";

async function main(): Promise<void> {
  console.log("=== GitHub integration debug ===\n");

  console.log("Env:");
  console.log("  GITHUB_APP_ID:", process.env.GITHUB_APP_ID ? "set" : "MISSING");
  console.log("  GITHUB_APP_SLUG:", process.env.GITHUB_APP_SLUG ?? "MISSING");
  console.log("  GITHUB_APP_PRIVATE_KEY:", process.env.GITHUB_APP_PRIVATE_KEY ? "set" : "MISSING");
  console.log("  DATABASE_URL:", process.env.DATABASE_URL ? "set" : "MISSING");
  console.log("  FRONTEND_URL:", process.env.FRONTEND_URL ?? "MISSING (set on Render)");
  console.log("");

  const probe = await probeGithubAppCredentials();
  console.log("GitHub API probe:", probe);
  if (!probe.ok) {
    process.exit(1);
  }

  const installations = await listAppInstallations();
  console.log("\nGitHub App installations:", installations.length);
  for (const row of installations) {
    console.log(
      `  - id=${row.id} account=${row.accountLogin} (${row.accountType}) repos=${row.repositorySelection}`
    );
  }

  if (!installations.length) {
    console.log("\nNo installations on GitHub. Install the app from /app/git first.");
    process.exit(0);
  }

  initIntakeDb();
  const target = installations[0]!;
  console.log(`\nRunning completeGithubInstallation(${target.id})...`);
  const result = await completeGithubInstallation(String(target.id));
  console.log("complete-install OK:");
  console.log("  installationId:", result.installationId);
  console.log("  account:", result.accountLogin);
  console.log("  repositories:", result.repositories.length);
  if (result.autoSelected) {
    console.log("  autoSelected:", result.autoSelected.fullName);
  }

  const stored = await getLatestGithubInstallState();
  console.log("\nPostgres GithubInstallation:", stored);
}

main().catch((err) => {
  console.error("FAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
});
