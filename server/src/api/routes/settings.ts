import { Router } from "express";
import {
  getPublicCanarySettings,
  loadCanarySettingsFromStore,
  saveCanarySettings,
} from "../../canaryAgent/settingsStore";
import {
  getPublicPipelineSettings,
  loadPipelineSettingsFromStore,
  savePipelineSettings,
} from "../../pipeline/settingsStore";
import { workspaceBillingStore } from "../../billing/workspaceBillingStore";
import { ValidationError } from "../../utils/errors";
import { assertSafeOutboundUrl } from "../../security/assertSafeOutboundUrl";
import {
  requireOrganizationRole,
  requireOrganizationUser,
  withOrganizationContext,
} from "../orgRequestContext";

const router = Router();

const PLAN_IDS = new Set(["pilot", "starter", "growth", "enterprise"]);

router.get("/billing", async (req, res, next) => {
  try {
    const user = requireOrganizationUser(req, res);
    if (!user?.organizationId) return;

    await withOrganizationContext(user.organizationId, async () => {
      const billing = await workspaceBillingStore.get(user.organizationId);
      res.json({ billing });
    });
  } catch (err) {
    next(err);
  }
});

router.put("/billing", async (req, res, next) => {
  try {
    const user = requireOrganizationRole(req, res, ["OWNER"]);
    if (!user?.organizationId) return;

    await withOrganizationContext(user.organizationId, async () => {
      const planId = req.body?.planId ? String(req.body.planId) : undefined;
      if (planId && !PLAN_IDS.has(planId)) {
        throw new ValidationError(`Invalid planId: ${planId}`);
      }
      const billing = await workspaceBillingStore.save(
        {
          planId: planId as "pilot" | "starter" | "growth" | "enterprise" | undefined,
          runsUsed:
            req.body?.runsUsed !== undefined ? Number(req.body.runsUsed) : undefined,
          runsCap: req.body?.runsCap !== undefined ? Number(req.body.runsCap) : undefined,
          pilotEndsAt:
            req.body?.pilotEndsAt !== undefined
              ? req.body.pilotEndsAt
                ? String(req.body.pilotEndsAt)
                : null
              : undefined,
          billingCycle:
            req.body?.billingCycle !== undefined
              ? String(req.body.billingCycle)
              : undefined,
        },
        user.organizationId
      );
      res.json({ billing });
    });
  } catch (err) {
    next(err);
  }
});

router.get("/", (req, res) => {
  const user = requireOrganizationUser(req, res);
  if (!user) return;
  loadCanarySettingsFromStore();
  loadPipelineSettingsFromStore();
  res.json({
    canary: getPublicCanarySettings(),
    pipeline: getPublicPipelineSettings(),
  });
});

router.put("/pipeline", (req, res) => {
  const user = requireOrganizationUser(req, res);
  if (!user) return;
  const threshold =
    req.body?.systemDesignComplexityThreshold !== undefined
      ? Number(req.body.systemDesignComplexityThreshold)
      : undefined;
  const prdConfidenceThreshold =
    req.body?.prdConfidenceThreshold !== undefined
      ? Number(req.body.prdConfidenceThreshold)
      : undefined;
  const implementationConfidenceThreshold =
    req.body?.implementationConfidenceThreshold !== undefined
      ? Number(req.body.implementationConfidenceThreshold)
      : undefined;
  const qaCoverageThreshold =
    req.body?.qaCoverageThreshold !== undefined
      ? Number(req.body.qaCoverageThreshold)
      : undefined;
  const productModel =
    req.body?.productModel !== undefined ? String(req.body.productModel) : undefined;
  const techModel =
    req.body?.techModel !== undefined ? String(req.body.techModel) : undefined;
  const qaModel = req.body?.qaModel !== undefined ? String(req.body.qaModel) : undefined;
  const productModelName =
    req.body?.productModelName !== undefined ? String(req.body.productModelName) : undefined;
  const techModelName =
    req.body?.techModelName !== undefined ? String(req.body.techModelName) : undefined;
  const qaModelName =
    req.body?.qaModelName !== undefined ? String(req.body.qaModelName) : undefined;
  const claudeSkills = Array.isArray(req.body?.claudeSkills) ? req.body.claudeSkills : undefined;
  const productSkillIds = Array.isArray(req.body?.productSkillIds)
    ? req.body.productSkillIds
    : undefined;
  const techSkillIds = Array.isArray(req.body?.techSkillIds) ? req.body.techSkillIds : undefined;
  const qaSkillIds = Array.isArray(req.body?.qaSkillIds) ? req.body.qaSkillIds : undefined;
  const pipeline = savePipelineSettings({
    systemDesignComplexityThreshold: threshold,
    prdConfidenceThreshold,
    implementationConfidenceThreshold,
    qaCoverageThreshold,
    productModel: productModel as "chatgpt" | "grok" | "claude" | undefined,
    techModel: techModel as "chatgpt" | "grok" | "claude" | undefined,
    qaModel: qaModel as "chatgpt" | "grok" | "claude" | undefined,
    productModelName,
    techModelName,
    qaModelName,
    claudeSkills,
    productSkillIds,
    techSkillIds,
    qaSkillIds,
  });
  res.json({ pipeline });
});

router.put("/", (req, res) => {
  const user = requireOrganizationUser(req, res);
  if (!user) return;
  const stagingBaseUrl =
    req.body?.canaryStagingBaseUrl !== undefined
      ? String(req.body.canaryStagingBaseUrl)
      : undefined;
  const productionBaseUrl =
    req.body?.canaryProductionBaseUrl !== undefined
      ? String(req.body.canaryProductionBaseUrl)
      : undefined;
  const authToken =
    req.body?.canaryAuthToken !== undefined
      ? String(req.body.canaryAuthToken)
      : undefined;

  if (stagingBaseUrl) {
    assertSafeOutboundUrl(stagingBaseUrl);
  }
  if (productionBaseUrl) {
    assertSafeOutboundUrl(productionBaseUrl);
  }

  const canary = saveCanarySettings({
    stagingBaseUrl,
    productionBaseUrl,
    authToken,
  });

  res.json({ canary });
});

export default router;
