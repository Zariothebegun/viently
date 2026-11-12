import assert from "node:assert/strict";
import { test } from "node:test";
import { paginateLessonText } from "../src/lesson/pagination.ts";

test("long explanations are split into readable pages without losing sentences", () => {
  const source = "A primeira ideia explica a causa. A segunda mostra o mecanismo. A terceira aplica o conceito. A quarta confirma o resultado.";
  const pages = paginateLessonText(source, 55);
  assert.ok(pages.length > 1);
  assert.equal(pages.join(" "), source);
  assert.ok(pages.every((page) => page.length <= 55));
});

test("a long sentence is split at word boundaries", () => {
  const source = "palavra ".repeat(45).trim();
  const pages = paginateLessonText(source, 60);
  assert.ok(pages.length > 1);
  assert.equal(pages.join(" "), source);
  assert.ok(pages.every((page) => page.length <= 60));
});

test("empty text returns no pages and short text stays together", () => {
  assert.deepEqual(paginateLessonText("   "), []);
  assert.deepEqual(paginateLessonText("Uma explicação curta."), ["Uma explicação curta."]);
});

test("oversized unbroken tokens are bounded instead of overflowing a page", () => {
  const pages = paginateLessonText("x".repeat(125), 50);
  assert.deepEqual(pages.map((page) => page.length), [50, 50, 25]);
});
