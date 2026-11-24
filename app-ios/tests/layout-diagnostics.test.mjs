import assert from "node:assert/strict";
import { test } from "node:test";
import { layoutPass } from "../src/board/layout.ts";

test("layout reports visual operations that exceed the safe area budget", () => {
  const result = layoutPass([
    { op: "box", at: [2, 3], w: 90, h: 70, label: "Área demasiado grande" },
  ], []);
  assert.equal(result.ops.length, 0);
  assert.equal(result.dropped, 1);
});
