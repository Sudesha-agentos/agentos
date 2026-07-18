import { Router } from "express";
import { getOssToolStatus } from "../../integrations/ossStatus";
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

export default router;
