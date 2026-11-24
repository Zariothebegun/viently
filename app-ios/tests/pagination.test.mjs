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


test("numbered notes keep their line boundaries across pagination", () => {
  const source = "1. RAM: guarda dados temporários.\n2. CPU: executa instruções.\n3. SSD: guarda ficheiros mesmo sem energia.";
  const pages = paginateLessonText(source, 70);
  const joined = pages.join("\n");
  assert.match(joined, /1\. RAM:/);
  assert.match(joined, /2\. CPU:/);
  assert.match(joined, /3\. SSD:/);
  assert.ok(pages.every((page) => page.length <= 70));
});

test("paragraphs and unicode text are retained", () => {
  const source = "A memória é rápida.\n\nO processador executa instruções.\nA saída mostra o resultado.";
  const pages = paginateLessonText(source, 200);
  assert.equal(pages[0], source);
});


test("decimal numbers and abbreviations are never split at punctuation", () => {
  const source = "A medida é 3.14 cm. O prof. explicou a diferença. Depois aplicamos a fórmula.";
  const pages = paginateLessonText(source, 50);
  const joined = pages.join(" ");
  assert.equal(joined, source);
  assert.ok(pages.every((page) => page.length <= 50));
});


test("default page budget stays conservative for phone layouts", () => {
  const pages = paginateLessonText("Explicação curta. ".repeat(40));
  assert.ok(pages.length > 1);
  assert.ok(pages.every((page) => page.length <= 165));
});
