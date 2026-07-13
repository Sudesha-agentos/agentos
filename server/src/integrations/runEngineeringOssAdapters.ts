/**
 * Mandatory Engineering OSS suite — runs for every ticket after coding.
 * Tree-sitter symbols (Mentat-style structure map) + Aider capability record + mini-SWE ACI note.
 */

import { randomUUID } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { logger } from "../utils/logger";
import { buildSemanticChunks } from "../codebaseIntelligence/astChunker";
import { saveToolArtifact, type ToolArtifact, type ToolFinding } from "./toolArtifacts";

export async function runEngineeringOssAdapters(input: {
  pipelineId: string;
  workspaceDir?: string;
  changedFiles: string[];
}): Promise<ToolArtifact[]> {
  const out: ToolArtifact[] = [];
  const createdAt = new Date().toISOString();
  const files = input.changedFiles.filter(Boolean).slice(0, 12);

  // 1) Tree-sitter / AST symbol map of changed files
  try {
    const findings: ToolFinding[] = [];
    if (input.workspaceDir) {
      for (const rel of files) {
        const abs = join(input.workspaceDir, rel);
        if (!existsSync(abs)) continue;
        let content = "";
        try {
          content = readFileSync(abs, "utf8");
        } catch {
          continue;
        }
        const chunks = buildSemanticChunks(rel, content).slice(0, 40);
        for (const c of chunks.slice(0, 25)) {
          findings.push({
            id: `sym-${findings.length}`,
            title: c.symbolName || c.spanType || "symbol",
            severity: "info",
            path: rel,
            startLine: c.startLine,
            endLine: c.endLine,
            detail: c.chunkStrategy,
          });
        }
      }
    }
    const artifact: ToolArtifact = {
      toolId: "tree-sitter",
      lane: "engineering",
      pipelineId: input.pipelineId,
      runId: `ts-${randomUUID().slice(0, 8)}`,
      status: "completed",
      summary:
        findings.length > 0
          ? `Tree-sitter mapped ${findings.length} symbol(s) across ${files.length} file(s)`
          : files.length
            ? "Tree-sitter ran — no AST symbols extracted (fallback/binary)"
            : "Tree-sitter ran — no changed files to map",
      findings,
      meta: { files },
      createdAt,
    };
    saveToolArtifact(artifact);
    out.push(artifact);
  } catch (err) {
    logger.warn({ err }, "engineering tree-sitter adapter failed");
  }

  // 2) Aider editblock readiness (algorithm is in-process — always available)
  {
    const artifact: ToolArtifact = {
      toolId: "aider",
      lane: "engineering",
      pipelineId: input.pipelineId,
      runId: `aider-cap-${randomUUID().slice(0, 8)}`,
      status: "completed",
      summary:
        "Aider SEARCH/REPLACE editblock algorithm available (vendored port). Agent may apply via apply_aider_edits / edit_file.",
      findings: files.map((f, i) => ({
        id: `chg-${i}`,
        title: f,
        severity: "info" as const,
        path: f,
        detail: "candidate for Aider-style patch",
      })),
      meta: { editblock: true, changedFiles: files },
      createdAt,
    };
    saveToolArtifact(artifact);
    out.push(artifact);
  }

  // 3) mini-SWE / ACI workflow note (vendored prompts influence coding loop)
  {
    const artifact: ToolArtifact = {
      toolId: "mini-swe-agent",
      lane: "engineering",
      pipelineId: input.pipelineId,
      runId: `aci-${randomUUID().slice(0, 8)}`,
      status: "completed",
      summary:
        "mini-SWE / ACI patterns active in Ananta coding loop (bash-style tools: list_dir, grep, edit_file).",
      findings: [
        {
          id: "aci-tools",
          title: "ACI tool surface",
          severity: "info",
          detail: "list_dir, grep, read_file, edit_file, write_file, apply_aider_edits, get_file_symbols",
        },
      ],
      meta: { vendor: "server/vendor/mini-swe-agent" },
      createdAt,
    };
    saveToolArtifact(artifact);
    out.push(artifact);
  }

  return out;
}
