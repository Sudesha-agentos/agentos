-- Customer-owned databases attached to a workspace (many per org).

CREATE TABLE IF NOT EXISTS "OrganizationDatabase" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "environment" TEXT NOT NULL DEFAULT 'staging',
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL,
    "databaseName" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordEnc" JSONB NOT NULL,
    "ssl" BOOLEAN NOT NULL DEFAULT true,
    "schemaAllowlist" JSONB NOT NULL DEFAULT '[]',
    "autoMigrate" BOOLEAN NOT NULL DEFAULT false,
    "requireConfirmToApply" BOOLEAN NOT NULL DEFAULT true,
    "lastIntrospectedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OrganizationDatabase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "OrganizationDatabaseTable" (
    "id" TEXT NOT NULL,
    "databaseId" TEXT NOT NULL,
    "schemaName" TEXT NOT NULL,
    "tableName" TEXT NOT NULL,
    "columns" JSONB NOT NULL DEFAULT '[]',
    "primaryKeys" JSONB NOT NULL DEFAULT '[]',
    "foreignKeys" JSONB NOT NULL DEFAULT '[]',
    "indexes" JSONB NOT NULL DEFAULT '[]',
    "rowEstimate" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OrganizationDatabaseTable_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "OrganizationDatabaseMigration" (
    "id" TEXT NOT NULL,
    "databaseId" TEXT NOT NULL,
    "pipelineId" TEXT,
    "sql" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "appliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrganizationDatabaseMigration_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "OrganizationDatabase_organizationId_provider_idx"
    ON "OrganizationDatabase"("organizationId", "provider");
CREATE INDEX IF NOT EXISTS "OrganizationDatabase_organizationId_environment_idx"
    ON "OrganizationDatabase"("organizationId", "environment");
CREATE UNIQUE INDEX IF NOT EXISTS "OrganizationDatabaseTable_databaseId_schemaName_tableName_key"
    ON "OrganizationDatabaseTable"("databaseId", "schemaName", "tableName");
CREATE INDEX IF NOT EXISTS "OrganizationDatabaseTable_databaseId_idx"
    ON "OrganizationDatabaseTable"("databaseId");
CREATE INDEX IF NOT EXISTS "OrganizationDatabaseMigration_databaseId_createdAt_idx"
    ON "OrganizationDatabaseMigration"("databaseId", "createdAt");
CREATE INDEX IF NOT EXISTS "OrganizationDatabaseMigration_pipelineId_idx"
    ON "OrganizationDatabaseMigration"("pipelineId");

ALTER TABLE "OrganizationDatabase"
    ADD CONSTRAINT "OrganizationDatabase_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrganizationDatabaseTable"
    ADD CONSTRAINT "OrganizationDatabaseTable_databaseId_fkey"
    FOREIGN KEY ("databaseId") REFERENCES "OrganizationDatabase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrganizationDatabaseMigration"
    ADD CONSTRAINT "OrganizationDatabaseMigration_databaseId_fkey"
    FOREIGN KEY ("databaseId") REFERENCES "OrganizationDatabase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
