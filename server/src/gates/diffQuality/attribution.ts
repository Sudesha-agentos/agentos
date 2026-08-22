import type { ValidationIssue } from "../../types/pipeline";
import type { GateFinding } from "../../types/pipeline";
import type { ImplementationOutput, PrdOutput } from "../../types/agents";
import type { OriginalTicketEvidence } from "../originalTicket";
import { originalTicketText } from "../originalTicket";
import { isProductionPath, type DiffUnit } from "./parseDiff";
import { significantTokens, tokenOverlap } from "./tokens";

export function checkAttribution(input: {
  units: DiffUnit[];
  prd?: PrdOutput;
  ticket?: OriginalTicketEvidence;
  implementation?: ImplementationOutput;
}): { issues: ValidationIssue[]; findings: GateFinding[]; amberFlags: string[] } {
  const issues: ValidationIssue[] = [];
  const findings: GateFinding[] = [];
  const amberFlags: string[] = [];

  const requirements = buildRequirementSet(input.prd, input.ticket);
  const mapping = input.implementation?.criteriaMapping ?? [];
  const diffPaths = new Set(input.units.map((u) => normalizePath(u.path)));

  for (const entry of mapping) {
    const cited = [...(entry.files ?? []), ...(entry.symbols ?? [])];
    if (cited.length === 0) {
      amberFlags.push(
        `criteriaMapping for "${entry.criterion.slice(0, 60)}" does not cite diff files/symbols.`
      );
      continue;
    }
    const citesDiff = (entry.files ?? []).some((file) =>
      diffPaths.has(normalizePath(file))
    );
    if ((entry.files ?? []).length > 0 && !citesDiff) {
      issues.push({
        code: "ATTRIBUTION_MISSING",
        severity: "error",
        message: `criteriaMapping cites files that are not in the workspace diff for: "${entry.criterion.slice(0, 80)}"`,
      });
    }
  }

  for (const unit of input.units) {
    if (unit.action === "delete") continue;
    const linked = unitMatchesRequirement(unit, requirements, mapping);
    if (linked) continue;

    const finding: GateFinding = {
      code: "ATTRIBUTION_MISSING",
      message: `No requirement link for ${unit.path}${
        unit.symbols.length ? ` (${unit.symbols.slice(0, 4).join(", ")})` : ""
      }`,
      severity: isProductionPath(unit) ? "error" : "warning",
      path: unit.path,
      symbol: unit.symbols[0],
    };
    findings.push(finding);
    if (finding.severity === "error") {
      issues.push({
        code: "ATTRIBUTION_MISSING",
        severity: "error",
        message: finding.message,
        path: unit.path,
      });
    } else {
      amberFlags.push(finding.message);
    }
  }

  return { issues, findings, amberFlags };
}

function buildRequirementSet(
  prd?: PrdOutput,
  ticket?: OriginalTicketEvidence
): string[] {
  return [
    ...(prd?.acceptanceCriteria ?? []),
    ...(prd?.userStories ?? []),
    prd?.problemStatement,
    prd?.proposedSolution,
    ticket ? originalTicketText(ticket) : "",
  ].filter((s): s is string => Boolean(s?.trim()));
}

function unitMatchesRequirement(
  unit: DiffUnit,
  requirements: string[],
  mapping: NonNullable<ImplementationOutput["criteriaMapping"]>
): boolean {
  const pathLeaf = unit.path.split("/").pop()?.replace(/\.[^.]+$/, "") ?? "";
  const citedByMapping = mapping.some((m) =>
    (m.files ?? []).some((file) => normalizePath(file) === normalizePath(unit.path))
  );
  if (citedByMapping) return true;

  const linkedMapping = mapping.filter((m) => {
    const blob = `${m.implementation} ${(m.files ?? []).join(" ")} ${(m.symbols ?? []).join(" ")}`.toLowerCase();
    return (
      (pathLeaf && blob.includes(pathLeaf.toLowerCase())) ||
      unit.symbols.some((symbol) => blob.includes(symbol.toLowerCase()))
    );
  });
  if (linkedMapping.length > 0) return true;

  const unitTokens = significantTokens(
    `${unit.path} ${unit.symbols.join(" ")} ${unit.hunkPreview}`
  );
  for (const req of requirements) {
    if (tokenOverlap(unitTokens, significantTokens(req)) >= 0.12) return true;
  }

  return false;
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\.\//, "").toLowerCase();
}
