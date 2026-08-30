import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import { costUsdForTokens, formatUsd, tokenRatesForModel } from "../llm/tokenPricing";
import type { SimAgent, SimEvent, SimEventKind, SimRun, SimRunResult, SimUsageLine } from "./types";

const MAX_RUNS = 40;
const MAX_EVENTS = 2_000;

const runs = new Map<string, SimRun>();
const hub = new EventEmitter();
hub.setMaxListeners(80);

export function createSimRun(organizationId: string, requirement: string): SimRun {
  const run: SimRun = {
    id: `sim-${randomUUID()}`,
    organizationId,
    requirement: requirement.trim(),
    status: "queued",
    startedAt: Date.now(),
    events: [],
    usage: { inputTokens: 0, outputTokens: 0, costUsd: 0, lines: [] },
  };
  runs.set(run.id, run);
  prune();
  return run;
}

export function getSimRun(id: string): SimRun | undefined {
  return runs.get(id);
}

export function listSimRuns(organizationId: string): SimRun[] {
  return [...runs.values()]
    .filter((run) => run.organizationId === organizationId)
    .sort((a, b) => b.startedAt - a.startedAt)
    .slice(0, 20);
}

export function isSimPipelineId(pipelineId?: string): boolean {
  return Boolean(pipelineId?.startsWith("sim-"));
}

export function emitSimEvent(
  runId: string,
  input: {
    agent: SimAgent;
    kind: SimEventKind;
    label: string;
    detail?: string;
    durationMs?: number;
    data?: Record<string, unknown>;
  }
): SimEvent | null {
  const run = runs.get(runId);
  if (!run) return null;
  const event: SimEvent = {
    id: randomUUID(),
    t: Date.now(),
    elapsedMs: Date.now() - run.startedAt,
    agent: input.agent,
    kind: input.kind,
    label: input.label,
    detail: input.detail,
    durationMs: input.durationMs,
    data: input.data,
  };
  run.events.push(event);
  if (run.events.length > MAX_EVENTS) {
    run.events.splice(0, run.events.length - MAX_EVENTS);
  }
  hub.emit(runId, event);
  return event;
}

export function recordSimUsage(
  runId: string,
  input: {
    agent: SimAgent;
    stage: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
  }
): SimUsageLine | null {
  const run = runs.get(runId);
  if (!run) return null;
  const rate = tokenRatesForModel(input.model);
  const line: SimUsageLine = {
    agent: input.agent,
    stage: input.stage,
    model: input.model,
    inputTokens: Math.max(0, Math.round(input.inputTokens)),
    outputTokens: Math.max(0, Math.round(input.outputTokens)),
    costUsd: costUsdForTokens(input.model, input.inputTokens, input.outputTokens),
    inputUsdPerMillion: rate.inputUsdPerMillion,
    outputUsdPerMillion: rate.outputUsdPerMillion,
  };
  run.usage.lines.push(line);
  run.usage.inputTokens += line.inputTokens;
  run.usage.outputTokens += line.outputTokens;
  run.usage.costUsd += line.costUsd;
  emitSimEvent(runId, {
    agent: input.agent,
    kind: "usage",
    label: `${input.stage} tokens`,
    detail: `${line.model} · in ${line.inputTokens} · out ${line.outputTokens} · ${formatUsd(line.costUsd)} ($${rate.inputUsdPerMillion}/$${rate.outputUsdPerMillion} per 1M)`,
    data: line as unknown as Record<string, unknown>,
  });
  return line;
}

export function markSimRunning(runId: string): void {
  const run = runs.get(runId);
  if (run) run.status = "running";
}

export function completeSimRun(runId: string, result: SimRunResult): void {
  const run = runs.get(runId);
  if (!run) return;
  run.status = "completed";
  run.finishedAt = Date.now();
  run.result = { ...result, usage: run.usage };
  emitSimEvent(runId, {
    agent: "system",
    kind: "done",
    label: "COMPLETED",
    detail: `${((run.finishedAt - run.startedAt) / 1000).toFixed(1)}s · ${run.usage.inputTokens} in / ${run.usage.outputTokens} out · ${formatUsd(run.usage.costUsd)}`,
    durationMs: run.finishedAt - run.startedAt,
    data: { ...run.result } as unknown as Record<string, unknown>,
  });
}

export function failSimRun(runId: string, error: string): void {
  const run = runs.get(runId);
  if (!run) return;
  run.status = "failed";
  run.finishedAt = Date.now();
  run.error = error;
  emitSimEvent(runId, {
    agent: "system",
    kind: "error",
    label: "FAILED",
    detail: `${error} · ${run.usage.inputTokens} in / ${run.usage.outputTokens} out · ${formatUsd(run.usage.costUsd)}`,
    durationMs: run.finishedAt - run.startedAt,
    data: { usage: run.usage },
  });
}

export function subscribeSimRun(runId: string, listener: (event: SimEvent) => void): () => void {
  hub.on(runId, listener);
  return () => hub.off(runId, listener);
}

function prune(): void {
  if (runs.size <= MAX_RUNS) return;
  const oldest = [...runs.values()].sort((a, b) => a.startedAt - b.startedAt);
  for (const run of oldest.slice(0, runs.size - MAX_RUNS)) {
    runs.delete(run.id);
  }
}
