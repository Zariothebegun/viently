import assert from "node:assert/strict";
import { test } from "node:test";
import { layoutPass, opBBox } from "../src/board/layout.ts";
import { LINE_H, wrapText } from "../src/board/geom.ts";

function overlap(a, b) {
  return Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) *
    Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
}

test("text bounds reserve every line actually rendered", () => {
  const text = Array.from({ length: 18 }, () => "palavra").join(" ");
  const box = opBBox({ op: "text", text, at: [10, 20], size: "m", fit_w: 22 });
  assert.ok(box);
  assert.ok(box[3] - box[1] >= 2 * LINE_H.m);
});

test("long technical tokens are wrapped instead of escaping the board", () => {
  const lines = wrapText("x".repeat(100), "s", 20);
  assert.ok(lines.length > 1);
  assert.ok(lines.every((line) => line.length <= Math.floor(20 / 1.45)));
});

test("hotspot bounds include the label and stay inside the logical canvas", () => {
  const box = opBBox({ op: "hotspot", at: [94, 38], label: "componente" });
  assert.ok(box);
  assert.ok(box[0] < 94);
  assert.ok(box[2] <= 100);
  assert.ok(box[1] >= 0);
  assert.ok(box[3] <= 75);
});

test("scene children are collision-laid out without changing their timing", () => {
  const scene = {
    op: "scene",
    duration_ms: 2200,
    elements: [
      { at_ms: 0, duration_ms: 900, op: { op: "box", at: [20, 22], w: 24, h: 14, label: "Entrada" } },
      { at_ms: 500, duration_ms: 1200, op: { op: "box", at: [20, 22], w: 24, h: 14, label: "Saída" } },
    ],
  };
  const result = layoutPass([scene], []);
  assert.equal(result.ops.length, 1);
  const laidOut = result.ops[0];
  assert.equal(laidOut.op, "scene");
  assert.equal(laidOut.elements.length, 2);
  assert.equal(laidOut.elements[0].at_ms, 0);
  assert.equal(laidOut.elements[0].duration_ms, 900);
  assert.equal(laidOut.elements[1].at_ms, 500);
  assert.equal(laidOut.elements[1].duration_ms, 1200);
  const first = opBBox(laidOut.elements[0].op);
  const second = opBBox(laidOut.elements[1].op);
  assert.ok(first && second);
  assert.equal(overlap(first, second), 0);
});
