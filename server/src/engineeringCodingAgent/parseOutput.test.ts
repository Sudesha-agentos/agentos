import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  codingSummaryFromChanges,
  mergeCodingChanges,
  parseCodingAgentOutput,
} from "./parseOutput";

describe("parseCodingAgentOutput", () => {
  it("parses a clean coding summary", () => {
    const parsed = parseCodingAgentOutput(
      JSON.stringify({
        codingSummary: "Added divide-by-zero handling",
        codeChanges: [{ filePath: "src/calc.ts", action: "modify", summary: "throw on /0" }],
      })
    );
    assert.equal(parsed?.codingSummary, "Added divide-by-zero handling");
    assert.equal(parsed?.codeChanges[0]?.filePath, "src/calc.ts");
  });

  it("recovers JSON buried in a code dump", () => {
    const raw = `
Implemented the calculator.

function add(a, b) { return a + b }

{"codingSummary":"Wrote calculator","codeChanges":[{"filePath":"src/calc.js","action":"create","summary":"new file"}]}
`;
    const parsed = parseCodingAgentOutput(raw);
    assert.equal(parsed?.codingSummary, "Wrote calculator");
    assert.equal(parsed?.codeChanges[0]?.filePath, "src/calc.js");
  });

  it("returns undefined for prose with no JSON", () => {
    assert.equal(parseCodingAgentOutput("I updated the files and we are done."), undefined);
  });

  it("uses workspace changes when the model summary is missing", () => {
    const changes = mergeCodingChanges([], [
      [],
      [{ filePath: "src/calc.ts", action: "modify", summary: "modified by engineering agent" }],
    ]);
    assert.equal(changes.length, 1);
    assert.equal(
      codingSummaryFromChanges(undefined, changes, "SIM-1"),
      "Ananta finished on the workspace for SIM-1 (1 file)."
    );
  });
});
