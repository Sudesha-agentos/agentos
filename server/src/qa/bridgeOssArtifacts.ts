/**
 * Map mandatory QA OSS ToolArtifacts into qaArtifactStore fields so the
 * Pipeline QA report (securityScan / playwrightSmoke) is populated even when
 * the LLM never called run_security_scan / Playwright tools.
 */

import { listToolArtifacts, type ToolArtifact } from "../integrations/toolArtifacts";
import type { SecurityScanResult, SecurityFinding } from "./testing/securityScanner";
import type { PlaywrightSmokeResult } from "./testing/playwrightSmoke";
import { getQaArtifacts } from "./qaArtifactStore";

function severityOf(
  raw?: string
): SecurityFinding["severity"] {
  const s = (raw ?? "medium").toLowerCase();
  if (s === "critical" || s === "high" || s === "medium" || s === "low") {
    return s;
  }
  if (s === "error") return "high";
  if (s === "warning" || s === "warn") return "medium";
  if (s === "info") return "low";
  return "medium";
}

export function bridgeOssArtifactsIntoQaStore(pipelineId: string): {
  securityScan?: SecurityScanResult;
  playwrightSmoke?: PlaywrightSmokeResult;
  artifacts: ToolArtifact[];
} {
  const artifacts = listToolArtifacts(pipelineId, "qa");
  const store = getQaArtifacts(pipelineId);

  const semgrep = artifacts.find((a) => a.toolId === "semgrep");
  if (semgrep && !store.securityScan) {
    const findings: SecurityFinding[] = (semgrep.findings ?? []).map((f) => ({
      id: f.id,
      title: f.title,
      severity: severityOf(f.severity),
      source: "semgrep" as const,
      detail: [f.path, f.ruleId, f.detail].filter(Boolean).join(" · "),
    }));
    const criticalCount = findings.filter((f) => f.severity === "critical").length;
    const highCount = findings.filter((f) => f.severity === "high").length;
    store.securityScan = {
      runId: semgrep.runId,
      status:
        semgrep.status === "skipped"
          ? "skipped"
          : semgrep.status === "failed"
            ? "error"
            : "completed",
      criticalCount,
      highCount,
      findings,
      sandboxAvailable: semgrep.status !== "skipped",
      message: semgrep.summary,
    };
  }

  const pw =
    artifacts.find((a) => a.toolId === "playwright") ||
    artifacts.find((a) => a.toolId === "playwright-monitor");
  if (pw && !store.playwrightSmoke) {
    const meta = (pw.meta ?? {}) as Record<string, unknown>;
    const skipped = pw.status === "skipped";
    const passed = pw.status === "completed";
    store.playwrightSmoke = {
      attempted: meta.attempted !== false && !skipped,
      skipped,
      skipReason: skipped
        ? String(meta.installHint ?? pw.summary ?? "skipped")
        : undefined,
      passed,
      output: String(meta.output ?? meta.error ?? ""),
      durationMs: Number(meta.durationMs ?? 0) || 0,
    };
  }

  // Ensure executionReport carries both for stage persistence
  if (store.securityScan || store.playwrightSmoke) {
    const prev = store.executionReport;
    store.executionReport = {
      ...(prev ?? {
        generatedAt: new Date().toISOString(),
        summary: "QA OSS suite",
        overallRecommendation: "request_changes" as const,
        criteriaCoverage: { total: 0, covered: 0, uncovered: [] as string[] },
        executionStatus: "unavailable" as const,
        executionMessage: "OSS suite results attached (Semgrep / Playwright).",
      }),
      securityScan: store.securityScan ?? prev?.securityScan,
      playwrightSmoke: store.playwrightSmoke ?? prev?.playwrightSmoke,
    };
  }

  return {
    securityScan: store.securityScan,
    playwrightSmoke: store.playwrightSmoke,
    artifacts,
  };
}
