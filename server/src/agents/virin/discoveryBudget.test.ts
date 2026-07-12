import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveDiscoveryBudget } from "./discoveryBudget";
import type { IntakeOutput } from "./types";

function intake(
  ticketType: IntakeOutput["ticketType"],
  extras: Partial<IntakeOutput> = {}
): IntakeOutput {
  return {
    ticketType,
    reasoning: "classified for test",
    symptomVsRootCause: "Symptom: x. Root cause hypothesis: y.",
    ...extras,
  };
}

const richDescription = "A".repeat(950);
const sparseDescription = "Fix it";

describe("resolveDiscoveryBudget", () => {
  it("gives bug/task a low ceiling (not 12)", () => {
    const bug = resolveDiscoveryBudget({
      intake: intake("bug"),
      ticket: {
        summary: "Login button misaligned on settings",
        description: richDescription,
        priority: "Medium",
        labels: [],
      },
    });
    assert.ok(bug.maxTurns <= 4, `bug budget should be <= 4, got ${bug.maxTurns}`);
    assert.ok(bug.maxTurns >= 2);
    assert.equal(bug.highImportance, false);

    const task = resolveDiscoveryBudget({
      intake: intake("task"),
      ticket: {
        summary: "Update copy on pricing page",
        description: richDescription,
        priority: "Low",
        labels: [],
      },
    });
    assert.ok(task.maxTurns <= 4);
  });

  it("gives large_feature + high priority a higher ceiling under hard max 12", () => {
    const budget = resolveDiscoveryBudget({
      intake: intake("large_feature"),
      ticket: {
        summary: "Rebuild billing entitlements platform",
        description: sparseDescription,
        priority: "Highest",
        labels: ["revenue"],
      },
    });
    assert.ok(budget.maxTurns >= 6, `expected >= 6, got ${budget.maxTurns}`);
    assert.ok(budget.maxTurns <= 12);
    assert.ok(budget.maxTurns <= 10, "large_feature soft-capped at 10");
    assert.equal(budget.highImportance, true);
    assert.match(budget.rationale, /ceiling, not a quota/i);
  });

  it("reduces budget for easy/local codebase signals", () => {
    const base = resolveDiscoveryBudget({
      intake: intake("small_feature"),
      ticket: {
        summary: "Add tooltip to export button",
        description: "Users want a short tooltip on the export CSV button in reports.",
        priority: "Medium",
        labels: [],
      },
    });
    const easy = resolveDiscoveryBudget({
      intake: intake("small_feature"),
      ticket: {
        summary: "Add tooltip to export button",
        description: "Users want a short tooltip on the export CSV button in reports.",
        priority: "Medium",
        labels: [],
      },
      codebaseEase: {
        similarTicketCount: 2,
        candidateModuleCount: 2,
        componentBugCount: 0,
      },
    });
    assert.ok(
      easy.maxTurns < base.maxTurns,
      `easy (${easy.maxTurns}) should be lower than base (${base.maxTurns})`
    );
    assert.ok(easy.maxTurns >= 2);
  });

  it("increases budget for sparse ticket bodies", () => {
    const sparse = resolveDiscoveryBudget({
      intake: intake("task"),
      ticket: {
        summary: "Do the thing",
        description: "pls",
        priority: "Medium",
        labels: [],
      },
    });
    const rich = resolveDiscoveryBudget({
      intake: intake("task"),
      ticket: {
        summary: "Do the thing with clear acceptance",
        description: richDescription,
        priority: "Medium",
        labels: [],
      },
    });
    assert.ok(sparse.maxTurns > rich.maxTurns);
  });

  it("never exceeds hard ceiling of 12 or goes below floor of 2", () => {
    const budget = resolveDiscoveryBudget({
      intake: intake("large_feature", {
        reasoning: "security compliance migration revenue billing auth",
        symptomVsRootCause: "security payment SSO GDPR platform core",
      }),
      ticket: {
        summary: "Enterprise SSO + billing + security migration",
        description: "x",
        priority: "Highest",
        labels: ["security", "billing", "compliance"],
      },
      codebaseEase: {
        similarTicketCount: 0,
        candidateModuleCount: 20,
        componentBugCount: 50,
      },
    });
    assert.ok(budget.maxTurns <= 12);
    assert.ok(budget.maxTurns >= 2);
  });
});

describe("discovery budget early-ready contract", () => {
  it("documents that maxTurns is a ceiling used by the question loop", () => {
    // Orchestrator uses state.maxTurns from resolveDiscoveryBudget and stops
    // when the model returns action "ready" — budget must stay below the old
    // default of 12 for simple bugs so the prompt does not read as a quota.
    const budget = resolveDiscoveryBudget({
      intake: intake("bug"),
      ticket: {
        summary: "NPE when saving draft",
        description: richDescription,
        priority: "Medium",
        labels: [],
      },
      codebaseEase: {
        similarTicketCount: 3,
        candidateModuleCount: 1,
        componentBugCount: 1,
      },
    });
    assert.ok(budget.maxTurns < 12);
    assert.ok(budget.rationale.includes("Prefer early ready") || budget.maxTurns <= 4);
  });
});
