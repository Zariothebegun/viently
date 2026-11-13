import assert from "node:assert/strict";
import { test } from "node:test";
import { sanitizeSandflowCache } from "../src/three/sandflow.ts";

test("malformed cached 3D entries are discarded safely", () => {
  const valid = {
    id: "asset-1",
    title: "Modelo",
    glb: "https://cdn.example/model.glb",
    thumb: "https://cdn.example/model.png",
    author: "Autor",
    licence: "Licença não indicada",
    page: "https://polyfork.dev/model/asset-1",
  };
  const cache = sanitizeSandflowCache({
    valid: { q: "modelo", at: 10, item: valid },
    broken: { q: "broken", at: "ontem", item: {} },
    malformed: null,
    unsafe: { q: "unsafe", at: 20, item: { ...valid, glb: "javascript:alert(1)" } },
  });
  assert.deepEqual(Object.keys(cache), ["valid"]);
  assert.equal(cache.valid.item?.id, "asset-1");
});

test("3D cache is bounded and ordered by most recent use", () => {
  const entries = Object.fromEntries(
    Array.from({ length: 70 }, (_, index) => [
      String(index),
      { q: String(index), at: index, item: null },
    ]),
  );
  const cache = sanitizeSandflowCache(entries);
  assert.equal(Object.keys(cache).length, 60);
  assert.equal(cache["69"].at, 69);
  assert.equal(cache["10"], undefined);
});
