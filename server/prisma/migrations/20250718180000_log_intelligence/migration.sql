-- Log Intelligence Layer

CREATE TABLE IF NOT EXISTS "LogSource" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastPulledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LogSource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "LogEntry" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "severity" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "errorType" TEXT,
    "stackTrace" TEXT,
    "httpStatus" INTEGER,
    "endpoint" TEXT,
    "userId" TEXT,
    "deploymentId" TEXT,
    "environment" TEXT NOT NULL,
    "serviceName" TEXT NOT NULL,
    "rawPayload" JSONB NOT NULL,
    "pipelineId" TEXT,
    "jiraKey" TEXT,
    "agentRunId" TEXT,
    "isCovered" BOOLEAN,
    "correlationConfidence" TEXT,
    "patternHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LogEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ErrorPattern" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "patternHash" TEXT NOT NULL,
    "errorType" TEXT NOT NULL,
    "messageTemplate" TEXT NOT NULL,
    "firstSeen" TIMESTAMP(3) NOT NULL,
    "lastSeen" TIMESTAMP(3) NOT NULL,
    "occurrenceCount" INTEGER NOT NULL DEFAULT 1,
    "affectedServices" JSONB NOT NULL DEFAULT '[]',
    "affectedEndpoints" JSONB NOT NULL DEFAULT '[]',
    "rootCauseHypothesis" TEXT,
    "confidenceScore" DOUBLE PRECISION,
    "remediationSteps" TEXT,
    "analysedAt" TIMESTAMP(3),
    "pipelineId" TEXT,
    "jiraKey" TEXT,
    "deploymentId" TEXT,
    "isQaGap" BOOLEAN NOT NULL DEFAULT false,
    "qaGapReason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "resolvedAt" TIMESTAMP(3),
    "bugJiraKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ErrorPattern_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AnomalyDetection" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "anomalyType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "aiAnalysis" TEXT,
    "affectedService" TEXT,
    "affectedEndpoint" TEXT,
    "environment" TEXT,
    "baselineValue" DOUBLE PRECISION,
    "observedValue" DOUBLE PRECISION,
    "deviationPercent" DOUBLE PRECISION,
    "sourceId" TEXT,
    "patternId" TEXT,
    "jiraTicketCreated" BOOLEAN NOT NULL DEFAULT false,
    "bugJiraKey" TEXT,
    "slackNotified" BOOLEAN NOT NULL DEFAULT false,
    "canaryNotified" BOOLEAN NOT NULL DEFAULT false,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "acknowledgedBy" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    CONSTRAINT "AnomalyDetection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "LogIntelligenceConfig" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "errorRateThresholdPercent" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
    "errorSpikeMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 2.0,
    "newErrorTypeAlert" BOOLEAN NOT NULL DEFAULT true,
    "autoCreateJiraOnCritical" BOOLEAN NOT NULL DEFAULT true,
    "autoNotifySlack" BOOLEAN NOT NULL DEFAULT true,
    "autoFeedCanary" BOOLEAN NOT NULL DEFAULT true,
    "logRetentionDays" INTEGER NOT NULL DEFAULT 30,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LogIntelligenceConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CanaryHypothesisLibrary" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "errorType" TEXT NOT NULL,
    "messageTemplate" TEXT NOT NULL,
    "endpoint" TEXT,
    "service" TEXT,
    "probeScenario" TEXT NOT NULL,
    "remediationHint" TEXT,
    "sourcePatternId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CanaryHypothesisLibrary_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "LogSource_organizationId_isActive_idx" ON "LogSource"("organizationId", "isActive");
