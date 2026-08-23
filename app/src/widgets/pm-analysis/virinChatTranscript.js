import { VIRIN_MAX_DISCOVERY_TURNS } from "../../entities/pm-agents";

export function extractJiraKey(text) {
  const match = String(text ?? "").match(/\b([A-Z][A-Z0-9]+-\d+)\b/);
  return match ? match[1] : null;
}

function normalize(text) {
  return String(text ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function buildVirinDiscoveryMessages(analysis) {
  if (!analysis) return [];
  const key = analysis.jiraKey || analysis.ticketId || "ticket";
  const conversation = analysis.questionMode?.conversation ?? [];
  const planned = (analysis.questionMode?.plannedQuestions ?? []).filter(Boolean);
  const rows = [];

  if (planned.length > 0) {
    rows.push({
      id: `virin-plan-${key}`,
      role: "assistant",
      content: "I'll cover these questions in chat.",
      createdAt: analysis.updatedAt ?? new Date().toISOString(),
      metadata: { kind: "discovery_plan", questions: planned },
    });
  }

  conversation.forEach((turn, index) => {
    rows.push({
      id: `virin-q-${key}-${index}`,
      role: "assistant",
      content: turn.question,
      createdAt: turn.askedAt,
      metadata: {
        kind: "discovery_question",
        pending: false,
        turnNumber: index + 1,
        maxTurns: analysis.questionMode?.maxTurns ?? VIRIN_MAX_DISCOVERY_TURNS,
      },
    });
    if (turn.answer) {
      rows.push({
        id: `virin-a-${key}-${index}`,
        role: "user",
        content: turn.answer,
        createdAt: turn.answeredAt ?? turn.askedAt,
        metadata: { kind: "discovery_answer" },
      });
    }
  });

  if (analysis.status === "AWAITING_INPUT" && analysis.pendingQuestion) {
    const isIntake = analysis.pendingQuestionStage === "INTAKE";
    rows.push({
      id: `virin-pending-${key}`,
      role: "assistant",
      content: analysis.pendingQuestion,
      createdAt: analysis.updatedAt ?? new Date().toISOString(),
      metadata: {
        kind: "discovery_question",
        pending: true,
        options: analysis.pendingQuestionOptions ?? [],
        plannedQuestions: planned,
        jiraKey: key,
        turnNumber: isIntake ? 1 : conversation.length + 1,
        maxTurns: isIntake ? 1 : analysis.questionMode?.maxTurns ?? VIRIN_MAX_DISCOVERY_TURNS,
      },
    });
  }

  return rows;
}

export function mergeVirinDiscoveryMessages(messages, analysis) {
  const discovery = buildVirinDiscoveryMessages(analysis);
  if (discovery.length === 0) return messages ?? [];
  const seen = new Set((messages ?? []).map((msg) => `${msg.role}:${normalize(msg.content)}`));
  const extras = discovery.filter((msg) => !seen.has(`${msg.role}:${normalize(msg.content)}`));
  return [...(messages ?? []), ...extras];
}
