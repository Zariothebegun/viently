import { generateLesson } from "./src/lesson/generate";

const q = process.argv[2] || "como funciona um foguete";
const lesson = await generateLesson({
  question: q, key: "", pace: 3, profile: "", boardNow: "", hasBoard: false,
  history: [], minutes: 2, depth: 1,
});
const m = (lesson.steps?.[0]?.board as any[])?.find((o: any) => o.op === "model3d");
const objs = (m?.shapes?.objects ?? []) as any[];
const kinds: Record<string, number> = {};
for (const o of objs) kinds[o.shape] = (kinds[o.shape] ?? 0) + 1;
const sizes = objs.map((o) => {
  const s = o.size;
  return Array.isArray(s) ? Math.max(...s.map((v: number) => Math.abs(v))) : Math.abs(Number(s) || 0);
});
console.log("pecas:", objs.length, "| formas:", JSON.stringify(kinds));
console.log("tamanho max por peca:", sizes.map((v) => v.toFixed(1)).join(","));
console.log("labels:", objs.filter((o) => o.label).map((o) => o.label).join(" | ").slice(0, 160));
console.log("captions:", (m?.shapes?.captions ?? []).length, "| anims:", (m?.shapes?.anims ?? []).length);
