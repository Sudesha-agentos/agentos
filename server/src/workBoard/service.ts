import { prisma } from "../db/client";
import { requireActiveOrganizationId } from "../organization/orgScope";
import { ValidationError } from "../utils/errors";
import type { PipelineJiraIssue } from "../pipeline/jira/ticketNormalizer";
import { listJiraIssues } from "../jira-sync/issueRepository";
import { getPipelineIntakeMapping } from "../pipeline/jira/intakeConfig";
import { logger } from "../utils/logger";
import { mapJiraStatusToColumnSlug } from "./jiraStatusMap";

export { isJiraMirroredWorkItem, isLocalOnlyWorkItem, mapJiraStatusToColumnSlug } from "./jiraStatusMap";

export const WORK_ITEM_KEY_RE = /^WB-\d+$/i;

export const DEFAULT_COLUMNS = [
  { slug: "backlog", name: "Backlog", sortOrder: 0, isIntake: false },
  { slug: "ready", name: "Ready", sortOrder: 1, isIntake: false },
  { slug: "ai_worker", name: "AI Worker", sortOrder: 2, isIntake: true },
  { slug: "in_progress", name: "In progress", sortOrder: 3, isIntake: false },
  { slug: "review", name: "Review", sortOrder: 4, isIntake: false },
  { slug: "done", name: "Done", sortOrder: 5, isIntake: false },
] as const;

export type WorkItemSource = "excel" | "manual" | "jira";

function labelsFromJson(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v).trim()).filter(Boolean);
}

export function isWorkBoardKey(key: string | null | undefined): boolean {
  return Boolean(key && WORK_ITEM_KEY_RE.test(key.trim()));
}

export type WorkItemWithColumn = {
  id: string;
  organizationId: string;
  boardId: string;
  columnId: string;
  key: string;
  summary: string;
  description: string;
  issueType: string;
  priority: string;
  assignee: string | null;
  labels: string[];
  sortOrder: number;
  source: string;
  createdAt: Date;
  updatedAt: Date;
  column: { id: string; name: string; slug: string; isIntake: boolean; sortOrder: number };
};

function serializeItem(item: {
  id: string;
  organizationId: string;
  boardId: string;
  columnId: string;
  key: string;
  summary: string;
  description: string;
  issueType: string;
  priority: string;
  assignee: string | null;
  labels: unknown;
  sortOrder: number;
  source: string;
  createdAt: Date;
  updatedAt: Date;
  column?: { id: string; name: string; slug: string; isIntake: boolean; sortOrder: number };
}): WorkItemWithColumn {
  return {
    ...item,
    labels: labelsFromJson(item.labels),
    column: item.column ?? {
      id: item.columnId,
      name: "",
      slug: "",
      isIntake: false,
      sortOrder: 0,
    },
  };
}

export async function getWorkBoardStatus(organizationId?: string): Promise<{
  ready: boolean;
  itemCount: number;
  boardId: string | null;
}> {
  const orgId = organizationId ?? requireActiveOrganizationId();
  const board = await prisma.workBoard.findUnique({
    where: { organizationId: orgId },
    select: { id: true, _count: { select: { items: true } } },
  });
  const itemCount = board?._count.items ?? 0;
  return {
    ready: itemCount > 0,
    itemCount,
    boardId: board?.id ?? null,
  };
}

export async function getOrCreateWorkBoard(organizationId?: string) {
  const orgId = organizationId ?? requireActiveOrganizationId();
  const existing = await prisma.workBoard.findUnique({
    where: { organizationId: orgId },
    include: {
      columns: { orderBy: { sortOrder: "asc" } },
      items: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
    },
  });
  if (existing) return existing;

  return prisma.workBoard.create({
    data: {
      organizationId: orgId,
      title: "Work board",
      columns: {
        create: DEFAULT_COLUMNS.map((col) => ({
          name: col.name,
          slug: col.slug,
          sortOrder: col.sortOrder,
          isIntake: col.isIntake,
        })),
      },
    },
    include: {
      columns: { orderBy: { sortOrder: "asc" } },
      items: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
    },
  });
}

export function serializeBoard(board: Awaited<ReturnType<typeof getOrCreateWorkBoard>>) {
  const itemsByColumn = new Map<string, ReturnType<typeof serializeItem>[]>();
  for (const col of board.columns) itemsByColumn.set(col.id, []);
  for (const item of board.items) {
    const col = board.columns.find((c) => c.id === item.columnId);
    const list = itemsByColumn.get(item.columnId) ?? [];
    list.push(serializeItem({ ...item, column: col }));
    itemsByColumn.set(item.columnId, list);
  }

  return {
    id: board.id,
    title: board.title,
    nextKeyNumber: board.nextKeyNumber,
    columns: board.columns.map((col) => ({
      id: col.id,
      name: col.name,
      slug: col.slug,
      sortOrder: col.sortOrder,
      isIntake: col.isIntake,
      items: itemsByColumn.get(col.id) ?? [],
    })),
  };
}

