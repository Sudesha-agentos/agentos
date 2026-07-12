import { Router } from "express";
import { getCodebaseInsights } from "../../codebaseIntelligence/insightsService";
import { getCodebaseLayerStatus } from "../../codebaseIntelligence/layerStatus";
import { codebaseQueryService } from "../../codebaseIntelligence/queryService";
import {
  getDirectoryListing,
  getFileConnections,
} from "../../codebaseIntelligence/directoryService";
import { askCodebaseQuestion } from "../../codebaseIntelligence/codebaseAskService";
import {
  checkAskRateLimit,
  clientKeyFromRequest,
} from "../../codebaseIntelligence/askRateLimit";
import { searchCodebase } from "../../codebaseIntelligence/searchService";
import { buildEnrichedCodebaseContext } from "../../codebaseIntelligence/enrichedContextService";
import { visualizationCache } from "../../codebaseIntelligence/visualizationCache";
import { visualizationService } from "../../codebaseIntelligence/visualizationService";
import { getTour, generateTour } from "../../codebaseIntelligence/tourService";
import { checkTourGenerateRateLimit } from "../../codebaseIntelligence/tourRateLimit";
import { resolveRepoScope } from "../../codebaseIntelligence/repoScope";
import {
  getCodebaseHealth,
  getHealthDrift,
  getHealthTimeline,
} from "../../codebaseIntelligence/healthService";
import { analyzeImpact } from "../../codebaseIntelligence/impactService";
import { checkImpactRateLimit } from "../../codebaseIntelligence/impactRateLimit";
import {
  generateKnowledge,
  getArchitectureDoc,
  getComponentGuide,
  getKnowledge,
  getRunbook,
} from "../../codebaseIntelligence/knowledgeService";
import { checkKnowledgeGenerateRateLimit } from "../../codebaseIntelligence/knowledgeRateLimit";
import { bindOrganizationContextMiddleware } from "../orgRequestContext";
import {
  gnContext,
  gnCypher,
  gnDetectChanges,
  gnGraphPayload,
  gnImpact,
  gnListRepos,
  gnQuery,
  gnRename,
  gnResources,
  generateGitNexusWiki,
  runGitNexusAnalyzeForScope,
  graphStatus as gnGraphStatus,
} from "../../codebaseIntelligence/gitnexus";

const router = Router();

router.use(bindOrganizationContextMiddleware);

router.get("/status", async (req, res, next) => {
  try {
    const branchName =
      typeof req.query.branch === "string" && req.query.branch.trim()
        ? req.query.branch.trim()
        : undefined;
    const status = await getCodebaseLayerStatus(branchName);
    res.json(status);
  } catch (err) {
    next(err);
  }
});

router.get("/insights", async (req, res, next) => {
  try {
    const branchName = String(req.query.branch ?? "main");
    const insights = await getCodebaseInsights(branchName);
    res.json(insights);
  } catch (err) {
    next(err);
  }
});

router.get("/visualization", async (req, res, next) => {
  try {
    const branchName = String(req.query.branch ?? "main");
    const refresh = req.query.refresh === "true";
    let layout = refresh
      ? await visualizationCache.refresh(branchName)
      : await visualizationCache.get(branchName);

    if (!layout) {
      if (refresh) {
        layout = await visualizationCache.refresh(branchName);
      } else {
        res.json({
          nodes: [],
          edges: [],
          districts: [],
          tourSteps: [],
          meta: {
            totalFiles: 0,
            layoutKind: "treemap",
            pending: true,
            message: "Map not built yet — open after indexing completes or pass refresh=true",
          },
        });
        return;
      }
    }

    res.json(layout);
  } catch (err) {
    next(err);
  }
});

