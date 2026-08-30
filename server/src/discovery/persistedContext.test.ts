import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  answersCoverAllQuestions,
  buildGapQuestions,
  buildPrdOpenQuestions,
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

  it("builds gap and PRD questions that must be answered before engineering", () => {
    const gapQuestions = buildGapQuestions({
      knownUnknowns: [
        {
          gap: "What happens on divide by zero?",
          resolutionRequired: true,
          suggestedResolution: "Throw or return null",
          defaultAssumption: "Throw",
        },
        {
          gap: "Nice-to-have animation",
          resolutionRequired: false,
          suggestedResolution: "Skip",
          defaultAssumption: "Skip",
        },
      ],
    });
    assert.equal(gapQuestions.length, 1);
    assert.equal(gapQuestions[0].question, "What happens on divide by zero?");
    assert.equal(
      answersCoverAllQuestions(gapQuestions, [
        { question: "What happens on divide by zero?", answer: "Throw", status: "answered" },
      ]),
      true
    );

    const prdQuestions = buildPrdOpenQuestions([
      { question: "Which locale for currency?", defaultAssumption: "en-US" },
      "  ",
    ]);
    assert.equal(prdQuestions.length, 1);
    assert.equal(prdQuestions[0].question, "Which locale for currency?");
    assert.equal(answersCoverAllQuestions(prdQuestions, []), false);
  });
});
