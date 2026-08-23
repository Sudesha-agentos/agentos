import { Router } from "express";
import { getOssToolStatus } from "../../integrations/ossStatus";
import { publicWorkspaceCatalog, getWorkspaceProvider } from "../../integrations/workspaceConnections/catalog";
import {
  deleteWorkspaceConnection,
  listWorkspaceConnections,
  upsertWorkspaceConnection,
} from "../../integrations/workspaceConnections/store";
import { validateWorkspaceConfig } from "../../integrations/workspaceConnections/validate";
import {
  requireOrganizationUser,
  withOrganizationContext,
} from "../orgRequestContext";

const router = Router();

/**
 * Host capability probe for OSS CLI adapters (Semgrep, Playwright, Locust, ZAP, …).
 * Auth required so it is not a public fingerprinting endpoint.
 */
router.get("/oss-status", async (req, res, next) => {
  try {
    const user = requireOrganizationUser(req, res);
    if (!user?.organizationId) return;

    await withOrganizationContext(user.organizationId, async () => {
      const status = await getOssToolStatus();
      res.json({
        ...status,
        timestamp: new Date().toISOString(),
      });
    });
  } catch (err) {
    next(err);
  }
});

router.get("/workspace/catalog", (_req, res) => {
  res.json({ catalog: publicWorkspaceCatalog() });
});

router.get("/workspace", async (req, res, next) => {
  try {
    const user = requireOrganizationUser(req, res);
    if (!user?.organizationId) return;
    await withOrganizationContext(user.organizationId, async () => {
      const connections = await listWorkspaceConnections(user.organizationId!);
      res.json({ connections });
    });
  } catch (err) {
    next(err);
  }
});

router.post("/workspace/:provider/validate", async (req, res, next) => {
  try {
    const user = requireOrganizationUser(req, res);
    if (!user?.organizationId) return;
    const provider = String(req.params.provider ?? "").trim();
    if (!getWorkspaceProvider(provider)) {
      res.status(404).json({ error: "unknown_provider", message: `Unknown integration: ${provider}` });
      return;
    }
    const result = await validateWorkspaceConfig(provider, req.body?.config ?? req.body);
    if (!result.valid) {
      res.status(400).json({
        error: "invalid_connection",
        message: result.error,
      });
      return;
    }
    res.json({ ok: true, metadata: result.metadata ?? {} });
  } catch (err) {
    next(err);
  }
});

router.post("/workspace/:provider", async (req, res, next) => {
  try {
    const user = requireOrganizationUser(req, res);
    if (!user?.organizationId) return;
    const provider = String(req.params.provider ?? "").trim();
    await withOrganizationContext(user.organizationId, async () => {
      const connection = await upsertWorkspaceConnection(
        user.organizationId!,
        provider,
        req.body?.config ?? req.body,
        req.body?.displayName
      );
      res.status(201).json({ connection });
    });
  } catch (err) {
    next(err);
  }
});

router.delete("/workspace/:provider", async (req, res, next) => {
  try {
    const user = requireOrganizationUser(req, res);
    if (!user?.organizationId) return;
    const provider = String(req.params.provider ?? "").trim();
    await withOrganizationContext(user.organizationId, async () => {
      const deleted = await deleteWorkspaceConnection(user.organizationId!, provider);
      res.json({ deleted });
    });
  } catch (err) {
    next(err);
  }
});

export default router;
