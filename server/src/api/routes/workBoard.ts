import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import {
  requireOrganizationUser,
  withOrganizationContext,
} from "../orgRequestContext";
import { ValidationError } from "../../utils/errors";
import { tryIntakeEnqueue } from "../../pipeline/jira/intakeOrchestrator";
import {
  createWorkItem,
  getOrCreateWorkBoard,
  getWorkBoardStatus,
  serializeBoard,
  updateWorkItem,
  commitImportRows,
} from "../../workBoard/service";
import {
  buildTemplateCsv,
  buildTemplateXlsx,
  parseSpreadsheetBuffer,
} from "../../workBoard/spreadsheet";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const createItemSchema = z.object({
  summary: z.string().min(1).max(300),
  description: z.string().max(20_000).optional(),
  issueType: z.string().max(40).optional(),
  priority: z.string().max(40).optional(),
  assignee: z.string().max(120).nullable().optional(),
  labels: z.array(z.string().max(40)).max(20).optional(),
  columnId: z.string().min(1).optional(),
});

const updateItemSchema = z.object({
  summary: z.string().min(1).max(300).optional(),
  description: z.string().max(20_000).optional(),
  issueType: z.string().max(40).optional(),
  priority: z.string().max(40).optional(),
  assignee: z.string().max(120).nullable().optional(),
  labels: z.array(z.string().max(40)).max(20).optional(),
  columnId: z.string().min(1).optional(),
  sortOrder: z.number().int().optional(),
});

router.get("/status", async (req, res, next) => {
  try {
    const user = requireOrganizationUser(req, res);
    if (!user?.organizationId) return;
    await withOrganizationContext(user.organizationId, async () => {
      res.json(await getWorkBoardStatus(user.organizationId!));
    });
  } catch (err) {
    next(err);
  }
});

router.get("/", async (req, res, next) => {
  try {
    const user = requireOrganizationUser(req, res);
    if (!user?.organizationId) return;
    await withOrganizationContext(user.organizationId, async () => {
      const board = await getOrCreateWorkBoard(user.organizationId!);
      res.json(serializeBoard(board));
    });
  } catch (err) {
    next(err);
  }
});

router.get("/template.xlsx", async (req, res, next) => {
  try {
    const user = requireOrganizationUser(req, res);
    if (!user?.organizationId) return;
    const buf = await buildTemplateXlsx();
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", 'attachment; filename="agentox-work-board.xlsx"');
    res.send(buf);
  } catch (err) {
    next(err);
  }
});

router.get("/template.csv", async (req, res, next) => {
  try {
    const user = requireOrganizationUser(req, res);
    if (!user?.organizationId) return;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="agentox-work-board.csv"');
    res.send(buildTemplateCsv());
  } catch (err) {
    next(err);
  }
});

router.post("/import", upload.single("file"), async (req, res, next) => {
  try {
    const user = requireOrganizationUser(req, res);
    if (!user?.organizationId) return;
    const file = req.file;
    if (!file?.buffer) {
      throw new ValidationError("Choose an .xlsx or .csv file to upload.");
    }

    const parsed = await parseSpreadsheetBuffer(file.buffer, file.originalname || "upload.xlsx");
    const confirm =
      String(req.query.confirm ?? "") === "1" || String(req.body?.confirm ?? "") === "true";

    if (!confirm) {
      res.json({
        preview: true,
        filename: file.originalname,
        headers: parsed.headers,
        mapping: parsed.mapping,
        errors: parsed.errors,
        count: parsed.rows.length,
        rows: parsed.rows.slice(0, 50),
      });
      return;
    }

    await withOrganizationContext(user.organizationId, async () => {
      const result = await commitImportRows(parsed.rows);
      const intake = { attempted: result.intakeKeys.length, started: 0, errors: [] as string[] };
      for (const key of result.intakeKeys) {
        try {
          const enq = await tryIntakeEnqueue(key, "manual");
          if (enq.started || enq.enqueued > 0) intake.started += 1;
        } catch (err) {
          intake.errors.push(
            `${key}: ${err instanceof Error ? err.message : "intake failed"}`
          );
        }
      }
      const board = await getOrCreateWorkBoard(user.organizationId!);
      res.json({
        preview: false,
        created: result.created,
        updated: result.updated,
        warnings: [...parsed.errors, ...result.warnings],
        intake,
        board: serializeBoard(board),
      });
    });
  } catch (err) {
    next(err);
  }
});

router.post("/items", async (req, res, next) => {
  try {
    const user = requireOrganizationUser(req, res);
    if (!user?.organizationId) return;
    const body = createItemSchema.parse(req.body);
    await withOrganizationContext(user.organizationId, async () => {
      const item = await createWorkItem(body);
      res.json(item);
    });
  } catch (err) {
    next(err);
  }
});

router.patch("/items/:itemId", async (req, res, next) => {
  try {
    const user = requireOrganizationUser(req, res);
    if (!user?.organizationId) return;
    const body = updateItemSchema.parse(req.body);
    await withOrganizationContext(user.organizationId, async () => {
      const item = await updateWorkItem(req.params.itemId, body);
      res.json(item);
    });
  } catch (err) {
    next(err);
  }
});

router.post("/items/:itemId/intake", async (req, res, next) => {
  try {
    const user = requireOrganizationUser(req, res);
    if (!user?.organizationId) return;
    await withOrganizationContext(user.organizationId, async () => {
      const board = await getOrCreateWorkBoard(user.organizationId!);
      const item = board.items.find((i) => i.id === req.params.itemId);
      if (!item) throw new ValidationError("Work item not found");
      const intakeCol = board.columns.find((c) => c.isIntake);
      if (intakeCol && item.columnId !== intakeCol.id) {
        await updateWorkItem(item.id, { columnId: intakeCol.id });
      }
      const result = await tryIntakeEnqueue(item.key, "manual");
      const fresh = await getOrCreateWorkBoard(user.organizationId!);
      res.json({ intake: result, board: serializeBoard(fresh) });
    });
  } catch (err) {
    next(err);
  }
});

export default router;
