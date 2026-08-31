import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mergeParsedTestRuns, parseTestOutput } from "./testParser";

describe("parseTestOutput", () => {
  it("parses pytest verbose lines", () => {
    const parsed = parseTestOutput(`
tests/test_calc.py::test_add PASSED
tests/test_calc.py::test_div FAILED
tests/test_calc.py::test_skip SKIPPED
`);
    assert.equal(parsed.total, 3);
    assert.equal(parsed.passed, 1);
    assert.equal(parsed.failed, 1);
    assert.equal(parsed.skipped, 1);
    assert.equal(parsed.testResults[0].testName, "tests/test_calc.py::test_add");
  });

  it("merges vitest-style and pytest runs", () => {
    const merged = mergeParsedTestRuns([
      parseTestOutput("tests/test_calc.py::test_add PASSED"),
      parseTestOutput("tests/test_calc.py::test_div FAILED"),
    ]);
    assert.equal(merged.total, 2);
    assert.equal(merged.passed, 1);
    assert.equal(merged.failed, 1);
  });
});
