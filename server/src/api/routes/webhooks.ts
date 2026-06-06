import { Router } from "express";
import { handleBitbucketWebhook } from "../../codebaseIntelligence/bitbucketWebhookHandler";
import { handleGithubWebhook } from "../../codebaseIntelligence/githubWebhookHandler";
import { handlePipelineJiraWebhook } from "../../pipeline/jira/webhookHandler";
import { getPipelineIntakeMapping } from "../../pipeline/jira/intakeConfig";

const router = Router();

router.get("/jira/pipeline", (_req, res) => {
  const intake = getPipelineIntakeMapping();
  res.json({
    ok: true,
    message:
      "Jira pipeline webhook. POST issue_updated when a ticket enters the AI Worker column to start the agent pipeline.",
    pipelinePath: "/webhooks/jira/pipeline",
    intakeColumn: intake.aiWorkerColumnName || null,
    intakeStatuses: intake.aiWorkerStatuses,
    events: ["jira:issue_updated"],
  });
});

router.post("/jira/pipeline", (req, res, next) => {
  void handlePipelineJiraWebhook(req, res).catch(next);
});

router.get("/github", (_req, res) => {
  res.json({
    ok: true,
    message:
      "GitHub App webhook endpoint. GitHub sends POST with X-Hub-Signature-256; browser GET is only a health check.",
    events: ["push", "pull_request", "installation", "installation_repositories"],
  });
});

router.post("/github", (req, res, next) => {
  void handleGithubWebhook(req, res).catch(next);
});

router.post("/bitbucket", (req, res, next) => {
  void handleBitbucketWebhook(req, res).catch(next);
});

export default router;
