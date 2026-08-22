import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runGate } from "./runGate";
import { finalizeGateResult } from "./result";
import { parseDiffUnits } from "./diffQuality/parseDiff";
import { checkAttribution } from "./diffQuality/attribution";
import { checkMinimality } from "./diffQuality/minimality";
import { checkIntentDriftTicketToPrd, checkIntentDriftTicketToDiff } from "./diffQuality/intentDrift";
import type { PrdOutput } from "../types/agents";

const prd: PrdOutput = {
  title: "Export audit log",
  problemStatement: "Operators cannot export audit events for compliance review.",
  proposedSolution: "Add a CSV export endpoint and a download button on the audit page.",
  userStories: ["As an operator I want to export audit events so I can share them with compliance"],
  acceptanceCriteria: [
    "Given an operator When they click Export Then a CSV of audit events downloads",
    "Given a request without permission When they hit export Then the API returns 403",
  ],
  outOfScope: ["PDF export"],
  edgeCases: ["Empty audit log returns an empty CSV"],
  dependencies: [],
  successMetrics: ["Export used weekly"],
  openQuestions: [],
  confidenceScore: 0.85,
  confidenceReason: "Clear ticket",
};

describe("gate framework", () => {
  it("blocks Virin discovery without a summary after questions", async () => {
    const result = await runGate("virin_discovery", {
      virinMode: "interactive",
      pmRecord: {
        questionMode: {
          conversation: [
            {
              question: "Who is the user?",
              answer: "Ops",
              askedAt: "2026-01-01",
            },
          ],
          discoverySummary: "",
          readyToProceed: false,
          flagsRaised: [],
        },
      } as never,
    });
    assert.equal(result.passed, false);
    assert.ok(result.blockingIssueCodes.includes("DISCOVERY_INCOMPLETE"));
  });

  it("flags PRD requirements that are not in the original ticket", async () => {
    const result = await runGate("prd", {
      prd: {
        ...prd,
        acceptanceCriteria: [
          ...prd.acceptanceCriteria,
          "Given a shopper When they apply a discount code Then checkout totals update live",
        ],
      },
      ticket: {
        summary: "Add CSV export for audit events",
        description: "Operators need to download audit events as CSV from the audit page.",
        comments: "",
      },
      prdSource: "pm_agents",
    });
    assert.equal(result.passed, false);
    assert.ok(result.issues.some((i) => i.code === "INTENT_DRIFT"));
  });

  it("blocks implementation when a production file has no requirement link", async () => {
    const result = await runGate("implementation", {
      prd,
      implementation: {
        summary: "Add a discount engine while exporting audit logs as requested.",
        technicalApproach: "New discount helper plus export route",
        components: [{ name: "export", description: "CSV export route", estimatedDays: 1 }],
        apiChanges: ["GET /audit/export"],
        databaseChanges: [],
        dependencies: [],
        risks: [{ description: "CSV size", severity: "low", mitigation: "stream" }],
        totalEstimateDays: 1,
        criteriaMapping: prd.acceptanceCriteria.map((c) => ({
          criterion: c,
          implementation: "audit export route in server/src/api/auditExport.ts",
          files: ["server/src/api/auditExport.ts"],
        })),
        blockers: [],
        confidenceScore: 0.9,
        confidenceReason: "Mapped to export files",
        codeChanges: [
          {
            filePath: "server/src/api/auditExport.ts",
            action: "create",
            summary: "CSV export",
            linesChanged: 40,
          },
          {
            filePath: "src/unrelated/telemetryBeacon.ts",
            action: "create",
            summary: "Unrelated telemetry beacon",
            linesChanged: 80,
          },
        ],
      },
      ticket: {
        summary: "Add CSV export for audit events",
        description: "Operators need to download audit events as CSV.",
        comments: "",
      },
      duplicateSearcher: async () => [],
    });
    assert.equal(result.passed, false);
    assert.ok(result.blockingIssueCodes.includes("ATTRIBUTION_MISSING"));
  });
});

describe("diff quality heuristics", () => {
  it("parses added symbols from a unified diff", () => {
    const units = parseDiffUnits({
      diffText: `diff --git a/src/util.ts b/src/util.ts
+++ b/src/util.ts
+export function formatAuditCsv(rows: Row[]) {
+  return rows.map(r => r.id).join("\\n");
+}
`,
    });
    assert.equal(units[0]?.path, "src/util.ts");
    assert.ok(units[0]?.symbols.includes("formatAuditCsv"));
  });

  it("attribution errors on unlinked production files", () => {
    const { issues } = checkAttribution({
      units: [
        {
          path: "src/mystery.ts",
          action: "create",
          addedLines: 20,
          symbols: ["doMystery"],
          hunkPreview: "export function doMystery() {}",
          isTest: false,
          isLockfile: false,
          isFormattingLikely: false,
        },
      ],
      prd,
      ticket: {
        summary: "Export audit CSV",
        description: "Add CSV download for audit events",
        comments: "",
      },
      implementation: {
        ...({} as never),
        criteriaMapping: [
          {
            criterion: prd.acceptanceCriteria[0]!,
            implementation: "export route",
            files: ["src/auditExport.ts"],
          },
        ],
      },
    });
    assert.ok(issues.some((i) => i.code === "ATTRIBUTION_MISSING"));
  });

  it("minimality flags unused public exports", () => {
    const { issues } = checkMinimality({
      units: [
        {
          path: "src/helpers/newApi.ts",
          action: "create",
          addedLines: 30,
          symbols: ["UnusedHelper"],
          hunkPreview: "export class UnusedHelper {}",
          isTest: false,
          isLockfile: false,
          isFormattingLikely: false,
        },
      ],
      prd,
    });
    assert.ok(issues.some((i) => i.code === "NON_MINIMAL"));
  });

  it("intent-drift catches PRD-only extras", () => {
    const { issues } = checkIntentDriftTicketToPrd({
      ticket: {
        summary: "Export audit CSV",
        description: "Add a CSV download of audit events for operators.",
        comments: "",
      },
      prd: {
        ...prd,
        acceptanceCriteria: [
          ...prd.acceptanceCriteria,
          "Given a shopper When they apply a loyalty discount Then the cart total updates",
        ],
      },
    });
    assert.ok(issues.some((i) => i.code === "INTENT_DRIFT"));
  });

  it("intent-drift ticket-to-diff flags uncovered asks", () => {
    const { issues } = checkIntentDriftTicketToDiff({
      ticket: {
        summary: "Export audit CSV",
        description: "Implement a CSV export of audit events from the audit page.",
        comments: "",
      },
      units: [
        {
          path: "src/theme/colors.ts",
          action: "modify",
          addedLines: 2,
          symbols: ["palette"],
          hunkPreview: "export const palette = { pink: true }",
          isTest: false,
          isLockfile: false,
          isFormattingLikely: false,
        },
      ],
      implementationSummary: "Tweaked theme colors",
    });
    assert.ok(issues.some((i) => i.code === "INTENT_DRIFT"));
  });
});

describe("finalizeGateResult", () => {
  it("amber never blocks", () => {
    const result = finalizeGateResult({
      gateId: "qa",
      issues: [{ code: "X", message: "warn", severity: "warning" }],
      amberFlags: ["size ratio"],
    });
    assert.equal(result.passed, true);
    assert.deepEqual(result.blockingIssueCodes, []);
  });
});