router.get("/visualization/file", async (req, res, next) => {
  try {
    const branchName = String(req.query.branch ?? "main");
    const filePath = String(req.query.path ?? "");
    if (!filePath) {
      res.status(400).json({ error: "path_required" });
      return;
    }
    const interior = await visualizationService.getFileInterior(branchName, filePath);
    res.json(interior);
  } catch (err) {
    next(err);
  }
});

router.post("/ask", async (req, res, next) => {
  try {
    const rate = checkAskRateLimit(clientKeyFromRequest(req));
    if (!rate.allowed) {
      res.status(429).json({
        error: "rate_limit_exceeded",
        message: `Too many ask requests. Try again in ${rate.retryAfterSec} seconds.`,
        retryAfterSec: rate.retryAfterSec,
      });
      return;
    }

    const { question, branchName = "main" } = req.body ?? {};
    if (!question || typeof question !== "string") {
      res.status(400).json({ error: "question_required" });
      return;
    }
    const result = await askCodebaseQuestion({ question, branchName });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get("/search", async (req, res, next) => {
  try {
    const query = String(req.query.q ?? "").trim();
    const branchName = String(req.query.branch ?? "main");
    const enriched = req.query.enriched === "true" || req.query.enriched === "1";
    if (!query) {
      res.status(400).json({ error: "query_required" });
      return;
    }
    if (enriched) {
      const bundle = await buildEnrichedCodebaseContext({
        query,
        branchName,
        fetchFreshContent: true,
      });
      res.json(bundle);
      return;
    }
    const data = await searchCodebase({ query, branchName });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.post("/search", async (req, res, next) => {
  try {
    const { query, branchName = "main", enriched = false } = req.body ?? {};
    if (!query || typeof query !== "string") {
      res.status(400).json({ error: "query_required" });
      return;
    }
    if (enriched) {
      const bundle = await buildEnrichedCodebaseContext({
        query,
        branchName,
        fetchFreshContent: true,
      });
      res.json(bundle);
      return;
    }
    const data = await searchCodebase({ query, branchName });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get("/directory", async (req, res, next) => {
  try {
    const branchName = String(req.query.branch ?? "main");
    const dirPath = String(req.query.path ?? "");
    const listing = await getDirectoryListing(branchName, dirPath);
    res.json(listing);
  } catch (err) {
    next(err);
  }
});

router.get("/file/connections", async (req, res, next) => {
  try {
    const filePath = String(req.query.path ?? "");
    const branchName = String(req.query.branch ?? "main");
    if (!filePath) {
      res.status(400).json({ error: "path_required" });
      return;
    }
    const connections = await getFileConnections(branchName, filePath);
    res.json(connections);
  } catch (err) {
    next(err);
  }
});

router.get("/file", async (req, res, next) => {
  try {
    const filePath = String(req.query.path ?? "");
    const branchName = String(req.query.branch ?? "main");
    const includeContent = req.query.includeContent === "true";
    if (!filePath) {
      res.status(400).json({ error: "path_required" });
      return;
    }
    const file = await codebaseQueryService.getFileIntelligence(
      branchName,
      filePath,
      includeContent
    );
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

router.get("/tour", async (req, res, next) => {
  try {
    const branchName = String(req.query.branch ?? "main");
    const tour = await getTour(branchName);
    res.json(tour);
  } catch (err) {
    next(err);
  }
});

router.get("/health", async (req, res, next) => {
  try {
    const branchName = String(req.query.branch ?? "main");
    const health = await getCodebaseHealth(branchName);
    res.json(health);
  } catch (err) {
    next(err);
  }
});

router.get("/health/timeline", async (req, res, next) => {
  try {
    const branchName = String(req.query.branch ?? "main");
    const days = Math.min(90, Math.max(7, Number(req.query.days ?? 30)));
    const timeline = await getHealthTimeline(branchName, days);
    res.json(timeline);
  } catch (err) {
    next(err);
  }
});

router.get("/health/drift", async (_req, res, next) => {
  try {
    const drift = await getHealthDrift();
    res.json(drift);
  } catch (err) {
    next(err);
  }
});

router.post("/impact", async (req, res, next) => {
  try {
    const rate = checkImpactRateLimit(clientKeyFromRequest(req));
    if (!rate.allowed) {
      res.status(429).json({
        error: "rate_limit_exceeded",
        message: `Too many impact analyses. Try again in ${rate.retryAfterSec} seconds.`,
        retryAfterSec: rate.retryAfterSec,
      });
      return;
    }

    const { filePaths, paths, changeDescription = "", branchName = "main" } = req.body ?? {};
    const list = Array.isArray(filePaths)
      ? filePaths
      : Array.isArray(paths)
        ? paths
        : [];
    if (!list.length) {
      res.status(400).json({ error: "file_paths_required" });
      return;
    }

    const report = await analyzeImpact({
      branchName: String(branchName),
      filePaths: list.map(String),
      changeDescription: String(changeDescription),
    });
    res.json(report);
  } catch (err) {
    next(err);
  }
});

router.get("/knowledge/architecture", async (req, res, next) => {
  try {
    const branchName = String(req.query.branch ?? "main");
    const doc = await getArchitectureDoc(branchName);
    res.json(doc);
  } catch (err) {
    next(err);
  }
});

router.get("/knowledge/component", async (req, res, next) => {
  try {
    const branchName = String(req.query.branch ?? "main");
    const path = String(req.query.path ?? "");
    if (!path) {
      res.status(400).json({ error: "path_required" });
      return;
    }
    const guide = await getComponentGuide(branchName, path);
    if (!guide) {
      res.status(404).json({ error: "component_not_found" });
      return;
    }
    res.json(guide);
  } catch (err) {
    next(err);
  }
});

router.get("/knowledge/runbook", async (req, res, next) => {
  try {
    const branchName = String(req.query.branch ?? "main");
    const task = String(req.query.task ?? "");
    if (!task) {
      res.status(400).json({ error: "task_required" });
      return;
    }
    const runbook = await getRunbook(branchName, task);
    if (!runbook) {
      res.status(404).json({ error: "runbook_not_found" });
      return;
    }
    res.json(runbook);
  } catch (err) {
    next(err);
  }
});

router.get("/knowledge", async (req, res, next) => {
  try {
    const branchName = String(req.query.branch ?? "main");
    const knowledge = await getKnowledge(branchName);
    res.json(knowledge);
  } catch (err) {
    next(err);
  }
});

router.post("/knowledge/generate", async (req, res, next) => {
  try {
    const scope = resolveRepoScope();
    const repoKey = scope ? `${scope.repoOwner}/${scope.repoName}` : "unknown";
    const rate = checkKnowledgeGenerateRateLimit(repoKey);
    if (!rate.allowed) {
      res.status(429).json({
        error: "rate_limit_exceeded",
        message: `Knowledge generation is limited to once per minute. Try again in ${rate.retryAfterSec} seconds.`,
        retryAfterSec: rate.retryAfterSec,
      });
      return;
    }

    const { branchName = "main" } = req.body ?? {};
    const knowledge = await generateKnowledge(String(branchName));
    res.json(knowledge);
  } catch (err) {
    next(err);
  }
});

router.post("/tour/generate", async (req, res, next) => {
  try {
    const scope = resolveRepoScope();
    const repoKey = scope ? `${scope.repoOwner}/${scope.repoName}` : "unknown";
    const rate = checkTourGenerateRateLimit(repoKey);
    if (!rate.allowed) {
      res.status(429).json({
        error: "rate_limit_exceeded",
        message: `Tour generation is limited to once per minute. Try again in ${rate.retryAfterSec} seconds.`,
        retryAfterSec: rate.retryAfterSec,
      });
      return;
    }

    const { branchName = "main" } = req.body ?? {};
    const tour = await generateTour(String(branchName));
    res.json(tour);
  } catch (err) {
    next(err);
  }
});

// ─── GitNexus knowledge-graph tools (MCP-compatible shapes) ─────────────────

function gnError(res: import("express").Response, err: unknown) {
  const e = err as { status?: number; code?: string; message?: string };
  const status = e?.status ?? 500;
  res.status(status).json({
    error: e?.code || "gitnexus_error",
    message: e?.message || (err instanceof Error ? err.message : String(err)),
  });
}

router.post("/gn/analyze", async (req, res, next) => {
  try {
    const scope = resolveRepoScope();
    if (!scope) {
      res.status(400).json({ error: "repo_not_connected" });
      return;
    }
    const branchName = String(req.body?.branchName ?? scope.defaultBranch ?? "main");
    const graph = await runGitNexusAnalyzeForScope({
      organizationId: scope.organizationId,
      repoOwner: scope.repoOwner,
      repoName: scope.repoName,
      branchName,
    });
    res.json({ ok: true, meta: graph?.meta ?? null, analyzedAt: graph?.analyzedAt ?? null });
  } catch (err) {
    next(err);
  }
});

router.get("/gn/status", async (req, res, next) => {
  try {
    const scope = resolveRepoScope();
    if (!scope) {
      res.json({ ready: false });
      return;
    }
    const branch = String(req.query.branch ?? scope.defaultBranch ?? "main");
    res.json(
      await gnGraphStatus(scope.organizationId, scope.repoOwner, scope.repoName, branch)
    );
  } catch (err) {
    next(err);
  }
});

router.get("/gn/graph", async (req, res) => {
  try {
    const payload = await gnGraphPayload({
      branchName: typeof req.query.branch === "string" ? req.query.branch : undefined,
      limitNodes: req.query.limit ? Number(req.query.limit) : undefined,
      clusterCollapse: req.query.collapse !== "false",
    });
    res.json(payload);
  } catch (err) {
    gnError(res, err);
  }
});

router.post("/gn/query", async (req, res) => {
  try {
    res.json(await gnQuery(req.body ?? {}));
  } catch (err) {
    gnError(res, err);
  }
});

router.post("/gn/context", async (req, res) => {
  try {
    res.json(await gnContext(req.body ?? {}));
  } catch (err) {
    gnError(res, err);
  }
});

router.post("/gn/impact", async (req, res) => {
  try {
    res.json(await gnImpact(req.body ?? {}));
  } catch (err) {
    gnError(res, err);
  }
});

router.post("/gn/detect_changes", async (req, res) => {
  try {
    res.json(await gnDetectChanges(req.body ?? {}));
  } catch (err) {
    gnError(res, err);
  }
});

router.post("/gn/rename", async (req, res) => {
  try {
    res.json(await gnRename({ ...(req.body ?? {}), dry_run: true }));
  } catch (err) {
    gnError(res, err);
  }
});

router.post("/gn/cypher", async (req, res) => {
  try {
    res.json(await gnCypher(req.body ?? {}));
  } catch (err) {
    gnError(res, err);
  }
});

router.get("/gn/list_repos", async (req, res) => {
  try {
    res.json(
      await gnListRepos({
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        offset: req.query.offset ? Number(req.query.offset) : undefined,
      })
    );
  } catch (err) {
    gnError(res, err);
  }
});

router.get("/gn/resources/:resource", async (req, res) => {
  try {
    res.json(
      await gnResources(
        req.params.resource,
        typeof req.query.name === "string" ? req.query.name : undefined,
        typeof req.query.branch === "string" ? req.query.branch : undefined
      )
    );
  } catch (err) {
    gnError(res, err);
  }
});

router.get("/gn/wiki", async (req, res, next) => {
  try {
    const branch =
      typeof req.query.branch === "string" ? req.query.branch : undefined;
    res.json(await generateGitNexusWiki(branch));
  } catch (err) {
    next(err);
  }
});

export default router;
