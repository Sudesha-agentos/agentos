-- Business-data integrations (Slack, HubSpot, Linear, …). Secrets encrypted in configEnc.

CREATE TABLE IF NOT EXISTS "WorkspaceConnection" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "configEnc" JSONB NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "lastVerifiedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkspaceConnection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WorkspaceConnection_organizationId_provider_key"
    ON "WorkspaceConnection"("organizationId", "provider");
CREATE INDEX IF NOT EXISTS "WorkspaceConnection_organizationId_idx"
    ON "WorkspaceConnection"("organizationId");

ALTER TABLE "WorkspaceConnection"
    ADD CONSTRAINT "WorkspaceConnection_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
