import assert from "node:assert/strict";
import { test } from "node:test";
import { parseLesson, sanitizeOps } from "../src/lesson/generate.ts";

test("the renderer receives no more than one 3D model", () => {
  const ops = sanitizeOps([
    { op: "model3d", model: "cell" },
    { op: "model3d", model: "motor" },
  ]);
  assert.equal(ops.filter((op) => op.op === "model3d").length, 1);
  assert.equal(ops[0].op, "model3d");
});

test("hotspot count is bounded to four and malformed hotspots are rejected", () => {
  const ops = sanitizeOps(Array.from({ length: 6 }, (_, index) => ({
    op: "hotspot",
    at: [index * 10, 20],
    label: `Parte ${index}`,
    detail: "Explicação da parte.",
  })));
  assert.equal(ops.filter((op) => op.op === "hotspot").length, 4);
  assert.equal(sanitizeOps([{ op: "hotspot", at: [10, 10], label: "Parte", detail: "" }]).length, 0);
});

test("a concise one-operation diagram is accepted as a valid lesson", () => {
  const lesson = parseLesson(JSON.stringify({
    title: "Memória RAM",
    say: "A RAM guarda dados temporários.",
    note: "A RAM guarda dados temporários.",
    board: [{ op: "box", at: [10, 10], w: 40, h: 20, label: "RAM" }],
    suggestions: ["Dá um exemplo", "Compara com SSD"],
  }));
  assert.equal(lesson.steps.length, 1);
  assert.equal(lesson.steps[0].board.length, 1);
});

test("destructive-only boards are rejected instead of becoming blank lessons", () => {
  assert.throws(() => parseLesson(JSON.stringify({
    say: "Texto de exemplo.",
    note: "Texto de exemplo.",
    board: [{ op: "clear" }],
    suggestions: ["Exemplo", "Mais detalhe"],
  })), /passos utilizáveis/);
});
