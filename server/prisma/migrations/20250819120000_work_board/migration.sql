-- Org-scoped Kanban board for spreadsheet / non-Jira intake.

CREATE TABLE IF NOT EXISTS "WorkBoard" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Work board',
    "nextKeyNumber" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkBoard_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WorkBoard_organizationId_key" ON "WorkBoard"("organizationId");

CREATE TABLE IF NOT EXISTS "WorkBoardColumn" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "isIntake" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "WorkBoardColumn_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WorkBoardColumn_boardId_slug_key" ON "WorkBoardColumn"("boardId", "slug");
CREATE INDEX IF NOT EXISTS "WorkBoardColumn_boardId_sortOrder_idx" ON "WorkBoardColumn"("boardId", "sortOrder");

CREATE TABLE IF NOT EXISTS "WorkItem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "columnId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "issueType" TEXT NOT NULL DEFAULT 'Task',
    "priority" TEXT NOT NULL DEFAULT 'Medium',
    "assignee" TEXT,
    "labels" JSONB NOT NULL DEFAULT '[]',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WorkItem_organizationId_key_key" ON "WorkItem"("organizationId", "key");
CREATE INDEX IF NOT EXISTS "WorkItem_organizationId_idx" ON "WorkItem"("organizationId");
CREATE INDEX IF NOT EXISTS "WorkItem_boardId_columnId_sortOrder_idx" ON "WorkItem"("boardId", "columnId", "sortOrder");

ALTER TABLE "WorkBoard"
  ADD CONSTRAINT "WorkBoard_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkBoardColumn"
  ADD CONSTRAINT "WorkBoardColumn_boardId_fkey"
  FOREIGN KEY ("boardId") REFERENCES "WorkBoard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkItem"
  ADD CONSTRAINT "WorkItem_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkItem"
  ADD CONSTRAINT "WorkItem_boardId_fkey"
  FOREIGN KEY ("boardId") REFERENCES "WorkBoard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkItem"
  ADD CONSTRAINT "WorkItem_columnId_fkey"
  FOREIGN KEY ("columnId") REFERENCES "WorkBoardColumn"("id") ON DELETE CASCADE ON UPDATE CASCADE;
