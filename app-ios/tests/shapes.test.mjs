import assert from "node:assert/strict";
import { Script } from "node:vm";
import { test } from "node:test";
import { SHAPE_LIMITS, safeJson, sanitizeShapes } from "../src/three/shapes.ts";
import { buildShapesHtml } from "../src/three/shapesHtml.ts";
import { sanitizeOps } from "../src/lesson/generate.ts";

const sun = { id: "Sol", shape: "sphere", pos: [0, 0, 0], size: 1.6, color: "yellow", label: "Sol" };
const earth = { id: "terra", shape: "sphere", pos: [3, 0, 0], size: 0.7, color: "blue", label: "Terra", note: "Uma volta por ano." };

function moduleSource(html) {
  const open = html.indexOf('<script type="module">');
  const close = html.indexOf("</script>", open);
  assert.ok(open >= 0 && close > open, "module script present");
  return html.slice(open + '<script type="module">'.length, close).replace(/^\s*import .*?;\s*$/gm, "");
}

test("an empty or malformed scene is rejected so the page falls back to 2D", () => {
  assert.equal(sanitizeShapes(null), null);
  assert.equal(sanitizeShapes("sphere"), null);
  assert.equal(sanitizeShapes({}), null);
  assert.equal(sanitizeShapes({ objects: [] }), null);
  assert.equal(sanitizeShapes({ objects: [{ shape: "dragon" }, 7, null] }), null);
});

test("objects are bounded, ids are unique and coordinates are clamped", () => {
  const many = Array.from({ length: 80 }, (_, i) => ({ id: "x", shape: "box", pos: [999, -999, NaN], size: [99, 0, "a"] }));
  const spec = sanitizeShapes({ objects: many });
  assert.equal(spec.objects.length, SHAPE_LIMITS.objects);
  assert.equal(new Set(spec.objects.map((o) => o.id)).size, spec.objects.length);
  for (const o of spec.objects) {
    assert.ok(o.pos.every((v) => Math.abs(v) <= SHAPE_LIMITS.coord));
    assert.ok(o.size.every((v) => v >= SHAPE_LIMITS.sizeMin && v <= SHAPE_LIMITS.sizeMax));
  }
});

test("unknown colors, shapes and cameras fall back to safe values", () => {
  const spec = sanitizeShapes({
    camera: "fisheye",
    objects: [{ shape: "box", color: "magenta", opacity: 7 }, { shape: "mesh" }],
  });
  assert.equal(spec.objects.length, 1);
  assert.equal(spec.objects[0].color, "blue");
  assert.equal(spec.objects[0].opacity, 1);
  assert.equal(spec.camera, "iso");
});

test("animations must target existing objects and use known types", () => {
  const spec = sanitizeShapes({
    objects: [sun, earth],
    anims: [
      { target: "terra", type: "orbit", around: "sol", speed: 0.2 },
      { target: "ghost", type: "spin" },
      { target: "terra", type: "teleport" },
      { target: "terra", type: "move" },
      { target: "terra", type: "move", path: [[1, 1, 1], [2, 2, 2]] },
    ],
  });
  assert.equal(spec.anims.length, 2);
  assert.equal(spec.anims[0].around, "sol");
  assert.equal(spec.anims[1].type, "move");
  assert.ok(spec.anims[1].duration_ms >= 300, "a move always has a duration");
});

test("an orbit never circles itself and falls back to a fixed centre", () => {
  const spec = sanitizeShapes({ objects: [earth], anims: [{ target: "terra", type: "orbit", around: "terra" }] });
  assert.equal(spec.anims[0].around, undefined);
  assert.deepEqual(spec.anims[0].center, [0, 0, 0]);
});

test("one-shot animations stay at their end state unless a loop is requested", () => {
  const spec = sanitizeShapes({
    objects: [earth],
    anims: [
      { target: "terra", type: "fade", to_opacity: 0.2 },
      { target: "terra", type: "color", to_color: "red", loop: true },
      { target: "terra", type: "spin" },
    ],
  });
  assert.equal(spec.anims[0].loop, false);
  assert.equal(spec.anims[1].loop, true);
  assert.equal(spec.anims[2].loop, true);
});

test("labels are trimmed and animation count is bounded", () => {
  const spec = sanitizeShapes({
    objects: [{ ...earth, label: "  uma etiqueta   muito muito muito comprida demais  ", note: "n".repeat(500) }],
    anims: Array.from({ length: 60 }, () => ({ target: "terra", type: "pulse" })),
  });
  assert.ok(spec.objects[0].label.length <= SHAPE_LIMITS.label);
  assert.ok(spec.objects[0].note.length <= SHAPE_LIMITS.note);
  assert.equal(spec.anims.length, SHAPE_LIMITS.anims);
});

test("model3d shapes is accepted by sanitizeOps and counts as the single 3D model", () => {
  const ops = sanitizeOps([
    { op: "model3d", model: "shapes", title: "Órbita", shapes: { objects: [sun, earth], anims: [{ target: "terra", type: "orbit", around: "sol" }] } },
    { op: "model3d", model: "shapes", shapes: { objects: [{ id: "a", shape: "box", pos: [0,0,0], size: [1,1,1], rot: [0,0,0], color: "blue", opacity: 1, wire: false }] } },
  ]);
  const models = ops.filter((o) => o.op === "model3d");
  assert.equal(models.length, 1);
  assert.equal(models[0].model, "shapes");
  assert.equal(models[0].shapes.objects.length, 2);
});

