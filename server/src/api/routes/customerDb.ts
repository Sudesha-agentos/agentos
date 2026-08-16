import { Router } from "express";
import { requireOrganizationUser, withOrganizationContext } from "../orgRequestContext";
import { ValidationError } from "../../utils/errors";
import {
  confirmMigration,
  executeDatabase,
  introspectAndStore,
  migrateDatabase,
  queryDatabase,
  testDatabaseConnection,
} from "../../customerDb/operations";
import {
  createDatabase,
  deleteDatabase,
  getDatabaseRow,
  listDatabases,
  listMigrations,
  listTableCatalog,
  toPublicDatabase,
  updateDatabase,
} from "../../customerDb/store";

const router = Router();

async function withDbOrg(
  req: import("express").Request,
  res: import("express").Response,
  fn: (organizationId: string) => Promise<void>
) {
  const user = requireOrganizationUser(req, res);
  if (!user?.organizationId) return;
  await withOrganizationContext(user.organizationId, () => fn(user.organizationId!));
}

router.get("/", async (req, res, next) => {
  try {
    await withDbOrg(req, res, async (organizationId) => {
      const databases = await listDatabases(organizationId);
      res.json({ databases });
    });
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    await withDbOrg(req, res, async (organizationId) => {
      const database = await createDatabase(organizationId, {
        name: req.body?.name,
        provider: req.body?.provider,
        environment: req.body?.environment ?? "staging",
        host: req.body?.host,
        port: req.body?.port,
        databaseName: req.body?.databaseName ?? req.body?.database,
        username: req.body?.username,
        password: req.body?.password,
        ssl: req.body?.ssl,
        schemaAllowlist: req.body?.schemaAllowlist,
        autoMigrate: req.body?.autoMigrate,
        requireConfirmToApply: req.body?.requireConfirmToApply,
        connectionString: req.body?.connectionString,
      });
      res.status(201).json({ database });
    });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    await withDbOrg(req, res, async (organizationId) => {
      const row = await getDatabaseRow(organizationId, req.params.id);
      const tables = await listTableCatalog(organizationId, req.params.id);
      res.json({ database: toPublicDatabase(row, tables.length), tables });
    });
  } catch (err) {
    next(err);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    await withDbOrg(req, res, async (organizationId) => {
      const database = await updateDatabase(organizationId, req.params.id, {
        name: req.body?.name,
        provider: req.body?.provider,
        environment: req.body?.environment,
        host: req.body?.host,
        port: req.body?.port,
        databaseName: req.body?.databaseName ?? req.body?.database,
        username: req.body?.username,
        password: req.body?.password,
        ssl: req.body?.ssl,
        schemaAllowlist: req.body?.schemaAllowlist,
        autoMigrate: req.body?.autoMigrate,
        requireConfirmToApply: req.body?.requireConfirmToApply,
      });
      res.json({ database });
    });
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    await withDbOrg(req, res, async (organizationId) => {
      await deleteDatabase(organizationId, req.params.id);
      res.json({ ok: true, disconnected: true });
    });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/test", async (req, res, next) => {
  try {
    await withDbOrg(req, res, async (organizationId) => {
      const result = await testDatabaseConnection(organizationId, req.params.id);
      res.json(result);
    });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/introspect", async (req, res, next) => {
  try {
    await withDbOrg(req, res, async (organizationId) => {
      const result = await introspectAndStore(organizationId, req.params.id);
      res.json(result);
    });
  } catch (err) {
    next(err);
  }
});

router.get("/:id/schema", async (req, res, next) => {
  try {
    await withDbOrg(req, res, async (organizationId) => {
      const tables = await listTableCatalog(organizationId, req.params.id);
      res.json({ tables });
    });
  } catch (err) {
    next(err);
  }
});

router.get("/:id/migrations", async (req, res, next) => {
  try {
    await withDbOrg(req, res, async (organizationId) => {
      const migrations = await listMigrations(organizationId, req.params.id);
      res.json({
        migrations: migrations.map((m) => ({
          id: m.id,
          status: m.status,
          sql: m.sql,
          error: m.error,
          pipelineId: m.pipelineId,
          appliedAt: m.appliedAt?.toISOString() ?? null,
          createdAt: m.createdAt.toISOString(),
        })),
      });
    });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/query", async (req, res, next) => {
  try {
    await withDbOrg(req, res, async (organizationId) => {
      const sql = typeof req.body?.sql === "string" ? req.body.sql : "";
      if (!sql.trim()) throw new ValidationError("sql is required");
      const result = await queryDatabase(organizationId, req.params.id, sql);
      res.json(result);
    });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/execute", async (req, res, next) => {
  try {
    await withDbOrg(req, res, async (organizationId) => {
      const sql = typeof req.body?.sql === "string" ? req.body.sql : "";
      if (!sql.trim()) throw new ValidationError("sql is required");
      const result = await executeDatabase(
        organizationId,
        req.params.id,
        sql,
        req.body?.confirm === true
      );
      res.json(result);
    });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/migrate", async (req, res, next) => {
  try {
    await withDbOrg(req, res, async (organizationId) => {
      const sql = typeof req.body?.sql === "string" ? req.body.sql : "";
      if (!sql.trim()) throw new ValidationError("sql is required");
      const result = await migrateDatabase(organizationId, req.params.id, sql, {
        confirm: req.body?.confirm === true,
        pipelineId: typeof req.body?.pipelineId === "string" ? req.body.pipelineId : undefined,
      });
      res.json(result);
    });
  } catch (err) {
    next(err);
  }
});

router.post("/:id/migrations/:migrationId/confirm", async (req, res, next) => {
  try {
    await withDbOrg(req, res, async (organizationId) => {
      const result = await confirmMigration(
        organizationId,
        req.params.id,
        req.params.migrationId
      );
      res.json(result);
    });
  } catch (err) {
    next(err);
  }
});

export default router;
