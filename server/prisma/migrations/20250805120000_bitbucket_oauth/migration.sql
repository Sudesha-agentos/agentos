-- Bitbucket OAuth 2.0 (3-LO) fields on org-scoped Git config
ALTER TABLE "OrganizationGitConfig"
  ADD COLUMN IF NOT EXISTS "accessToken" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "refreshToken" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "tokenExpiresAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "scopes" TEXT NOT NULL DEFAULT '';