test("model3d shapes also accepts the scene fields directly on the op", () => {
  const ops = sanitizeOps([{ op: "model3d", model: "shapes", objects: [sun] }]);
  assert.equal(ops.filter((o) => o.op === "model3d").length, 1);
});

test("an invalid shapes scene is dropped instead of reaching the renderer", () => {
  const ops = sanitizeOps([{ op: "model3d", model: "shapes", shapes: { objects: [{ shape: "nope" }] } }]);
  assert.equal(ops.filter((o) => o.op === "model3d").length, 0);
});

test("generated HTML is valid JavaScript in both modes", () => {
  const spec = sanitizeShapes({
    objects: [sun, earth, { id: "seta", shape: "arrow", pos: [0, 2, 0], size: [0.5, 2] }],
    anims: [
      { target: "terra", type: "orbit", around: "sol" },
      { target: "sol", type: "pulse" },
      { target: "seta", type: "bounce", axis: "y" },
    ],
    ground: true,
  });
  for (const mode of ["inline", "modal"]) {
    const html = buildShapesHtml(spec, mode);
    assert.doesNotThrow(() => new Script(moduleSource(html)), `${mode} module parses`);
    assert.equal((html.match(/type: "ready"/g) ?? []).length, 1, "ready is reported once, by the rendered scene");
  }
  const inline = moduleSource(buildShapesHtml(spec, "inline"));
  assert.match(inline, /const INLINE = true/);
  // o toque existe nos dois modos: na página para rodar/aproximar, no painel também
  assert.match(inline, /addEventListener\("pointerdown"/, "the scene accepts drag and pinch");
});

test("scene text cannot break out of the script tag", () => {
  const evil = '</script><script>window.pwned=1</script>';
  const spec = sanitizeShapes({ objects: [{ ...sun, label: evil, note: evil }] });
  const html = buildShapesHtml(spec, "modal");
  const open = html.indexOf('<script type="module">');
  const close = html.indexOf("</script>", open);
  const inner = html.slice(open + '<script type="module">'.length, close);
  assert.ok(!inner.includes("<script"), "no raw <script inside the module");
  assert.ok(!html.includes("window.pwned=1</script>"));
  assert.ok(!safeJson({ a: "</script>" }).includes("</script>"));
});

test("an unusable scene produces a page that reports the error instead of throwing", () => {
  const html = buildShapesHtml({ objects: [], anims: [], camera: "iso", ground: false });
  assert.match(html, /cena 3D inválida/);
});

test("mirror creates symmetric copies that share the animation", () => {
  const spec = sanitizeShapes({
    objects: [{ id: "roda", shape: "cylinder", pos: [1.3, 0.3, 0.9], mirror: "xz", label: "Roda" }],
    anims: [{ target: "roda", type: "move", path: [[1.3, 1, 0.9]] }],
  });
  assert.equal(spec.objects.length, 4);
  const pos = spec.objects.map((o) => o.pos.join(","));
  assert.deepEqual(new Set(pos), new Set(["1.3,0.3,0.9", "-1.3,0.3,0.9", "1.3,0.3,-0.9", "-1.3,0.3,-0.9"]));
  assert.equal(spec.objects.filter((o) => o.label).length, 1, "only the original is labelled");
  assert.equal(spec.anims.length, 4);
  assert.ok(spec.anims.some((a) => a.path[0].join(",") === "-1.3,1,-0.9"), "paths are mirrored too");
});

test("parent must exist earlier and children keep it", () => {
  const spec = sanitizeShapes({
    objects: [
      { id: "a", shape: "group", parent: "b" },
      { id: "b", shape: "box", parent: "a" },
      { id: "c", shape: "box", parent: "b" },
      { id: "d", shape: "box", parent: "d" },
    ],
  });
  const by = Object.fromEntries(spec.objects.map((o) => [o.id, o.parent]));
  assert.equal(by.a, undefined, "forward reference is dropped");
  assert.equal(by.b, "a");
  assert.equal(by.c, "b");
  assert.equal(by.d, undefined, "no self parent");
});

test("hidden objects, captions and the new shapes are accepted", () => {
  const spec = sanitizeShapes({
    objects: [{ id: "s", shape: "rbox", opacity: 0 }, { id: "t", shape: "capsule" }, { id: "g", shape: "group" }],
    captions: [{ at_ms: 3000, text: "depois" }, { at_ms: 0, text: "primeiro" }, { at_ms: 1, text: "" }],
    anims: [{ target: "s", type: "fade", to_opacity: 1 }],
  });
  assert.equal(spec.objects[0].opacity, 0);
  assert.deepEqual(spec.captions.map((c) => c.text), ["primeiro", "depois"]);
  assert.equal(spec.anims[0].to_opacity, 1);
});

test("the example in the tutor prompt is a rich, valid scene", async () => {
  const { lessonSystem } = await import("../src/lesson/prompt.ts");
  const prompt = lessonSystem({});
  const start = prompt.indexOf('{"op":"model3d","model":"shapes"');
  const end = prompt.indexOf('\n  {"op":"axes"', start);
  assert.ok(start > 0 && end > start, "example present");
  const ops = sanitizeOps([JSON.parse(prompt.slice(start, end).trim())]);
  const op = ops.find((o) => o.op === "model3d");
  assert.ok(op, "example survives sanitizeOps");
  assert.ok(op.shapes.objects.length >= 15, "example is detailed: " + op.shapes.objects.length);
  assert.ok(op.shapes.anims.length >= 6 && op.shapes.captions.length >= 3);
  for (const mode of ["inline", "modal"]) {
    assert.doesNotThrow(() => new Script(moduleSource(buildShapesHtml(op.shapes, mode))));
  }
});
