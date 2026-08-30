import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { closeTruncatedJson, recoverJsonText, tryParseJsonObject } from "./parseJson";

describe("parseJson", () => {
  it("recovers fenced JSON", () => {
    const parsed = tryParseJsonObject('```json\n{"title":"Calc"}\n```');
    assert.deepEqual(parsed, { title: "Calc" });
  });

  it("strips trailing commas", () => {
    const parsed = tryParseJsonObject('{"title":"Calc","items":[1,2,],}');
    assert.deepEqual(parsed, { title: "Calc", items: [1, 2] });
  });

  it("closes truncated objects", () => {
    const closed = closeTruncatedJson('{"title":"Calc","userStories":["add"');
    const parsed = JSON.parse(closed) as { title: string; userStories: string[] };
    assert.equal(parsed.title, "Calc");
    assert.equal(parsed.userStories[0], "add");
  });

  it("recovers truncated JSON via recoverJsonText", () => {
    const parsed = tryParseJsonObject('Here you go:\n{"title":"Calc","acceptanceCriteria":["div by zero throws"');
    assert.ok(parsed && typeof parsed === "object");
    assert.equal((parsed as { title: string }).title, "Calc");
  });
});