export async function findWorkItemByKey(
  key: string,
  organizationId?: string
): Promise<WorkItemWithColumn | null> {
  const orgId = organizationId ?? requireActiveOrganizationId();
  const normalized = key.trim().toUpperCase();
  const item = await prisma.workItem.findUnique({
    where: { organizationId_key: { organizationId: orgId, key: normalized } },
    include: { column: true },
  });
  return item ? serializeItem(item) : null;
}

export function workItemToPipelineIssue(item: WorkItemWithColumn): PipelineJiraIssue {
  return {
    id: item.id,
    key: item.key,
    fields: {
      summary: item.summary,
      description: item.description,
      issuetype: { name: item.issueType || "Task" },
      priority: { name: item.priority || "Medium" },
      reporter: { displayName: item.assignee || "Work board" },
      assignee: item.assignee ? { displayName: item.assignee } : null,
      labels: item.labels,
      created: item.createdAt.toISOString(),
      project: { key: "WB" },
      status: { name: item.column.name } as { name?: string },
    } as PipelineJiraIssue["fields"] & { status?: { name?: string } },
  };
}

export async function findWorkItemIssue(key: string): Promise<{
  issue: PipelineJiraIssue;
  item: WorkItemWithColumn;
  isIntake: boolean;
} | null> {
  const item = await findWorkItemByKey(key);
  if (!item) return null;
  return {
    issue: workItemToPipelineIssue(item),
    item,
    isIntake: item.column.isIntake,
  };
}

