/**
 * Repair workspace after Supabase migration when users exist but Organization rows do not.
 *
 * Usage:
 *   npx tsx scripts/repair-workspace-after-db-migration.ts user@example.com
 *   npx tsx scripts/repair-workspace-after-db-migration.ts user@example.com "My Workspace"
 */
import "dotenv/config";
import {
  createOrganizationForUser,
  getOrganizationForUser,
} from "../src/organization/service";
import { prisma } from "../src/db/client";

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  const orgName = process.argv[3]?.trim();

  if (!email) {
    console.error(
      "Usage: npx tsx scripts/repair-workspace-after-db-migration.ts <email> [orgName]"
    );
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`No User row for ${email}. Sign up in the app first, then re-run.`);
    process.exit(1);
  }

  const existing = await getOrganizationForUser(user.id);
  if (existing) {
    console.log("Workspace already exists:");
    console.log(`  orgId: ${existing.organization.id}`);
    console.log(`  slug:  ${existing.organization.slug}`);
    console.log(`  name:  ${existing.organization.name}`);
    return;
  }

  const result = await createOrganizationForUser(user.id, email, orgName);
  console.log("Created workspace:");
  console.log(`  orgId: ${result.organization.id}`);
  console.log(`  slug:  ${result.organization.slug}`);
  console.log(`  name:  ${result.organization.name}`);
  console.log("\nNext: sign out and sign in again in the app, then reconnect GitHub.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
