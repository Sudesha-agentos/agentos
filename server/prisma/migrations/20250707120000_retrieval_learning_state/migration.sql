-- CreateTable
CREATE TABLE "RetrievalLearningState" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "state" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RetrievalLearningState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RetrievalLearningState_organizationId_key" ON "RetrievalLearningState"("organizationId");

-- CreateIndex
CREATE INDEX "RetrievalLearningState_organizationId_idx" ON "RetrievalLearningState"("organizationId");

-- AddForeignKey
ALTER TABLE "RetrievalLearningState" ADD CONSTRAINT "RetrievalLearningState_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