async function nextSortOrder(columnId: string): Promise<number> {
  const last = await prisma.workItem.findFirst({
    where: { columnId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });
  return (last?.sortOrder ?? -1) + 1;
}

export async function createWorkItem(input: {
  summary: string;
  description?: string;
  issueType?: string;
  priority?: string;
  assignee?: string | null;
  labels?: string[];
  columnId?: string;
  source?: WorkItemSource;
}) {
  const orgId = requireActiveOrganizationId();
  const summary = input.summary.trim();
  if (!summary) throw new ValidationError("Title is required");

  const board = await getOrCreateWorkBoard(orgId);
  const column =
    board.columns.find((c) => c.id === input.columnId) ??
    board.columns.find((c) => c.slug === "backlog") ??
    board.columns[0];
  if (!column) throw new ValidationError("Work board has no columns");

  const issueType = normalizeIssueType(input.issueType);
  const updated = await prisma.$transaction(async (tx) => {
    const allocated = await tx.workBoard.update({
      where: { id: board.id },
      data: { nextKeyNumber: { increment: 1 } },
      select: { nextKeyNumber: true },
    });
    const key = `WB-${allocated.nextKeyNumber - 1}`;
    const sortOrder = await nextSortOrder(column.id);
    return tx.workItem.create({
      data: {
        organizationId: orgId,
        boardId: board.id,
        columnId: column.id,
        key,
        summary,
        description: input.description?.trim() ?? "",
        issueType,
        priority: input.priority?.trim() || "Medium",
        assignee: input.assignee?.trim() || null,
        labels: input.labels ?? [],
        sortOrder,
        source: input.source ?? "manual",
      },
      include: { column: true },
    });
  });

  return serializeItem(updated);
}

export async function updateWorkItem(
  itemId: string,
  patch: {
    summary?: string;
    description?: string;
    issueType?: string;
    priority?: string;
    assignee?: string | null;
    labels?: string[];
    columnId?: string;
    sortOrder?: number;
  }
) {
  const orgId = requireActiveOrganizationId();
  const existing = await prisma.workItem.findFirst({
    where: { id: itemId, organizationId: orgId },
    include: { column: true },
  });
  if (!existing) throw new ValidationError("Work item not found");

  let columnId = existing.columnId;
  if (patch.columnId && patch.columnId !== existing.columnId) {
    const col = await prisma.workBoardColumn.findFirst({
      where: { id: patch.columnId, boardId: existing.boardId },
    });
    if (!col) throw new ValidationError("Column not found on this board");
    columnId = col.id;
  }

  const updated = await prisma.workItem.update({
    where: { id: existing.id },
    data: {
      summary: patch.summary?.trim() || existing.summary,
      description: patch.description !== undefined ? patch.description : existing.description,
      issueType: patch.issueType ? normalizeIssueType(patch.issueType) : existing.issueType,
      priority: patch.priority?.trim() || existing.priority,
      assignee: patch.assignee !== undefined ? patch.assignee?.trim() || null : existing.assignee,
      labels: patch.labels ?? undefined,
      columnId,
      sortOrder:
        patch.sortOrder !== undefined
          ? patch.sortOrder
          : columnId !== existing.columnId
            ? await nextSortOrder(columnId)
            : existing.sortOrder,
    },
    include: { column: true },
  });

  return serializeItem(updated);
}

export async function moveWorkItemByKey(key: string, columnSlug: string): Promise<void> {
  const item = await findWorkItemByKey(key);
  if (!item) return;
  const column = await prisma.workBoardColumn.findFirst({
    where: { boardId: item.boardId, slug: columnSlug },
  });
  if (!column || column.id === item.columnId) return;
  await prisma.workItem.update({
    where: { id: item.id },
    data: { columnId: column.id, sortOrder: await nextSortOrder(column.id) },
  });
}

export type JiraBoardIssueInput = {
  jiraKey: string;
  summary: string;
  description?: string;
  issueType?: string;
  priority?: string | null;
  assignee?: string | null;
  labels?: string[];
  status: string;
};

/**
 * Mirror a Jira issue onto the work board using the Jira key (not WB-n).
 * Jira status is source of truth for the column. Does not start Virin.
 */
export async function upsertWorkItemFromJiraIssue(
  issue: JiraBoardIssueInput,
  options?: { deleted?: boolean; organizationId?: string }
): Promise<void> {
  const orgId = options?.organizationId ?? requireActiveOrganizationId();
  const key = issue.jiraKey.trim().toUpperCase();
  if (!key) return;

  if (options?.deleted) {
    await prisma.workItem.deleteMany({
      where: { organizationId: orgId, key, source: "jira" },
    });
    return;
  }

  let board = await prisma.workBoard.findUnique({
    where: { organizationId: orgId },
    include: { columns: { orderBy: { sortOrder: "asc" } } },
  });
  if (!board) {
    const created = await getOrCreateWorkBoard(orgId);
    board = created;
  }
  const existing = await prisma.workItem.findUnique({
    where: { organizationId_key: { organizationId: orgId, key } },
  });

  if (existing && existing.source !== "jira") {
    logger.warn(
      { key, source: existing.source },
      "skipping jira board mirror — key already used by a local work item"
    );
    return;
  }

  const mapping = getPipelineIntakeMapping();
  const intakeStatuses = [
    mapping.aiWorkerColumnName,
    ...mapping.aiWorkerStatuses,
  ].filter(Boolean);
  const column = resolveColumnFromJiraStatus(board.columns, issue.status, intakeStatuses);
  if (!column) return;

  const summary = issue.summary.trim() || key;
  const description = issue.description ?? "";
  const issueType = (issue.issueType?.trim() || "Task").slice(0, 40);
  const priority = issue.priority?.trim() || "Medium";
  const assignee = issue.assignee?.trim() || null;
  const labels = issue.labels ?? [];

  if (existing) {
    const moving = existing.columnId !== column.id;
    await prisma.workItem.update({
      where: { id: existing.id },
      data: {
        summary,
        description,
        issueType,
        priority,
        assignee,
        labels,
        source: "jira",
        columnId: column.id,
        sortOrder: moving ? await nextSortOrder(column.id) : existing.sortOrder,
      },
    });
    return;
  }

  await prisma.workItem.create({
    data: {
      organizationId: orgId,
      boardId: board.id,
      columnId: column.id,
      key,
      summary,
      description,
      issueType,
      priority,
      assignee,
      labels,
      source: "jira",
      sortOrder: await nextSortOrder(column.id),
    },
  });
}

export async function removeJiraMirroredWorkItem(
  key: string,
  organizationId?: string
): Promise<void> {
  const orgId = organizationId ?? requireActiveOrganizationId();
  await prisma.workItem.deleteMany({
    where: {
      organizationId: orgId,
      key: key.trim().toUpperCase(),
      source: "jira",
    },
  });
}

/** Place every stored JiraIssue onto the work board (covers tickets unchanged since last incremental). */
export async function backfillWorkBoardFromJiraIssues(
  organizationId?: string
): Promise<{ mirrored: number; removed: number }> {
  const orgId = organizationId ?? requireActiveOrganizationId();
  const pageSize = 200;
  let offset = 0;
  let mirrored = 0;
  let removed = 0;

  for (;;) {
    const { items } = await listJiraIssues({
      organizationId: orgId,
      limit: pageSize,
      offset,
      includeDeleted: true,
    });
    if (items.length === 0) break;

    for (const issue of items) {
      const labels = Array.isArray(issue.labels)
        ? (issue.labels as unknown[]).map((v) => String(v).trim()).filter(Boolean)
        : [];
      await upsertWorkItemFromJiraIssue(
        {
          jiraKey: issue.jiraKey,
          summary: issue.summary,
          description: issue.description,
          issueType: issue.issueType,
          priority: issue.priority,
          assignee: issue.assignee,
          labels,
          status: issue.status,
        },
        { deleted: issue.isDeleted, organizationId: orgId }
      );
      if (issue.isDeleted) removed += 1;
      else mirrored += 1;
    }

    offset += items.length;
    if (items.length < pageSize) break;
  }

  return { mirrored, removed };
}

export function normalizeIssueType(value?: string): string {
  const v = value?.trim().toLowerCase() ?? "task";
  if (v === "bug") return "Bug";
  return "Task";
}

export type ImportRowInput = {
  key?: string;
  title: string;
  description?: string;
  status?: string;
  type?: string;
  priority?: string;
  assignee?: string;
  labels?: string[];
  rowNumber: number;
};

export async function commitImportRows(rows: ImportRowInput[]) {
  const orgId = requireActiveOrganizationId();
  const board = await getOrCreateWorkBoard(orgId);
  const created: WorkItemWithColumn[] = [];
  const updated: WorkItemWithColumn[] = [];
  const intakeKeys: string[] = [];
  const warnings: string[] = [];

  for (const row of rows) {
    const title = row.title.trim();
    if (!title) {
      warnings.push(`Row ${row.rowNumber}: skipped — empty title`);
      continue;
    }
    const column = resolveColumn(board.columns, row.status);
    if (row.status?.trim() && column.slug === "backlog" && !matchColumn(board.columns, row.status)) {
      warnings.push(`Row ${row.rowNumber}: unknown status "${row.status}" — placed in Backlog`);
    }

    const existingKey = row.key?.trim().toUpperCase();
    if (existingKey && isWorkBoardKey(existingKey)) {
      const existing = await prisma.workItem.findUnique({
        where: { organizationId_key: { organizationId: orgId, key: existingKey } },
        include: { column: true },
      });
      if (existing) {
        const saved = await prisma.workItem.update({
          where: { id: existing.id },
          data: {
            summary: title,
            description: row.description?.trim() ?? existing.description,
            issueType: normalizeIssueType(row.type),
            priority: row.priority?.trim() || existing.priority,
            assignee: row.assignee?.trim() || existing.assignee,
            labels: row.labels ?? labelsFromJson(existing.labels),
            columnId: column.id,
          },
          include: { column: true },
        });
        const serialized = serializeItem(saved);
        updated.push(serialized);
        if (serialized.column.isIntake) intakeKeys.push(serialized.key);
        continue;
      }
    }

    const item = await createWorkItem({
      summary: title,
      description: row.description,
      issueType: row.type,
      priority: row.priority,
      assignee: row.assignee,
      labels: row.labels,
      columnId: column.id,
      source: "excel",
    });
    created.push(item);
    if (item.column.isIntake) intakeKeys.push(item.key);
  }

  return {
    created: created.length,
    updated: updated.length,
    intakeKeys,
    warnings,
    items: [...created, ...updated],
  };
}

function matchColumn<T extends { name: string; slug: string }>(
  columns: T[],
  status: string
): T | undefined {
  const needle = status.trim().toLowerCase();
  return columns.find(
    (c) => c.name.toLowerCase() === needle || c.slug.replace(/_/g, " ") === needle
  );
}

function resolveColumn(
  columns: Array<{ id: string; name: string; slug: string; isIntake: boolean }>,
  status?: string
) {
  if (status?.trim()) {
    const matched = matchColumn(columns, status);
    if (matched) return matched;
  }
  return columns.find((c) => c.slug === "backlog") ?? columns[0];
}

function resolveColumnFromJiraStatus(
  columns: Array<{ id: string; name: string; slug: string; isIntake: boolean }>,
  status: string,
  intakeStatuses: string[] = []
) {
  const matched = status.trim() ? matchColumn(columns, status) : undefined;
  if (matched) return matched;
  const slug = mapJiraStatusToColumnSlug(status, intakeStatuses);
  return columns.find((c) => c.slug === slug) ?? columns.find((c) => c.slug === "backlog") ?? columns[0];
}
