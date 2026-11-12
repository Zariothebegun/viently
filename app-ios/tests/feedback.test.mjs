import assert from "node:assert/strict";
import { test } from "node:test";
import { recordCheckAnswer } from "../src/lesson/feedback.ts";

const check = {
  prompt: "Porque aumenta a corrente?",
  options: ["A tensão aumentou", "A resistência aumentou", "A carga desapareceu"],
  answer_index: 0,
  explanation: "Pela lei de Ohm, mantendo a resistência, maior tensão produz maior corrente.",
};

test("correct quiz answers are recorded with the selected option and explanation", () => {
  const history = [{ role: "user", content: "Explica a lei de Ohm." }];
  const next = recordCheckAnswer(history, check, 0);
  assert.ok(next);
  assert.equal(next.length, 3);
  assert.match(next[1].content, /A tensão aumentou/);
  assert.match(next[2].content, /resposta estava correcta/);
  assert.match(next[2].content, /lei de Ohm/);
  assert.equal(history.length, 1, "the original history must remain unchanged");
});

test("wrong quiz answers are explicitly recorded for targeted remediation", () => {
  const next = recordCheckAnswer([], check, 1);
  assert.ok(next);
  assert.match(next[0].content, /A resistência aumentou/);
  assert.match(next[2].content, /resposta estava incorrecta/);
});

test("invalid quiz selections are rejected", () => {
  assert.equal(recordCheckAnswer([], check, -1), null);
  assert.equal(recordCheckAnswer([], check, 3), null);
  assert.equal(recordCheckAnswer([], check, 1.5), null);
});
