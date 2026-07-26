-- LogSource health fields for connection / pull status
ALTER TABLE "LogSource" ADD COLUMN IF NOT EXISTS "lastPullStatus" TEXT;
ALTER TABLE "LogSource" ADD COLUMN IF NOT EXISTS "lastError" TEXT;
ALTER TABLE "LogSource" ADD COLUMN IF NOT EXISTS "lastErrorAt" TIMESTAMP(3);
