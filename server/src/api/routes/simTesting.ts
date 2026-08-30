import { Router } from "express";
import { requireOrganizationUser, withOrganizationContext } from "../orgRequestContext";
import {
  createSimRun,
  getSimRun,
  listSimRuns,
  subscribeSimRun,
} from "../../simTesting/hub";
import { executeSimRun } from "../../simTesting/runner";
import { getPublicGitCredentials } from "../../git-integration/gitCredentialsStore";

const router = Router();

router.get("/status", async (req, res, next) => {
  try {
    const user = requireOrganizationUser(req, res);
    if (!user?.organizationId) return;
    await withOrganizationContext(user.organizationId, async () => {
      const git = getPublicGitCredentials();
      res.json({
        git: {
          connected: git.configured,
          repo: git.configured ? `${git.workspace}/${git.repoSlug}` : null,
          defaultBranch: git.defaultBranch,
          provider: git.provider,
        },
        openai: Boolean(process.env.OPENAI_API_KEY?.trim()),
      });
    });
  } catch (err) {
    next(err);
  }
});

router.get("/runs", async (req, res, next) => {
  try {
    const user = requireOrganizationUser(req, res);
    if (!user?.organizationId) return;
    res.json({ items: listSimRuns(user.organizationId) });
  } catch (err) {
    next(err);
  }
});

router.post("/runs", async (req, res, next) => {
  try {
    const user = requireOrganizationUser(req, res);
    if (!user?.organizationId) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const requirement = String(
      body.requirement ?? body.text ?? body.prompt ?? ""
    ).trim();
    if (requirement.length < 8) {
      res.status(400).json({
        error: "requirement_required",
        message:
          "The requirement did not reach the API. Refresh and click Run simulation again (need at least 8 characters in the box).",
      });
      return;
    }
    const run = createSimRun(user.organizationId, requirement);
    void withOrganizationContext(user.organizationId, () => executeSimRun(run.id)).catch(() => undefined);
    res.status(202).json({ run });
  } catch (err) {
    next(err);
  }
});

router.get("/runs/:id", async (req, res, next) => {
  try {
    const user = requireOrganizationUser(req, res);
    if (!user?.organizationId) return;
    const run = getSimRun(req.params.id);
    if (!run || run.organizationId !== user.organizationId) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json({ run });
  } catch (err) {
    next(err);
  }
});

router.get("/runs/:id/events", async (req, res, next) => {
  try {
    const user = requireOrganizationUser(req, res);
    if (!user?.organizationId) return;
    const run = getSimRun(req.params.id);
    if (!run || run.organizationId !== user.organizationId) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    for (const event of run.events) {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
    if (run.status === "completed" || run.status === "failed") {
      res.write(`data: ${JSON.stringify({ kind: "snapshot", status: run.status })}\n\n`);
    }

    const unsubscribe = subscribeSimRun(run.id, (event) => {
      try {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      } catch {
        unsubscribe();
      }
    });

    req.on("close", () => {
      unsubscribe();
      res.end();
    });
  } catch (err) {
    next(err);
  }
});

export default router;
