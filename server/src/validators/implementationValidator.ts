import { z } from "zod";
import type { ImplementationOutput, PrdOutput } from "../types/agents";
import type { ValidationIssue, ValidationResult } from "../types/pipeline";
import { getPipelineSettings } from "../pipeline/settingsStore";

const implementationSchema = z.object({
  summary: z.string().min(20),
  technicalApproach: z.string().min(20),
  components: z
    .array(
      z.object({
        name: z.string().min(1),
        description: z.string().min(8),
        estimatedDays: z.number().positive(),
      })
    )
    .min(1),
  apiChanges: z.array(z.string()),
  databaseChanges: z.array(z.string()),
  dependencies: z.array(z.string()),
  risks: z.array(
    z.object({
      description: z.string().min(4),
      severity: z.enum(["low", "medium", "high"]),
      mitigation: z.string().min(4),
    })
  ),
  totalEstimateDays: z.number().positive(),
  criteriaMapping: z.array(
    z.object({
      criterion: z.string().min(8),
      implementation: z.string().min(8),
      files: z.array(z.string()).optional(),
      symbols: z.array(z.string()).optional(),
    })
  ),
  blockers: z.array(z.string()),
  implementationMode: z.enum(["code", "content"]).optional(),
  targetFiles: z.array(z.string()).optional(),
  compileFailed: z.boolean().optional(),
  compileSkipped: z.boolean().optional(),
  confidenceScore: z.number().min(0).max(1),
  confidenceReason: z.string().min(8),
});

/**
 * The implementation gate verifies the plan covers every acceptance
 * criterion, declares risks proportionate to scope, and respects the
 * conservative-estimate rule.
 */
export function validateImplementation(
  implementation: unknown,
  prd: PrdOutput,
  options?: {
    implementationMode?: "code" | "content";
    targetFiles?: string[];
  }
): ValidationResult {
  const issues: ValidationIssue[] = [];
  const amberFlags: string[] = [];

  const schemaResult = implementationSchema.safeParse(implementation);
  if (!schemaResult.success) {
    for (const err of schemaResult.error.issues) {
      issues.push({
        code: "SCHEMA",
        severity: "error",
        message: err.message,
        path: err.path.join("."),
      });
    }
    return {
      passed: false,
      score: 0,
      issues,
      amberFlags,
      checkedAt: new Date().toISOString(),
    };
  }

  const data: ImplementationOutput = schemaResult.data;

  const mappedCriteria = new Set(
    data.criteriaMapping.map((m) => normalize(m.criterion))
  );
  for (const criterion of prd.acceptanceCriteria) {
    if (!mappedCriteria.has(normalize(criterion))) {
      issues.push({
        code: "UNMAPPED_CRITERION",
        severity: "error",
        message: `Acceptance criterion not mapped to implementation: "${criterion.slice(0, 80)}..."`,
      });
    }
  }

  const summed = data.components.reduce((a, c) => a + c.estimatedDays, 0);
  if (Math.abs(summed - data.totalEstimateDays) / Math.max(summed, 1) > 0.15) {
    amberFlags.push(
      `Total estimate (${data.totalEstimateDays}d) deviates from component sum (${summed}d) by more than 15%.`
    );
  }

  if (data.risks.length === 0) {
    amberFlags.push("No risks declared. Engineering must surface at least one risk.");
  }
  if (data.blockers.length > 0) {
    issues.push({
      code: "IMPLEMENTATION_BLOCKERS",
      severity: "error",
      message: `Plan declares ${data.blockers.length} blocker(s): ${data.blockers
        .slice(0, 3)
        .join("; ")}`,
    });
  }
  const confidenceFloor = getPipelineSettings().implementationConfidenceThreshold;
  if (data.confidenceScore < confidenceFloor) {
    issues.push({
      code: "LOW_CONFIDENCE",
      severity: "error",
      message: `Implementation confidence ${data.confidenceScore} below ${confidenceFloor} threshold.`,
    });
  }
  if (data.compileFailed) {
    issues.push({
      code: "COMPILE_FAILED",
      severity: "error",
      message:
        "Safety compile failed on the implementation branch — the pushed code does not build. Human review required before QA runs.",
    });
  }
  const modeForCompile = options?.implementationMode ?? data.implementationMode ?? "code";
  if (modeForCompile !== "content" && data.compileSkipped && !data.compileFailed) {
    amberFlags.push(
      "Safety compile was skipped — no compiler/package.json in the workspace."
    );
  }

  const mode = options?.implementationMode ?? data.implementationMode ?? "code";
  const targetFiles = options?.targetFiles ?? data.targetFiles ?? [];

  if (mode === "content") {
    if (!targetFiles.length) {
      issues.push({
        code: "MISSING_TARGET_FILES",
        severity: "error",
        message: "Content-mode plan must declare targetFiles with deliverable document paths.",
      });
    }
    if (data.apiChanges.length > 0) {
      amberFlags.push("Content-mode plan declares API changes — verify this is not a code ticket.");
    }
    if (data.databaseChanges.length > 0) {
      amberFlags.push(
        "Content-mode plan declares database changes — verify this is not a code ticket."
      );
    }
  }

  const errorCount = issues.filter((i) => i.severity === "error").length;
  const passed = errorCount === 0;
  const score = Math.max(
    0,
    1 - errorCount * 0.2 - amberFlags.length * 0.04
  );

  return {
    passed,
    score: Number(score.toFixed(2)),
    issues,
    amberFlags,
    checkedAt: new Date().toISOString(),
  };
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}
