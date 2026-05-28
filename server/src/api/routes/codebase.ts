import { Router } from "express";
import { codebaseQueryService } from "../../codebaseIntelligence/queryService";

const router = Router();

router.post("/search", async (req, res, next) => {
  try {
    const { query, branchName = "main", topK, similarityThreshold } = req.body ?? {};
    if (!query || typeof query !== "string") {
      res.status(400).json({ error: "query_required" });
      return;
    }
    const data = await codebaseQueryService.searchCodebaseSemantically({
      query,
      branchName,
      topK,
      similarityThreshold,
    });
    res.json({ results: data });
  } catch (err) {
    next(err);
  }
});

router.get("/file", async (req, res, next) => {
  try {
    const filePath = String(req.query.path ?? "");
    const branchName = String(req.query.branch ?? "main");
    if (!filePath) {
      res.status(400).json({ error: "path_required" });
      return;
    }
    const file = await codebaseQueryService.getFileWithContext(branchName, filePath);
    res.json({ file });
  } catch (err) {
    next(err);
  }
});

router.get("/feature", async (req, res, next) => {
  try {
    const pattern = String(req.query.pattern ?? "");
    const branchName = String(req.query.branch ?? "main");
    if (!pattern) {
      res.status(400).json({ error: "pattern_required" });
      return;
    }
    const files = await codebaseQueryService.getFilesTouchingFeature(pattern, branchName);
    res.json({ files });
  } catch (err) {
    next(err);
  }
});

router.get("/changes", async (req, res, next) => {
  try {
    const branchName = String(req.query.branch ?? "main");
    const limit = Number(req.query.limit ?? 20);
    const changes = await codebaseQueryService.getRecentChanges(branchName, limit);
    res.json({ changes });
  } catch (err) {
    next(err);
  }
});

router.get("/branches", async (_req, res, next) => {
  try {
    const branches = await codebaseQueryService.getBranchHistory();
    res.json({ branches });
  } catch (err) {
    next(err);
  }
});

export default router;
