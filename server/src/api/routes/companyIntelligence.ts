import { Router, type Request } from "express";
import { companyIntelligence } from "../../companyIntelligence";
import { ValidationError } from "../../utils/errors";
import { assertSafeOutboundUrl } from "../../security/assertSafeOutboundUrl";
import {
  requireOrganizationUser,
  withOrganizationContext as withOrg,
} from "../orgRequestContext";

const router = Router();

function mapCompanyRouteError(err: unknown): unknown {
  if (err instanceof ValidationError) return err;
  if (err instanceof Error) {
    const msg = err.message;
    if (
      msg.includes("Website URL is required") ||
      msg.includes("Could not fetch readable content") ||
      msg.includes("Only http and https") ||
      msg.includes("Only https") ||
      msg.includes("URL host is not allowed") ||
      msg.includes("Enter a valid website URL")
    ) {
      return new ValidationError(msg);
    }
  }
  return err;
}

async function withCompanyOrg(
  req: Request,
  res: import("express").Response,
  fn: (organizationId: string) => Promise<void>
) {
  const user = requireOrganizationUser(req, res);
  if (!user?.organizationId) return;
  await withOrg(user.organizationId, () => fn(user.organizationId!));
}

router.get("/", async (req, res, next) => {
  try {
    await withCompanyOrg(req, res, async (organizationId) => {
      const profile = await companyIntelligence.getProfile(organizationId);
      res.json({ profile });
    });
  } catch (err) {
    next(err);
  }
});

router.put("/", async (req, res, next) => {
  try {
    await withCompanyOrg(req, res, async (organizationId) => {
      const profile = await companyIntelligence.saveProfile(
        {
          companyName: req.body?.companyName,
          website: req.body?.website,
          productSummary: req.body?.productSummary,
          icp: req.body?.icp,
          revenueModel: req.body?.revenueModel,
          pricingSummary: req.body?.pricingSummary,
          businessContext: req.body?.businessContext,
          strategicGoals: req.body?.strategicGoals,
          nonGoals: req.body?.nonGoals,
          competitors: req.body?.competitors,
          updatedBy: req.body?.updatedBy ?? "user",
        },
        organizationId
      );
      res.json({ profile });
    });
  } catch (err) {
    next(err);
  }
});

router.post("/generate-context", async (req, res, next) => {
  try {
    await withCompanyOrg(req, res, async (organizationId) => {
      const hasInput =
        req.body?.companyName ||
        req.body?.productSummary ||
        req.body?.revenueModel ||
        req.body?.businessContext;
      if (!hasInput) {
        throw new ValidationError(
          "Provide at least company name, product summary, or revenue model before generating context."
        );
      }
      const { profile, costUsd, model, vectorHitsUsed, codebaseFilesIndexed, repoLabel } =
        await companyIntelligence.generateContext(
          {
            companyName: req.body?.companyName,
            website: req.body?.website,
            productSummary: req.body?.productSummary,
            icp: req.body?.icp,
            revenueModel: req.body?.revenueModel,
            pricingSummary: req.body?.pricingSummary,
            strategicGoals: req.body?.strategicGoals,
            nonGoals: req.body?.nonGoals,
            updatedBy: req.body?.updatedBy ?? "user",
          },
          organizationId
        );
      res.json({
        profile,
        costUsd,
        model,
        vectorHitsUsed,
        codebaseFilesIndexed,
        repoLabel,
      });
    });
  } catch (err) {
    next(err);
  }
});

router.post("/fetch-from-web", async (req, res, next) => {
  try {
    await withCompanyOrg(req, res, async (organizationId) => {
      const website = String(req.body?.website ?? "").trim();
      if (!website) {
        throw new ValidationError("Website URL is required to auto-fetch company details.");
      }
      assertSafeOutboundUrl(/^https?:\/\//i.test(website) ? website : `https://${website}`);
      const result = await companyIntelligence.fetchFromWeb({
        website,
        companyName: req.body?.companyName,
        organizationId,
        mergeWithProfile: {
        companyName: req.body?.companyName,
        website: req.body?.website,
        productSummary: req.body?.productSummary,
        icp: req.body?.icp,
        revenueModel: req.body?.revenueModel,
        pricingSummary: req.body?.pricingSummary,
        strategicGoals: req.body?.strategicGoals,
        nonGoals: req.body?.nonGoals,
      },
    });
      res.json(result);
    });
  } catch (err) {
    next(mapCompanyRouteError(err));
  }
});

router.post("/fetch-competitors", async (req, res, next) => {
  try {
    await withCompanyOrg(req, res, async (organizationId) => {
      const website = String(req.body?.website ?? "").trim();
      if (!website) {
        throw new ValidationError("Website URL is required to discover competitors.");
      }
      assertSafeOutboundUrl(/^https?:\/\//i.test(website) ? website : `https://${website}`);
      const result = await companyIntelligence.fetchCompetitors({
        website,
        companyName: req.body?.companyName,
        productSummary: req.body?.productSummary,
        organizationId,
        mergeWithProfile: {
        companyName: req.body?.companyName,
        website: req.body?.website,
        productSummary: req.body?.productSummary,
        competitors: req.body?.competitors,
      },
    });
      res.json(result);
    });
  } catch (err) {
    next(err);
  }
});

export default router;
