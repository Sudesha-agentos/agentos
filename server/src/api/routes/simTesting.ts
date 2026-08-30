import { Router } from "express";
import { requireOrganizationUser, withOrganizationContext } from "../orgRequestContext";
import {
  createSimRun,
  failSimRun,
  getSimRun,
  listSimRuns,
  resolveSimPrompt,
  subscribeSimRun,
} from "../../simTesting/hub";
import { executeSimRun } from "../../simTesting/runner";
import { getPublicGitCredentials } from "../../git-integration/gitCredentialsStore";
import { getApiModelForRole } from "../../billing/consumeAgentCredits";
import { tokenRatesForModel } from "../../llm/tokenPricing";

const router = Router();

router.get("/status", async (req, res, next) => {
  try {
    const user = requireOrganizationUser(req, res);
    if (!user?.organizationId) return;
    await withOrganizationContext(user.organizationId, async () => {
      const git = getPublicGitCredentials();
      const models = {
        virin: getApiModelForRole("product"),
        ananta: getApiModelForRole("tech"),
        neel: getApiModelForRole("qa"),
      };
      res.json({
        git: {
          connected: git.configured,
          repo: git.configured ? `${git.workspace}/${git.repoSlug}` : null,
          defaultBranch: git.defaultBranch,
          provider: git.provider,
        },
        openai: Boolean(process.env.OPENAI_API_KEY?.trim()),
        models: {
          virin: { model: models.virin, ...tokenRatesForModel(models.virin) },
          ananta: { model: models.ananta, ...tokenRatesForModel(models.ananta) },
          neel: { model: models.neel, ...tokenRatesForModel(models.neel) },
        },
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
    void withOrganizationContext(user.organizationId, () => executeSimRun(run.id)).catch((err) => {
      failSimRun(run.id, err instanceof Error ? err.message : String(err));
    });
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

router.post("/runs/:id/prompts/:promptId", async (req, res, next) => {
  try {
    const user = requireOrganizationUser(req, res);
    if (!user?.organizationId) return;
    const run = getSimRun(req.params.id);
    if (!run || run.organizationId !== user.organizationId) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    const action = body.action === "approve" || body.action === "dismiss" ? body.action : "answer";
    const prompt = resolveSimPrompt(run.id, req.params.promptId, {
      action,
      answer: body.answer != null ? String(body.answer) : undefined,
    });
    if (!prompt) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json({ prompt, run });
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
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    req.socket.setTimeout(0);
    res.flushHeaders?.();

    const writeEvent = (payload: unknown) => {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
      (res as typeof res & { flush?: () => void }).flush?.();
    };

    for (const event of run.events) {
      writeEvent(event);
    }
    if (run.status === "completed" || run.status === "failed") {
      writeEvent({ kind: "snapshot", status: run.status });
    }

    const unsubscribe = subscribeSimRun(run.id, (event) => {
      try {
        writeEvent(event);
      } catch {
        unsubscribe();
      }
    });

    const ping = setInterval(() => {
      try {
        res.write(": keepalive\n\n");
      } catch {
        clearInterval(ping);
      }
    }, 8000);

    req.on("close", () => {
      clearInterval(ping);
      unsubscribe();
      res.end();
    });
  } catch (err) {
    next(err);
  }
});

export default router;
