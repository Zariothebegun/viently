import { z } from "zod";

/* ---------- Schema dos blocos (v1) ---------- */

const Base = {
  id: z.string().min(1),
  say: z.string().optional(),
};

export const TextBlock = z.object({
  ...Base,
  type: z.literal("text"),
  title: z.string().optional(),
  markdown: z.string().max(2500),
});

export const CardBlock = z.object({
  ...Base,
  type: z.literal("card"),
  title: z.string(),
  items: z.array(z.object({ term: z.string(), definition: z.string() })).min(1).max(6),
});

export const ChartBlock = z.object({
  ...Base,
  type: z.literal("chart"),
  title: z.string(),
  chart: z.enum(["line", "bar", "scatter", "pie"]),
  xLabel: z.string().optional(),
  yLabel: z.string().optional(),
  series: z
    .array(
      z.object({
        label: z.string(),
        data: z.array(z.object({ x: z.union([z.string(), z.number()]), y: z.number() })),
      }),
    )
    .min(1),
});

export const DiagramBlock = z.object({
  ...Base,
  type: z.literal("diagram"),
  title: z.string(),
  kind: z.enum(["flow", "cycle", "tree", "compare"]),
  nodes: z.array(z.object({ id: z.string(), label: z.string(), detail: z.string().optional() })).min(1),
  edges: z.array(z.object({ from: z.string(), to: z.string(), label: z.string().optional() })).optional(),
});

export const FormulaBlock = z.object({
  ...Base,
  type: z.literal("formula"),
  title: z.string().optional(),
  latex: z.string(),
  explanation: z.string().optional(),
});

export const ASSET_IDS = [
  "cell-animal",
  "cell-plant",
  "atom",
  "solar-system",
  "cube",
  "sphere",
  "molecule-water",
] as const;

export const Model3DBlock = z.object({
  ...Base,
  type: z.literal("model3d"),
  title: z.string(),
  assetId: z.enum(ASSET_IDS),
  params: z.record(z.string(), z.union([z.number(), z.string()])).optional(),
  hotspots: z
    .array(
      z.object({
        id: z.string(),
        label: z.string(),
        description: z.string(),
        position: z.tuple([z.number(), z.number(), z.number()]).optional(),
      }),
    )
    .optional(),
});

export const QuizBlock = z.object({
  ...Base,
  type: z.literal("quiz"),
  title: z.string().optional(),
  question: z.string(),
  options: z.array(z.string()).min(2).max(4),
  answerIndex: z.number().int().min(0),
  explanation: z.string().optional(),
});

export const Block = z.discriminatedUnion("type", [
  TextBlock,
  CardBlock,
  ChartBlock,
  DiagramBlock,
  FormulaBlock,
  Model3DBlock,
  QuizBlock,
]);

export const Lesson = z.object({
  lessonTitle: z.string(),
  level: z.enum(["basico", "medio", "avancado"]).default("medio"),
  blocks: z.array(Block).min(1).max(12),
  suggestedNext: z.array(z.string()).optional(),
});

export type Block = z.infer<typeof Block>;
export type Lesson = z.infer<typeof Lesson>;

export function parseLesson(raw: unknown): Lesson {
  return Lesson.parse(raw);
}
