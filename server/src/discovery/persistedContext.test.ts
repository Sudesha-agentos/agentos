import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  answersCoverAllQuestions,
  formatHumanAnswersJson,
  humanAnswersPromptBlock,
} from "./persistedContext";

describe("human discovery answers", () => {
  it("serializes answers as JSON for the next LLM step", () => {
    const json = formatHumanAnswersJson([
      { question: "Should divide throw?", answer: "Yes, throw on divide by zero", status: "answered" },
    ]);
    const parsed = JSON.parse(json) as { humanAnswers: Array<{ question: string; answer: string }> };
    assert.equal(parsed.humanAnswers.length, 1);
    assert.equal(parsed.humanAnswers[0].answer, "Yes, throw on divide by zero");
    assert.match(humanAnswersPromptBlock(parsed.humanAnswers), /HUMAN_ANSWERS_JSON/);
  });

  it("returns empty when there are no answers", () => {
    assert.equal(formatHumanAnswersJson([]), "");
    assert.equal(humanAnswersPromptBlock(undefined), "");
  });

  it("does not cover the next stage until every question has an answer", () => {
    const questions = ["Should divide throw?", "What precision?"];
    assert.equal(
      answersCoverAllQuestions(questions, [
        { question: "Should divide throw?", answer: "Yes", status: "answered" },
      ]),
      false
    );
    assert.equal(
      answersCoverAllQuestions(questions, [
        { question: "Should divide throw?", answer: "Yes", status: "answered" },
        { question: "What precision?", answer: "Two decimals", status: "answered" },
      ]),
      true
    );
    assert.equal(
      answersCoverAllQuestions(questions, [
        { question: "Should divide throw?", answer: "Yes", status: "answered" },
        { question: "What precision?", answer: "", status: "dismissed" },
      ]),
      false
    );
    assert.equal(answersCoverAllQuestions([], [{ question: "Q", answer: "A" }]), true);
  });
});
