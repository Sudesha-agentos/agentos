import { Router } from "express";
import { searchBoardByKeyword } from "../../jira-intake/boardSearchService";

const router = Router();

const VALID_SEARCH_IN = new Set(["description", "summary", "both"]);

router.get("/health", (_req, res) => {
  res.json({ ok: true });
});

router.get("/boards/search", async (req, res) => {
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
    const result = await searchBoardByKeyword(keyword, searchIn);
    res.json(result);
  } catch (err) {
    const e = err as Error & { status?: number; body?: unknown };
    const status = e.status && e.status >= 400 ? e.status : 502;
    res.status(status).json({
      error: e.message,
      details: e.body || undefined,
    });
  }
});

export default router;
