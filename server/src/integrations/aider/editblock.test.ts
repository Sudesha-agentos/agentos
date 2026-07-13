import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyAiderReplace,
  parseAiderEditBlocks,
  replaceMostSimilarChunk,
} from "./editblock";

describe("aider editblock port", () => {
  it("applies exact SEARCH/REPLACE", () => {
    const whole = "function a() {\n  return 1;\n}\n";
    const next = replaceMostSimilarChunk(
      whole,
      "  return 1;\n",
      "  return 2;\n"
    );
    assert.equal(next, "function a() {\n  return 2;\n}\n");
  });

  it("tolerates missing leading whitespace", () => {
    const whole = "  const x = 1;\n  const y = 2;\n";
    const next = applyAiderReplace(whole, "const x = 1;\n", "const x = 9;\n");
    assert.ok(next?.includes("const x = 9"));
  });

  it("parses Aider blocks from text", () => {
    const raw = `foo.ts
<<<<<<< SEARCH
a
=======
b
>>>>>>> REPLACE
`;
    const edits = parseAiderEditBlocks(raw);
    assert.equal(edits.length, 1);
    assert.equal(edits[0]?.filePath, "foo.ts");
    assert.ok(edits[0]?.search.includes("a"));
    assert.ok(edits[0]?.replace.includes("b"));
  });
});
