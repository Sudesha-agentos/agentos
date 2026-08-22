import type { ValidationIssue, GateFinding } from "../../types/pipeline";
import { isAlreadyShipped } from "../../agents/virin/alreadyBuiltAssessment";
import type { PmAnalysisRecord } from "../../agents/pm/types";
import type { DuplicateSearcher } from "../input";
import { isProductionPath, type DiffUnit } from "./parseDiff";

const STRONG_SIMILARITY = 0.82;

export async function checkRedundancy(input: {
  units: DiffUnit[];
  pmRecord?: PmAnalysisRecord | null;
  searcher?: DuplicateSearcher;
}): Promise<{ issues: ValidationIssue[]; findings: GateFinding[]; amberFlags: string[] }> {
  const issues: ValidationIssue[] = [];
  const findings: GateFinding[] = [];
  const amberFlags: string[] = [];

  const overlap = input.pmRecord?.codebaseAnalysis;
  if (overlap && isAlreadyShipped(overlap)) {
    const note =
      overlap.alreadyShippedNote?.trim() ||
      "Codebase analysis says this capability already exists.";
    issues.push({
      code: "REDUNDANT_IMPLEMENTATION",
      severity: "error",
      message: `New implementation looks redundant with already-shipped code: ${note}`,
    });
  } else if (overlap?.overlapVerdict === "partial_overlap") {
    amberFlags.push(
      "Partial overlap with existing code — prefer extending existing helpers over forking."
    );
  }

  const created = input.units.filter(
    (u) => u.action === "create" && isProductionPath(u)
  );
  if (!input.searcher || created.length === 0) {
    return { issues, findings, amberFlags };
  }

  for (const unit of created) {
    const purpose =
      unit.symbols[0] ||
      unit.path.split("/").pop()?.replace(/\.[^.]+$/, "") ||
      unit.path;
    try {
      const hits = await input.searcher(
        `${purpose} ${unit.hunkPreview}`.slice(0, 500)
      );
      const strong = (hits ?? []).filter(
        (h) =>
          h.similarity >= STRONG_SIMILARITY &&
          normalize(h.filePath) !== normalize(unit.path)
      );
      if (strong.length === 0) continue;
      const top = strong[0]!;
      const documentedFork = /fork|duplicate|legacy|compat/i.test(
        unit.hunkPreview
      );
      const finding: GateFinding = {
        code: "REDUNDANT_IMPLEMENTATION",
        message: `New ${unit.path} closely matches existing ${top.filePath} (similarity ${top.similarity.toFixed(2)})`,
        severity: documentedFork ? "warning" : "error",
        path: unit.path,
      };
      findings.push(finding);
      if (finding.severity === "error") {
        issues.push({
          code: "REDUNDANT_IMPLEMENTATION",
          severity: "error",
          message: `${finding.message}. Extend the existing path or document why a fork is required.`,
          path: unit.path,
        });
      } else {
        amberFlags.push(finding.message);
      }
    } catch {
      amberFlags.push(`Duplicate search unavailable for ${unit.path}.`);
    }
  }

  return { issues, findings, amberFlags };
}

function normalize(path: string): string {
  return path.replace(/\\/g, "/").toLowerCase();
}