CREATE INDEX IF NOT EXISTS "LogEntry_timestamp_idx" ON "LogEntry"("timestamp" DESC);
CREATE INDEX IF NOT EXISTS "LogEntry_severity_idx" ON "LogEntry"("severity");
CREATE INDEX IF NOT EXISTS "LogEntry_errorType_idx" ON "LogEntry"("errorType");
CREATE INDEX IF NOT EXISTS "LogEntry_deploymentId_idx" ON "LogEntry"("deploymentId");
CREATE INDEX IF NOT EXISTS "LogEntry_patternHash_idx" ON "LogEntry"("patternHash");
CREATE INDEX IF NOT EXISTS "LogEntry_sourceId_timestamp_idx" ON "LogEntry"("sourceId", "timestamp");
CREATE INDEX IF NOT EXISTS "LogEntry_pipelineId_idx" ON "LogEntry"("pipelineId");
CREATE INDEX IF NOT EXISTS "LogEntry_jiraKey_idx" ON "LogEntry"("jiraKey");
CREATE UNIQUE INDEX IF NOT EXISTS "ErrorPattern_organizationId_patternHash_key" ON "ErrorPattern"("organizationId", "patternHash");
CREATE INDEX IF NOT EXISTS "ErrorPattern_status_idx" ON "ErrorPattern"("status");
CREATE INDEX IF NOT EXISTS "ErrorPattern_jiraKey_idx" ON "ErrorPattern"("jiraKey");
CREATE INDEX IF NOT EXISTS "ErrorPattern_organizationId_lastSeen_idx" ON "ErrorPattern"("organizationId", "lastSeen");
CREATE INDEX IF NOT EXISTS "AnomalyDetection_organizationId_detectedAt_idx" ON "AnomalyDetection"("organizationId", "detectedAt");
CREATE INDEX IF NOT EXISTS "AnomalyDetection_severity_acknowledged_idx" ON "AnomalyDetection"("severity", "acknowledged");
CREATE UNIQUE INDEX IF NOT EXISTS "LogIntelligenceConfig_organizationId_key" ON "LogIntelligenceConfig"("organizationId");
CREATE INDEX IF NOT EXISTS "CanaryHypothesisLibrary_organizationId_active_idx" ON "CanaryHypothesisLibrary"("organizationId", "active");
CREATE INDEX IF NOT EXISTS "CanaryHypothesisLibrary_sourcePatternId_idx" ON "CanaryHypothesisLibrary"("sourcePatternId");

ALTER TABLE "LogSource" DROP CONSTRAINT IF EXISTS "LogSource_organizationId_fkey";
ALTER TABLE "LogSource" ADD CONSTRAINT "LogSource_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LogEntry" DROP CONSTRAINT IF EXISTS "LogEntry_sourceId_fkey";
ALTER TABLE "LogEntry" ADD CONSTRAINT "LogEntry_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "LogSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ErrorPattern" DROP CONSTRAINT IF EXISTS "ErrorPattern_organizationId_fkey";
ALTER TABLE "ErrorPattern" ADD CONSTRAINT "ErrorPattern_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AnomalyDetection" DROP CONSTRAINT IF EXISTS "AnomalyDetection_organizationId_fkey";
ALTER TABLE "AnomalyDetection" ADD CONSTRAINT "AnomalyDetection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AnomalyDetection" DROP CONSTRAINT IF EXISTS "AnomalyDetection_sourceId_fkey";
ALTER TABLE "AnomalyDetection" ADD CONSTRAINT "AnomalyDetection_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "LogSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AnomalyDetection" DROP CONSTRAINT IF EXISTS "AnomalyDetection_patternId_fkey";
ALTER TABLE "AnomalyDetection" ADD CONSTRAINT "AnomalyDetection_patternId_fkey" FOREIGN KEY ("patternId") REFERENCES "ErrorPattern"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LogIntelligenceConfig" DROP CONSTRAINT IF EXISTS "LogIntelligenceConfig_organizationId_fkey";
ALTER TABLE "LogIntelligenceConfig" ADD CONSTRAINT "LogIntelligenceConfig_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CanaryHypothesisLibrary" DROP CONSTRAINT IF EXISTS "CanaryHypothesisLibrary_organizationId_fkey";
ALTER TABLE "CanaryHypothesisLibrary" ADD CONSTRAINT "CanaryHypothesisLibrary_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
