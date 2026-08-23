import { Router } from "express";
import { agentChatRepo } from "../../db/repositories/agentChatRepo";
import { runDomainChatTurn } from "../../agentChat";
import {
  checkAgentChatRateLimit,
  clientKeyFromRequest,
} from "../../agentChat/rateLimit";
import type { AgentChatDomain } from "../../agentChat/types";
import { bindOrganizationContextMiddleware } from "../orgRequestContext";
import { ValidationError } from "../../utils/errors";
import { pmAnalysisStore } from "../../agents/pm/store";
import { startPmAnalysisInBackground } from "../../agents/pm/backgroundRunner";
import { submitVirinAnswer } from "../../agents/virin/orchestrator";
import { getActiveOrganizationId } from "../../organization/context";

const router = Router();

router.use(bindOrganizationContextMiddleware);

const DOMAINS = new Set<AgentChatDomain>(["virin", "ananta", "neel"]);

function parseDomain(value: unknown): AgentChatDomain {
  const domain = String(value ?? "").trim().toLowerCase();
  if (!DOMAINS.has(domain as AgentChatDomain)) {
    throw new ValidationError(`Invalid agent domain: ${domain}`);
  }
  return domain as AgentChatDomain;
}

router.get("/threads", async (req, res, next) => {
  try {
    if (!req.query.domain) {
      const limit = Number(req.query.limit ?? 50);
      const threads = await agentChatRepo.listThreads(Number.isFinite(limit) ? limit : 50);
      res.json({ threads });
      return;
    }
    const domain = parseDomain(req.query.domain);
    const contextKey = String(req.query.contextKey ?? "");
    const thread = await agentChatRepo.findThread(domain, contextKey);
    res.json({ thread });
  } catch (err) {
    next(err);
  }
});

router.post("/threads", async (req, res, next) => {
  try {
    const domain = parseDomain(req.body?.domain);
    const contextKey = String(req.body?.contextKey ?? "");
    const title = req.body?.title ? String(req.body.title) : undefined;
    const thread = await agentChatRepo.getOrCreateThread({
      agentDomain: domain,
      contextKey,
      title,
    });
    res.status(201).json({ thread });
  } catch (err) {
    next(err);
  }
});

router.get("/threads/:id/messages", async (req, res, next) => {
  try {
    const thread = await agentChatRepo.getThreadById(req.params.id);
    if (!thread) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const messages = await agentChatRepo.listMessages(req.params.id);
    res.json({ messages });
  } catch (err) {
    next(err);
  }
});

router.post("/threads/:id/messages", async (req, res, next) => {
  try {
    const clientKey = clientKeyFromRequest(req);
    const limit = checkAgentChatRateLimit(clientKey);
    if (!limit.allowed) {
      res.status(429).json({
        error: "rate_limited",
        retryAfterSec: limit.retryAfterSec,
      });
      return;
    }

    const content = String(req.body?.content ?? "").trim();
    if (!content) {
      throw new ValidationError("Message content is required.");
    }

    const thread = await agentChatRepo.getThreadById(req.params.id);
    if (!thread) {
      res.status(404).json({ error: "not_found" });
      return;
    }

    const userMessage = await agentChatRepo.appendMessage({
      threadId: thread.id,
      role: "user",
      content,
    });

    if (!thread.title && content.length > 0) {
      const title = content.length > 60 ? `${content.slice(0, 57)}…` : content;
      await agentChatRepo.updateThreadTitle(thread.id, title);
    }

    const ticketKey = String(thread.contextKey ?? "").trim().toUpperCase();
    const analysis = ticketKey ? pmAnalysisStore.get(ticketKey) : null;
    if (
      thread.agentDomain === "virin" &&
      analysis?.status === "AWAITING_INPUT" &&
      analysis.pendingQuestion
    ) {
      startPmAnalysisInBackground(ticketKey, () => submitVirinAnswer(ticketKey, content), {
        organizationId: getActiveOrganizationId() ?? undefined,
      });
      const assistantMessage = await agentChatRepo.appendMessage({
        threadId: thread.id,
        role: "assistant",
        content: "Got it. Preparing the next question.",
        metadata: { kind: "discovery_ack" },
      });
      res.json({ userMessage, assistantMessage, toolCallLog: [], costUsd: 0 });
      return;
    }

    const history = (thread.messages ?? [])
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role, content: m.content }));

    const turn = await runDomainChatTurn({
      domain: thread.agentDomain,
      threadId: thread.id,
      contextKey: thread.contextKey,
      conversationHistory: history,
      userMessage: content,
    });

    const assistantMessage = await agentChatRepo.appendMessage({
      threadId: thread.id,
      role: "assistant",
      content: turn.assistantMessage.content,
      metadata: turn.assistantMessage.metadata ?? undefined,
    });

    res.json({
      userMessage,
      assistantMessage,
      toolCallLog: turn.toolCallLog,
      costUsd: turn.costUsd,
    });
  } catch (err) {
    next(err);
  }
});

router.delete("/threads/:id", async (req, res, next) => {
  try {
    const thread = await agentChatRepo.getThreadById(req.params.id);
    if (!thread) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    await agentChatRepo.deleteThread(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
