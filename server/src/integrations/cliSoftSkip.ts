/**
 * Shared helpers for OSS CLI adapters that soft-skip when binaries are missing.
 */

export function isMissingCliError(message: string, cliHint?: string): boolean {
  if (/not found|ENOENT|is not recognized|command not found/i.test(message)) {
    return true;
  }
  if (cliHint && new RegExp(cliHint, "i").test(message) && /exit code 127|\b127\b/.test(message)) {
    return true;
  }
  return false;
}

export function softSkipArtifact(input: {
  toolId: string;
  lane: "engineering" | "qa" | "canary" | "codebase";
  pipelineId?: string;
  runId: string;
  installHint: string;
  error?: string;
  missing: boolean;
  createdAt: string;
}): {
  toolId: string;
  lane: "engineering" | "qa" | "canary" | "codebase";
  pipelineId?: string;
  runId: string;
  status: "skipped" | "failed";
  summary: string;
  findings: [];
  meta?: Record<string, unknown>;
  createdAt: string;
} {
  return {
    toolId: input.toolId,
    lane: input.lane,
    pipelineId: input.pipelineId,
    runId: input.runId,
    status: input.missing ? "skipped" : "failed",
    summary: input.missing
      ? `${input.toolId} not installed — skipped (${input.installHint})`
      : `${input.toolId} failed: ${(input.error ?? "").slice(0, 300)}`,
    findings: [],
    meta: input.error ? { error: input.error.slice(0, 1000) } : undefined,
    createdAt: input.createdAt,
  };
}
