import assert from "node:assert/strict";
import { test } from "node:test";
import { masteryProfile, updateMastery } from "../src/lesson/mastery.ts";

test("mastery evidence accumulates per normalized topic", () => {
  let store = updateMastery(null, "Lei de Ohm", true, 1);
  store = updateMastery(store, "lei-de-ohm", false, 2);
  const record = store.topics["lei de ohm"];
  assert.equal(record.attempts, 2);
  assert.equal(record.correct, 1);
  assert.deepEqual(record.recent, [true, false]);
});

test("one answer is treated as weak evidence, not mastery", () => {
  const store = updateMastery(null, "Fotossíntese", true, 1);
  const profile = masteryProfile(store, "fotossintese");
  assert.match(profile, /Evidência ainda limitada/);
  assert.match(profile, /não assumas/i);
});

test("repeated mistakes trigger remediation guidance", () => {
  let store = null;
  for (let i = 0; i < 4; i++) store = updateMastery(store, "Álgebra", false, i + 1);
  assert.match(masteryProfile(store, "algebra"), /sinais de dificuldade/);
});

test("consistent success advances the learner without declaring permanent mastery", () => {
  let store = null;
  for (let i = 0; i < 4; i++) store = updateMastery(store, "Geometria", true, i + 1);
  const profile = masteryProfile(store, "geometria");
  assert.match(profile, /aplicação, transferência e casos-limite/);
  assert.match(profile, /tarefas novas/);
});

test("empty topic does not create a record", () => {
  const store = updateMastery(null, "  ", true, 1);
  assert.deepEqual(store.topics, {});
});
