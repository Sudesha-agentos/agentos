import type { ValidationIssue, GateFinding } from "../../types/pipeline";
import type { PrdOutput } from "../../types/agents";
import { isProductionPath, type DiffUnit } from "./parseDiff";
import { significantTokens } from "./tokens";

const LINES_PER_AC_AMBER = 120;

export function checkMinimality(input: {
  units: DiffUnit[];
  prd?: PrdOutput;
}): { issues: ValidationIssue[]; findings: GateFinding[]; amberFlags: string[] } {
  const issues: ValidationIssue[] = [];
  const findings: GateFinding[] = [];
  const amberFlags: string[] = [];
  const acCount = Math.max(1, input.prd?.acceptanceCriteria?.length ?? 1);
  const created = input.units.filter((u) => u.action === "create");
  const allAdded = input.units.reduce((sum, u) => sum + u.addedLines, 0);

  if (allAdded / acCount > LINES_PER_AC_AMBER) {
    amberFlags.push(
      `Diff adds ~${allAdded} lines across ${acCount} acceptance criteria — check for speculative extras.`
    );
  }

  const depth =
    created
      .map((u) => u.path.split("/").filter(Boolean).length)
      .sort((a, b) => b - a)[0] ?? 0;
  if (created.length >= 3 && depth >= 6) {
    amberFlags.push(
      `New folder tree is deep (${depth} segments) for this ticket — confirm the extra structure is required.`
    );
  }

  const acTokens = significantTokens(
    (input.prd?.acceptanceCriteria ?? []).join(" ")
  );

  for (const unit of created.filter(isProductionPath)) {
    const unusedExports = unit.symbols.filter((symbol) => {
      const needle = symbol.toLowerCase();
      return !input.units.some(
        (other) =>
          other.path !== unit.path &&
          (other.hunkPreview.toLowerCase().includes(needle) ||
            other.symbols.some((s) => s.toLowerCase() === needle))
      );
    });

    const looksPublic = unusedExports.filter((s) => /^[A-Z]/.test(s) || s.startsWith("use"));
    if (looksPublic.length > 0) {
      const finding: GateFinding = {
        code: "NON_MINIMAL",
        message: `Unused new public API in ${unit.path}: ${looksPublic.slice(0, 4).join(", ")}`,
        severity: "error",
        path: unit.path,
        symbol: looksPublic[0],
      };
      findings.push(finding);
      issues.push({
        code: "NON_MINIMAL",
        severity: "error",
        message: finding.message,
        path: unit.path,
      });
    }

    if (/\.(env|config|ya?ml|json)$/i.test(unit.path) || /config/i.test(unit.path)) {
      const configKeys = unit.symbols.filter((s) => !acTokens.has(s.toLowerCase()));
      if (configKeys.length > 0 && acTokens.size > 0) {
        issues.push({
          code: "NON_MINIMAL",
          severity: "error",
          message: `New config keys in ${unit.path} are not referenced by acceptance criteria: ${configKeys.slice(0, 4).join(", ")}`,
          path: unit.path,
        });
      }
    }
  }

  return { issues, findings, amberFlags };
}
