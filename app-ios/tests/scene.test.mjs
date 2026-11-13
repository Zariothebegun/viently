import assert from "node:assert/strict";
import { Script } from "node:vm";
import { test } from "node:test";
import { buildModelHtml, buildPolyHtml } from "../src/three/scene.ts";

function moduleSource(html) {
  const open = html.indexOf('<script type="module">');
  const close = html.indexOf("</script>", open);
  assert.ok(open >= 0 && close > open, "generated HTML must contain a module script");
  return html.slice(open + '<script type="module">'.length, close)
    .replace(/^\s*import .*?;\s*$/gm, "");
}

test("preset 3D module JavaScript is syntactically valid and inline mode is idle", () => {
  const html = buildModelHtml("cell", "inline");
  const source = moduleSource(html);
  assert.doesNotThrow(() => new Script(source));
  assert.match(source, /let spin = !INLINE/);
  assert.match(source, /function wake\(\)/);
  assert.match(source, /if \(frames === 1\)/);
});

test("Poly GLB module JavaScript is syntactically valid and inline mode does not spin", () => {
  const html = buildPolyHtml("https://example.invalid/model.glb", ["Parte"], "inline");
  const source = moduleSource(html);
  assert.doesNotThrow(() => new Script(source));
  assert.match(source, /let spin = !INLINE/);
  assert.match(source, /if \(spin && !INLINE\)/);
  assert.doesNotMatch(source, /frame\(\);/);
});
