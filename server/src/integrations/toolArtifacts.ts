/**
 * Shared tool-run artifact contract for Engineering / QA / Canary adapters.
 * In-memory cache + JSON files under data/tool-artifacts/ (survives restarts).
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { logger } from "../utils/logger";

export type ToolLane = "engineering" | "qa" | "canary" | "codebase";

export type ToolFinding = {
  id: string;
  title: string;
  severity?: "critical" | "high" | "medium" | "low" | "info";
  path?: string;
  startLine?: number;
  endLine?: number;
  detail?: string;
  ruleId?: string;
};

export type ToolArtifact = {
  toolId: string;
  lane: ToolLane;
  pipelineId?: string;
  runId: string;
  status: "completed" | "failed" | "skipped" | "running";
  summary: string;
  findings: ToolFinding[];
  meta?: Record<string, unknown>;
  createdAt: string;
};

const memory = new Map<string, ToolArtifact[]>();

const ROOT =
  process.env.TOOL_ARTIFACTS_DATA_DIR?.trim() ||
  path.join(process.cwd(), "data", "tool-artifacts");

function key(pipelineId: string, lane?: ToolLane) {
  return lane ? `${pipelineId}::${lane}` : pipelineId;
}

function safeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
}

function pipelineDir(pipelineId: string): string {
  return path.join(ROOT, safeId(pipelineId));
}

function ensureLoaded(pipelineId: string, lane?: ToolLane): void {
  const k = key(pipelineId, lane);
  if (memory.has(k)) return;
  try {
    const dir = pipelineDir(pipelineId);
    if (!existsSync(dir)) {
      memory.set(k, []);
      if (!lane) memory.set(pipelineId, []);
      return;
    }
    const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
    const all: ToolArtifact[] = [];
    for (const file of files) {
      try {
        const raw = readFileSync(path.join(dir, file), "utf8");
        const parsed = JSON.parse(raw) as ToolArtifact;
        if (parsed?.runId) all.push(parsed);
      } catch {
        /* skip corrupt */
      }
    }
    all.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    memory.set(pipelineId, all.slice(0, 80));
    for (const laneName of ["engineering", "qa", "canary", "codebase"] as ToolLane[]) {
      memory.set(
        key(pipelineId, laneName),
        all.filter((a) => a.lane === laneName).slice(0, 40)
      );
    }
  } catch (err) {
    logger.warn({ err, pipelineId }, "tool artifact load failed");
    memory.set(k, []);
  }
}

function persistToDisk(artifact: ToolArtifact): void {
  if (!artifact.pipelineId) return;
  try {
    const dir = pipelineDir(artifact.pipelineId);
    mkdirSync(dir, { recursive: true });
    const file = path.join(
      dir,
      `${safeId(artifact.lane)}__${safeId(artifact.runId)}.json`
    );
    writeFileSync(file, JSON.stringify(artifact, null, 2), "utf8");
  } catch (err) {
    logger.warn({ err, runId: artifact.runId }, "tool artifact persist failed");
  }
}

export function saveToolArtifact(artifact: ToolArtifact): void {
  if (!artifact.pipelineId) return;
  ensureLoaded(artifact.pipelineId);

  const k = key(artifact.pipelineId, artifact.lane);
  const list = memory.get(k) ?? [];
  list.unshift(artifact);
  memory.set(k, list.slice(0, 40));

  const all = memory.get(artifact.pipelineId) ?? [];
  all.unshift(artifact);
  memory.set(artifact.pipelineId, all.slice(0, 80));

  persistToDisk(artifact);
}

export function listToolArtifacts(
  pipelineId: string,
  lane?: ToolLane
): ToolArtifact[] {
  ensureLoaded(pipelineId, lane);
  return memory.get(lane ? key(pipelineId, lane) : pipelineId) ?? [];
}
