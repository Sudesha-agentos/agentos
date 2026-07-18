/**
 * Shared helpers for OSS CLI adapters that soft-skip when binaries are missing.
 * In production (or OSS_TOOLS_REQUIRED=1), missing CLIs become failed artifacts.
 */

export function isOssToolsRequired(): boolean {
  if (process.env.OSS_TOOLS_REQUIRED === "0") return false;
  if (process.env.OSS_TOOLS_REQUIRED === "1") return true;
  return process.env.NODE_ENV === "production";
}

export function isMissingCliError(message: string, cliHint?: string): boolean {
  if (/not found|ENOENT|is not recognized|command not found/i.test(message)) {
    return true;
  }
  if (cliHint && new RegExp(cliHint, "i").test(message) && /exit code 127|\b127\b/.test(message)) {
    return true;
  }
  return false;
}

export type ToolLane = "engineering" | "qa" | "canary" | "codebase";

/**
 * Build artifact when a CLI is missing or a run failed.
 * When `missing` and tools are required, status is `failed` (loud) instead of `skipped`.
 */
export function softSkipArtifact(input: {
  toolId: string;
  lane: ToolLane;
  pipelineId?: string;
  runId: string;
  installHint: string;
  error?: string;
  missing: boolean;
  createdAt: string;
}): {
  toolId: string;
  lane: ToolLane;
  pipelineId?: string;
  runId: string;
  status: "skipped" | "failed";
  summary: string;
  findings: [];
  meta?: Record<string, unknown>;
  createdAt: string;
} {
  const required = isOssToolsRequired();
  const treatAsFailed = input.missing && required;

  let summary: string;
  if (!input.missing) {
    summary = `${input.toolId} failed: ${(input.error ?? "").slice(0, 300)}`;
  } else if (treatAsFailed) {
    summary = `${input.toolId} required but not installed on host (${input.installHint}). Set OSS_TOOLS_REQUIRED=0 to soft-skip.`;
  } else {
    summary = `${input.toolId} not installed — skipped (${input.installHint})`;
  }

  return {
    toolId: input.toolId,
    lane: input.lane,
    pipelineId: input.pipelineId,
    runId: input.runId,
    status: input.missing ? (treatAsFailed ? "failed" : "skipped") : "failed",
    summary,
    findings: [],
    meta: {
      ...(input.error ? { error: input.error.slice(0, 1000) } : {}),
      missingCli: input.missing,
      ossToolsRequired: required,
      installHint: input.installHint,
    },
    createdAt: input.createdAt,
  };
}
