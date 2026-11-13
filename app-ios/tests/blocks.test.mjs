import assert from "node:assert/strict";
import { test } from "node:test";
import { tokenizeLine, visibleChars, codeTotalChars } from "../src/board/code.ts";
import { surfaceQuads, surfacePath, ridgelines, density, mix } from "../src/board/plot3d.ts";
import { sanitizeOps } from "../src/lesson/generate.ts";
import { opBBox } from "../src/board/layout.ts";
import { timingOf } from "../src/board/timeline.ts";

test("tokenizer preserves every character", () => {
  for (const line of ['rng = np.random.default_rng(28)  # seed', 'x = "a\\\"b" + 3.5e2', "    for i in range(5):"]) {
    assert.equal(tokenizeLine(line).map((t) => t.text).join(""), line);
  }
  assert.equal(tokenizeLine("import numpy")[0].kind, "kw");
});

test("code reveal advances sequentially, line by line", () => {
  const lines = ["abc", "de"];
  assert.deepEqual(visibleChars(lines, 4), [3, 1]);
  assert.equal(codeTotalChars(lines), 5);
});

test("surface mesh stays finite and depth-sorted across functions and rotations", () => {
  for (const fn of ["gaussian", "saddle", "bowl", "wave", "ripple"]) {
    for (const az of [0, 0.5, 1.05]) {
      const quads = surfaceQuads(fn, az, 70, 44, 12);
      assert.equal(quads.length, 144);
      assert.ok(quads.every((q) => q.pts.flat().every(Number.isFinite) && q.z >= 0 && q.z <= 1));
      for (let i = 1; i < quads.length; i++) assert.ok(quads[i - 1].depth >= quads[i].depth);
    }
  }
  assert.equal(surfacePath("bowl", [[-1, -1], [0, 0]], 0.7, 70, 44).length, 2);
});

test("ridgelines and density remain finite", () => {
  assert.ok(density(0, 0, 1) > density(2, 0, 1));
  const curves = ridgelines([{ mean: 1, spread: 1 }, { mean: 2, spread: 3, skew: 3 }], 80, 40);
  assert.equal(curves.length, 2);
  assert.ok(curves.every((r) => [...r.baseline, ...r.outline, ...r.median].flat().every(Number.isFinite)));
  assert.ok(curves[1].baseline[0][1] > curves[0].baseline[0][1]);
  assert.equal(mix("#000000", "#ffffff", 1), "#ffffff");
});

test("new visual operations are sanitized and bounded", () => {
  const ops = sanitizeOps([
    { op: "code", lines: Array.from({ length: 40 }, (_, i) => "x".repeat(100) + i), focus: [0, 2, 2, 99, 3] },
    { op: "plot3d", kind: "surface", fn: "evil()", path: [[5, -9], [0, 0]] },
    { op: "plot3d", kind: "ridgeline", groups: [{ mean: 1, spread: 0 }] },
    { op: "plot3d", kind: "ridgeline", groups: [{ mean: 1, spread: 1 }, { mean: 2, spread: 2 }] },
  ]);
  assert.equal(ops.length, 3);
  assert.equal(ops[0].lines.length, 16);
  assert.ok(ops[0].lines.every((line) => line.length <= 52));
  assert.deepEqual(ops[0].focus, [2, 3]);
  assert.equal(ops[1].fn, "gaussian");
  assert.deepEqual(ops[1].path[0], [1, -1]);
  const fromString = sanitizeOps([{ op: "code", code: "let x = 1  \n\tprint(x)  " }]);
  assert.deepEqual(fromString[0].lines, ["let x = 1", "    print(x)"]);
});

test("code and plot blocks have layout bounds and timelines", () => {
  const [code, plot] = sanitizeOps([
    { op: "code", lines: ["a = 1", "b = 2"], focus: [1, 2] },
    { op: "plot3d", kind: "surface", fn: "bowl", path: [[1, 1], [0, 0]] },
  ]);
  assert.ok(opBBox(code) && opBBox(plot));
  assert.equal(timingOf({ id: "code", seed: 1, op: code }).parts.length, 4);
  assert.equal(timingOf({ id: "plot", seed: 1, op: plot }).parts.length, 3);
});
