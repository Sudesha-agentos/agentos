CREATE TABLE IF NOT EXISTS "PmAnalysisRecord" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "jiraKey" TEXT NOT NULL,
    "recordJson" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PmAnalysisRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PmAnalysisRecord_organizationId_jiraKey_key" ON "PmAnalysisRecord"("organizationId", "jiraKey");

CREATE INDEX IF NOT EXISTS "PmAnalysisRecord_organizationId_updatedAt_idx" ON "PmAnalysisRecord"("organizationId", "updatedAt");

DO $$ BEGIN
  ALTER TABLE "PmAnalysisRecord" ADD CONSTRAINT "PmAnalysisRecord_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
