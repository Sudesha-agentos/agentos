import { Router } from "express";
import { searchBoardByKeyword } from "../../jira-intake/boardSearchService";
import { isPipelineJiraConfigured } from "../../pipeline/jira/credentialsStore";
import { ValidationError } from "../../utils/errors";
import {
  requireOrganizationUser,
  withOrganizationContext,
} from "../orgRequestContext";

const router = Router();

const VALID_SEARCH_IN = new Set(["description", "summary", "both"]);

router.get("/health", (_req, res) => {
  res.json({ ok: true });
});

router.get("/boards/search", async (req, res, next) => {
  const user = requireOrganizationUser(req, res);
  if (!user?.organizationId) return;

  const keyword = String(req.query.keyword || "").trim();
  const searchIn = String(req.query.searchIn || "description").toLowerCase();

  if (!keyword) {
    res.status(400).json({ error: "Query parameter 'keyword' is required" });
    return;
  }

  if (!VALID_SEARCH_IN.has(searchIn)) {
    res.status(400).json({
      error: "searchIn must be one of: description, summary, both",
    });
    return;
  }

  try {
    await withOrganizationContext(user.organizationId, async () => {
      if (!isPipelineJiraConfigured()) {
        throw new ValidationError(
          "Jira is not connected. Connect Jira in Settings → Integrations first."
        );
      }
      const result = await searchBoardByKeyword(keyword, searchIn);
      res.json(result);
    });
  } catch (err) {
    next(err);
  }
});

export default router;
