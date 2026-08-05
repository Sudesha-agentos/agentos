/**
 * Diagnose GitHub connect issues after Supabase / DATABASE_URL migration.
 * Usage: npx tsx scripts/diagnose-github-connect.ts
 */
import "dotenv/config";
import { prisma } from "../src/db/client";

async function main() {
  const hasDb = Boolean(process.env.DATABASE_URL?.trim());
  console.log("DATABASE_URL:", hasDb ? "set" : "MISSING");

  if (!hasDb) {
    console.log("\nFix: set DATABASE_URL on Render to the new Supabase connection string.");
    return;
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log("Postgres: reachable");
  } catch (err) {
    console.error("Postgres: FAILED", err instanceof Error ? err.message : err);
    return;
  }

  const orgs = await prisma.organization.findMany({
    select: { id: true, name: true, slug: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  console.log(`\nOrganizations (${orgs.length} shown):`);
  for (const org of orgs) {
    console.log(`  - ${org.slug} (${org.id})`);
  }

  const members = await prisma.organizationMember.findMany({
    include: { user: { select: { email: true } }, organization: { select: { slug: true } } },
    orderBy: { joinedAt: "desc" },
    take: 10,
  });
  console.log(`\nMembers (${members.length} shown):`);
  for (const m of members) {
    console.log(`  - ${m.user.email} → ${m.organization.slug} (${m.organizationId})`);
  }

  const gitConfigs = await prisma.organizationGitConfig.findMany({
    select: {
      organizationId: true,
      workspace: true,
      repoSlug: true,
      authMethod: true,
      installationId: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 10,
  });
  console.log(`\nOrganizationGitConfig (${gitConfigs.length}):`);
  for (const row of gitConfigs) {
    console.log(
      `  - org=${row.organizationId} ${row.workspace}/${row.repoSlug || "?"} auth=${row.authMethod} install=${row.installationId ?? "none"}`
    );
  }

  const installs = await prisma.githubInstallation.findMany({
    orderBy: { updatedAt: "desc" },
    take: 10,
    select: {
      installationId: true,
      accountLogin: true,
      organizationId: true,
      selectedRepoOwner: true,
      selectedRepoName: true,
      updatedAt: true,
    },
  });
  console.log(`\nGithubInstallation (${installs.length}):`);
  for (const row of installs) {
    const repo =
      row.selectedRepoOwner && row.selectedRepoName
        ? `${row.selectedRepoOwner}/${row.selectedRepoName}`
        : "no repo selected";
    console.log(
      `  - install=${row.installationId} account=${row.accountLogin} org=${row.organizationId ?? "ORPHAN"} repo=${repo}`
    );
  }

  const orphans = installs.filter((i) => !i.organizationId);
  if (orphans.length) {
    console.log(
      "\n⚠ Orphan installs (organizationId null) — open Git integration in the app and click Connect again, or POST /github/complete-install with installationId."
    );
  }

  if (!orgs.length) {
    console.log(
      "\n⚠ No organizations in this database. Users must sign out, sign in, and complete onboarding (create workspace)."
    );
  }

  if (!gitConfigs.length && installs.length) {
    console.log(
      "\n⚠ GitHub App is installed on GitHub but OrganizationGitConfig is empty — run complete-install from the app."
    );
  }

  console.log("\nIf Supabase shows exceed_egress_quota, upgrade the plan or remove spend caps before retrying.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
