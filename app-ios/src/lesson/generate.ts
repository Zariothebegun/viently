import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Check, Ink, Lesson, Op, Size, Step } from "../board/ops";
import { isModelId } from "../three/models";
import { lessonSystem } from "./prompt";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

// API alternativa (ex.: proxy local do AI Studio) configurada no .env.
const API_BASE = process.env.EXPO_PUBLIC_API_BASE;
const API_MODEL = process.env.EXPO_PUBLIC_API_MODEL;

// Modelo por omissão. O "lightning" é o mais rápido dos gratuitos; os
// seguintes só entram se ele estiver limitado ou falhar o JSON.
export const DEFAULT_MODEL = API_MODEL || "nvidia/nemotron-3.5-lightning:free";

// Se o modelo principal estiver limitado, tenta os seguintes pela ordem.
export const FALLBACK_MODELS = [
  "google/gemma-4-31b-it:free",
  "nvidia/nemotron-3-ultra-550b-a55b:free",
];

// ---- cache local ----
// O modelo gratuito leva ~50 s. Uma pergunta repetida (na mesma aula ou numa
// demonstração) devolve a página da cache em milissegundos.

const CACHE_KEY = "viently.lessons.v6";
const CACHE_TTL = 1000 * 60 * 60 * 24 * 14;
const CACHE_MAX = 12;

type CacheRow = { k: string; at: number; title: string; lesson: Lesson };

function hash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

async function cacheKey(input: GenerateInput): Promise<string> {
  const tail = input.history.slice(-2).map((m) => m.content).join("~").slice(-360);
  return hash(
    `${input.question}|${input.pace}|${input.minutes}|${input.depth ?? 1}|${tail}|${input.model ?? ""}`,
  );
}

async function readCache(key: string): Promise<Lesson | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    const rows: CacheRow[] = raw ? JSON.parse(raw) : [];
    const row = rows.find((r) => r.k === key);
    if (!row || Date.now() - row.at > CACHE_TTL) return null;
    return row.lesson;
  } catch {
    return null;
  }
}

async function writeCache(key: string, lesson: Lesson) {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    const rows: CacheRow[] = raw ? JSON.parse(raw) : [];
    const next = [
      { k: key, at: Date.now(), title: lesson.title ?? "", lesson },
      ...rows.filter((r) => r.k !== key && Date.now() - r.at < CACHE_TTL),
    ].slice(0, CACHE_MAX);
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(next));
  } catch {
    /* cache é conveniência, nunca bloqueia a aula */
  }
}

const KNOWN = new Set([
  "title", "text", "note", "line", "arrow", "callout", "box", "ellipse",
  "curve", "polygon", "notes", "graph", "axes", "underline", "highlight",
  "dot", "hotspot", "motion", "scene", "model3d", "erase", "clear",
]);

function num(v: any, d: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function safeSize(value: any, fallback: Size = "m"): Size {
  return value === "s" || value === "m" || value === "l" || value === "xl"
    ? value
    : fallback;
}

function safeColor(value: any, fallback: Ink = "ink"): Ink {
  return value === "ink" || value === "blue" || value === "red" ||
    value === "green" || value === "orange" || value === "purple" ||
    value === "gray" || value === "yellow"
    ? value
    : fallback;
}

function pt(v: any, d: [number, number]): [number, number] {
  if (!Array.isArray(v) || v.length < 2) return d;
  return [num(v[0], d[0]), num(v[1], d[1])];
}

function pts(v: any, max = 12): [number, number][] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, max).map((p) => pt(p, [50, 38]));
}

// O modelo pode inventar ops. Aceitamos só as que o renderer sabe desenhar,
// e normalizamos tudo o resto. Isto é a fronteira de segurança do produto:
// o modelo produz dados, nunca código.
export function sanitizeOps(raw: any): Op[] {
  if (!Array.isArray(raw)) return [];
  const out: Op[] = [];
  for (const o of raw) {
    if (!o || typeof o !== "object") continue;
    const kind = String(o.op ?? "").trim();
    if (!KNOWN.has(kind)) continue;

    switch (kind) {
      case "clear":
        out.push({ op: "clear" });
        break;
      case "erase":
        out.push({ op: "erase", id: o.id ? String(o.id) : undefined });
        break;
      case "title":
        if (o.text) out.push({ op: "title", text: String(o.text).slice(0, 60), color: safeColor(o.color) });
        break;
      case "text":
        if (o.text) out.push({
          op: "text",
          text: String(o.text).slice(0, 160),
          at: pt(o.at, [10, 20]),
          size: safeSize(o.size),
          color: safeColor(o.color),
          align: o.align === "center" ? "center" : "left",
          fit_w: o.fit_w != null ? Math.max(8, Math.min(88, num(o.fit_w, 40))) : undefined,
        });
        break;
      case "note":
        if (o.text) out.push({ op: "note", text: String(o.text).slice(0, 160), at: pt(o.at, [10, 20]), color: safeColor(o.color) });
        break;
      case "line":
        out.push({ op: "line", from: pt(o.from, [0, 0]), to: pt(o.to, [10, 10]), color: safeColor(o.color), dash: !!o.dash });
        break;
      case "arrow":
        out.push({
          op: "arrow",
          from: pt(o.from, [0, 0]),
          to: pt(o.to, [10, 10]),
          color: safeColor(o.color),
          label: o.label ? String(o.label).slice(0, 32) : undefined,
          label_at: o.label_at ? pt(o.label_at, [0, 0]) : undefined,
        });
        break;
      case "callout":
        out.push({
          op: "callout",
          around: pt(o.around ?? o.at, [50, 38]),
          to: o.to ? pt(o.to, [60, 30]) : undefined,
          r: o.r ? num(o.r, 3) : undefined,
          label: o.label ? String(o.label).slice(0, 48) : undefined,
          label_at: o.label_at ? pt(o.label_at, [0, 0]) : undefined,
          color: safeColor(o.color),
        });
        break;
      case "box":
      case "ellipse":
        out.push({
          op: kind as "box" | "ellipse",
          at: pt(o.at, [10, 20]),
          w: num(o.w, 22),
          h: num(o.h, 10),
          label: o.label ? String(o.label).slice(0, 40) : undefined,
          size: safeSize(o.size),
          color: safeColor(o.color),
        });
        break;
      case "motion": {
        const points = Array.isArray(o.points)
          ? o.points.slice(0, 8).map((p: any) => {
              const q = pt(p, [50, 38]);
              return [
                Math.max(1, Math.min(99, q[0])),
                Math.max(1, Math.min(74, q[1])),
              ] as [number, number];
            })
          : [];
        if (points.length >= 2) {
          out.push({
            op: "motion",
            points,
            label: o.label ? String(o.label).replace(/\s+/g, " ").trim().slice(0, 32) : undefined,
            color: ["ink", "blue", "red", "green", "orange", "purple", "gray", "yellow"].includes(o.color) ? o.color : "blue",
            radius: Math.max(0.8, Math.min(3.5, num(o.radius, 1.8))),
            trail: o.trail !== false,
            start_ms: o.start_ms != null ? Math.max(0, Math.min(6000, Math.round(num(o.start_ms, 0)))) : undefined,
            duration_ms: o.duration_ms != null ? Math.max(250, Math.min(5000, Math.round(num(o.duration_ms, 1500)))) : undefined,
          });
        }
        break;
      }
      case "scene": {
        const rawElements = Array.isArray(o.elements) ? o.elements.slice(0, 16) : [];
        const elements: { at_ms: number; duration_ms: number; op: Op }[] = [];
        for (const element of rawElements) {
          if (!element || typeof element !== "object" || !element.op || typeof element.op !== "object") continue;
          const childKind = String(element.op.op ?? "");
          // 3D models are rendered by the page overlay, not inside the SVG scene.
          // Nested and destructive operations are rejected to keep the renderer predictable.
          if (["scene", "model3d", "clear", "erase", "hotspot"].includes(childKind)) continue;
          const child = sanitizeOps([element.op])[0];
          if (!child) continue;
          elements.push({
            at_ms: Math.max(0, Math.min(5000, Math.round(num(element.at_ms, 0)))),
            duration_ms: Math.max(100, Math.min(5000, Math.round(num(element.duration_ms, 900)))),
            op: child,
          });
        }
        if (elements.length) {
          const end = Math.max(...elements.map((element) => element.at_ms + element.duration_ms));
          out.push({
            op: "scene",
            elements,
            start_ms: o.start_ms != null ? Math.max(0, Math.min(6000, Math.round(num(o.start_ms, 0)))) : undefined,
            duration_ms: Math.max(end, Math.min(10000, Math.max(250, Math.round(num(o.duration_ms, end))))),
          });
        }
        break;
      }
      case "curve": {
        const points = pts(o.points);
        if (points.length >= 2) out.push({ op: "curve", points, color: safeColor(o.color) });
        break;
      }
      case "polygon": {
        const points = pts(o.points, 8);
        if (points.length >= 3) out.push({
          op: "polygon",
          points,
          label: o.label ? String(o.label).slice(0, 32) : undefined,
          side_labels: Array.isArray(o.side_labels) ? o.side_labels.slice(0, 8).map((v: any) => String(v).slice(0, 32)) : undefined,
          size: safeSize(o.size),
          color: safeColor(o.color),
        });
        break;
      }
      case "notes":
        out.push({
          op: "notes",
          at: o.at ? pt(o.at, [66, 20]) : [66, 20],
          title: o.title ? String(o.title).slice(0, 40) : undefined,
          lines: Array.isArray(o.lines) ? o.lines.slice(0, 7).map((s: any) => String(s).slice(0, 46)) : [],
          compact: !!o.compact,
          color: safeColor(o.color),
        });
        break;
      case "graph": {
        const series = Array.isArray(o.series)
          ? o.series.slice(0, 4).map((s: any) => ({
              label: s?.label ? String(s.label).slice(0, 22) : undefined,
              color: safeColor(s?.color, "blue"),
              points: pts(s?.points, 40)
                .filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]))
                .sort((a, b) => a[0] - b[0]),
            })).filter((s: any) => s.points.length >= 2)
          : [];
        const allX = series.flatMap((s: any) => s.points.map((p: [number, number]) => p[0]));
        const allY = series.flatMap((s: any) => s.points.map((p: [number, number]) => p[1]));
        const autoRange = (values: number[], fallback: [number, number]): [number, number] => {
          let lo = values.length ? Math.min(...values) : fallback[0];
          let hi = values.length ? Math.max(...values) : fallback[1];
          if (lo === hi) {
            const pad = Math.abs(lo) * 0.08 || 1;
            lo -= pad;
            hi += pad;
          } else {
            const pad = (hi - lo) * 0.04;
            lo -= pad;
            hi += pad;
          }
          return [lo, hi];
        };
        const suppliedX = o.x_range ? pt(o.x_range, [0, 1]) : null;
        const suppliedY = o.y_range ? pt(o.y_range, [0, 1]) : null;
        const xAuto = autoRange(allX, [0, 1]);
        const yAuto = autoRange(allY, [0, 1]);
        const xRange: [number, number] = suppliedX && suppliedX[0] < suppliedX[1]
          ? [Math.min(suppliedX[0], xAuto[0]), Math.max(suppliedX[1], xAuto[1])]
          : xAuto;
        const yRange: [number, number] = suppliedY && suppliedY[0] < suppliedY[1]
          ? [Math.min(suppliedY[0], yAuto[0]), Math.max(suppliedY[1], yAuto[1])]
          : yAuto;
        out.push({
          op: "graph",
          at: o.at ? pt(o.at, [12, 22]) : [12, 22],
          w: Math.max(20, num(o.w, 58)),
          h: Math.max(18, num(o.h, 38)),
          x_range: xRange,
          y_range: yRange,
          series,
          markers: Array.isArray(o.markers)
            ? o.markers.slice(0, 8).map((m: any) => ({
                at: pt(m?.at, [0, 0]),
                label: m?.label ? String(m.label).slice(0, 20) : undefined,
                color: safeColor(m?.color, "orange"),
              }))
            : [],
          title: o.title ? String(o.title).slice(0, 30) : undefined,
          xlabel: o.xlabel ? String(o.xlabel).slice(0, 20) : undefined,
          ylabel: o.ylabel ? String(o.ylabel).slice(0, 20) : undefined,
        });
        break;
      }
      case "axes":
        out.push({
          op: "axes",
          at: o.at ? pt(o.at, [16, 22]) : [16, 22],
          w: num(o.w, 40),
          h: num(o.h, 28),
          xlabel: o.xlabel ? String(o.xlabel).slice(0, 16) : undefined,
          ylabel: o.ylabel ? String(o.ylabel).slice(0, 16) : undefined,
          color: safeColor(o.color),
        });
        break;
      case "model3d": {
        const base = {
          op: "model3d" as const,
          at: (o.at ? pt(o.at, [22, 2]) : [22, 2]) as [number, number],
          w: num(o.w, 54),
          h: num(o.h, 38),
          title: o.title ? String(o.title).slice(0, 40) : undefined,
          color: safeColor(o.color),
        };
        if (isModelId(o.model)) {
          // preset local: roda, explode e mostra as partes
          out.push({ ...base, model: o.model });
        } else if (o.model === "sandflow") {
          const query = String(o.query ?? "")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 80);
          if (query) {
            out.push({
              ...base,
              model: "sandflow",
              query,
              labels: Array.isArray(o.labels)
                ? o.labels
                    .map((v: any) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, 26))
                    .filter((v: string) => v.length > 1)
                    .slice(0, 4)
                : undefined,
            });
          }
        }
        break;
      }
      case "underline":
      case "highlight":
        out.push({ op: kind as "underline" | "highlight", at: pt(o.at, [10, 20]), w: num(o.w, 20), color: safeColor(o.color) });
        break;
      case "dot":
        out.push({
          op: "dot",
          at: pt(o.at, [50, 38]),
          label: o.label ? String(o.label).slice(0, 24) : undefined,
          label_at: o.label_at ? pt(o.label_at, [0, 0]) : undefined,
          color: safeColor(o.color),
        });
        break;
      case "hotspot": {
        const label = String(o.label ?? "").replace(/\s+/g, " ").trim().slice(0, 28);
        const detail = String(o.detail ?? "").replace(/\s+/g, " ").trim().slice(0, 180);
        if (label && detail) {
          const at = pt(o.at, [50, 38]);
          out.push({
            op: "hotspot",
            at: [Math.max(2, Math.min(98, at[0])), Math.max(2, Math.min(73, at[1]))],
            label,
            detail,
            color: ["ink", "blue", "red", "green", "orange", "purple", "gray", "yellow"].includes(o.color) ? o.color : "orange",
          });
        }
        break;
      }
    }
  }
  return out;
}

// corta um texto no fim da última frase completa que cabe no limite
function fitSentence(raw: string, max: number): string {
  const text = String(raw).replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("? "), cut.lastIndexOf("! "));
  if (end > 40) return cut.slice(0, end + 1).trim();
  const space = cut.lastIndexOf(" ");
  return (space > 40 ? cut.slice(0, space) : cut).trim() + ".";
}

function removeTrailingCommas(value: string): string {
  let out = "";
  let inString = false;
  let escaped = false;
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    if (inString) {
      out += ch;
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
      continue;
    }
    if (ch === ",") {
      let next = i + 1;
      while (next < value.length && /\\s/.test(value[next])) next++;
      if (value[next] === "}" || value[next] === "]") continue;
    }
    out += ch;
  }
  return out;
}

function parseLesson(raw: string): Lesson {
  let text = raw.trim();
  // modelos às vezes embrulham em ```json
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) text = fence[1].trim();
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first >= 0 && last > first) text = text.slice(first, last + 1);

  let data: any;
  try {
    data = JSON.parse(text);
  } catch (firstError) {
    // Corrige só vírgulas finais; não inventa campos nem altera o conteúdo.
    const repaired = text.replace(/,\s*([}\]])/g, "$1");
    try {
      data = JSON.parse(repaired);
    } catch {
      throw new Error(firstError instanceof Error
        ? "JSON inválido devolvido pelo modelo: " + firstError.message.slice(0, 120)
        : "JSON inválido devolvido pelo modelo.");
    }
  }
  const steps: Step[] = [];

  // Formato actual: a página inteira num só objecto.
  const pageBoard = sanitizeOps(data.board)
    .filter((o) => o.op !== "title")
    .slice(0, 10);
  if (pageBoard.length >= 3) {
    const say = String(data.say ?? "").replace(/\s+/g, " ").trim().slice(0, 420);
    const note = String(data.note ?? "")
      .replace(/\r/g, "")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{2,}/g, "\n")
      .trim()
      .slice(0, 700);
    // resumo "Para lembrar" para fixar no fim da página
    const rc = data.recap;
    const rcTitle = String(rc?.title ?? "").trim().slice(0, 40) || "Para lembrar";
    const rcLines = Array.isArray(rc?.lines)
      ? rc.lines
          .map((v: any) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, 140))
          .filter(Boolean)
          .slice(0, 4)
      : [];
    const recap = rcLines.length >= 2 ? { title: rcTitle, lines: rcLines } : undefined;

    // números, exemplo e erro comum (cartões da página)
    const numbers = Array.isArray(data.numbers)
      ? data.numbers
          .map((n: any) => ({
            label: String(n?.label ?? "").replace(/\s+/g, " ").trim().slice(0, 30),
            value: String(n?.value ?? "").replace(/\s+/g, " ").trim().slice(0, 40),
          }))
          .filter((n: any) => n.label && n.value)
          .slice(0, 3)
      : [];
    const example = String(data.example ?? "").replace(/\s+/g, " ").trim().slice(0, 220);
    const mw = String(data.mistake?.wrong ?? "").replace(/\s+/g, " ").trim().slice(0, 160);
    const mr = String(data.mistake?.right ?? "").replace(/\s+/g, " ").trim().slice(0, 160);
    const mistake = mw && mr ? { wrong: mw, right: mr } : undefined;
    steps.push({
      say: say || note.replace(/\s*\n\s*/g, " "),
      write: note || undefined,
      recap,
      numbers,
      example: example || undefined,
      mistake,
      board: pageBoard,
    });
  }

  // Formato antigo (steps) e aula de exemplo.
  if (!steps.length) {
    for (const s of data.steps ?? []) {
      const say = String(s?.say ?? "").trim();
      const write = String(s?.write ?? "").replace(/\s+/g, " ").trim().slice(0, 220);
      // o título da página está fora do quadro; a op title só duplicaria
      const board = sanitizeOps(s?.board)
        .filter((o) => o.op !== "title")
        .slice(0, 9);
      if (say && board.length) steps.push({ say, write: write || undefined, board });
    }
  }
  if (!steps.length) throw new Error("O modelo não devolveu passos utilizáveis.");

  let check: Check | undefined;
  const c = data.check;
  if (c && typeof c === "object") {
    const prompt = String(c.prompt ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
    const options = Array.isArray(c.options)
      ? c.options
          .map((v: any) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, 60))
          .filter((v: string) => v.length > 0)
          .slice(0, 4)
      : [];
    const idx = Number(c.answer_index);
    if (prompt && options.length >= 2 && Number.isInteger(idx) && idx >= 0 && idx < options.length) {
      check = {
        prompt,
        options,
        answer_index: idx,
        explanation: c.explanation
          ? String(c.explanation).replace(/\s+/g, " ").trim().slice(0, 180)
          : undefined,
      };
    }
  }

  const suggestions = Array.isArray(data.suggestions)
    ? data.suggestions
        .map((v: any) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, 48))
        .filter((v: string) => v.length > 1)
        .slice(0, 3)
    : [];
  return {
    title: data.title ? String(data.title).slice(0, 48) : undefined,
    // o subtítulo é uma frase completa: corta no fim da última frase que cabe,
    // nunca a meio de uma palavra
    subtitle: data.subtitle ? fitSentence(String(data.subtitle), 190) : undefined,
    suggestions,
    check,
    steps: steps.slice(0, 10),
  };
}

export type GenerateInput = {
  question: string;
  key: string;
  pace: number;
  profile: string;
  boardNow: string;
  hasBoard: boolean;
  history: { role: "user" | "assistant"; content: string }[];
  minutes: number;
  model?: string;
  // profundidade da página: 1 intuição, 2 mecanismo, 3 números, 4 falhas,
  // 5 compromissos; daí para cima é aprofundamento livre
  depth?: number;
};

// Contrato para o response_format: uma página inteira, sem steps. O "board"
// fica como objecto livre porque cada op tem campos diferentes; o sanitizeOps
// é a autoridade final.
const LESSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "subtitle", "say", "note", "board", "suggestions"],
  properties: {
    title: { type: "string", maxLength: 34 },
    subtitle: { type: "string" },
    numbers: {
      type: "array",
      maxItems: 3,
      items: {
        type: "object",
        properties: { label: { type: "string" }, value: { type: "string" } },
      },
    },
    example: { type: "string" },
    mistake: {
      type: "object",
      properties: { wrong: { type: "string" }, right: { type: "string" } },
    },
    say: { type: "string" },
    note: { type: "string", maxLength: 700 },
    recap: {
      type: "object",
      properties: {
        title: { type: "string" },
        lines: { type: "array", minItems: 2, maxItems: 3, items: { type: "string" } },
      },
    },
    check: {
      type: "object",
      properties: {
        prompt: { type: "string" },
        options: { type: "array", minItems: 2, maxItems: 4, items: { type: "string" } },
        answer_index: { type: "integer", minimum: 0, maximum: 3 },
        explanation: { type: "string" },
      },
    },
    board: {
      type: "array",
      minItems: 4,
      maxItems: 10,
      items: { type: "object" },
    },
    suggestions: {
      type: "array",
      minItems: 2,
      maxItems: 2,
      items: { type: "string" },
    },
  },
} as const;

type Format = "schema" | "json" | "none";

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// tenta primeiro o schema, depois JSON simples, depois sem response_format:
// nem todos os providers do OpenRouter aceitam o mesmo modo.
function formatBody(mode: Format): Record<string, unknown> {
  if (mode === "schema") {
    return {
      response_format: {
        type: "json_schema",
        json_schema: { name: "viently_lesson", strict: false, schema: LESSON_SCHEMA },
      },
    };
  }
  if (mode === "json") return { response_format: { type: "json_object" } };
  return {};
}

async function callModel(
  model: string,
  system: string,
  input: GenerateInput,
  mode: Format,
  timeoutMs: number,
  endpoint: string = API_BASE ? `${API_BASE}/chat/completions` : ENDPOINT,
  apiKey: string | null = input.key,
): Promise<Lesson> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res: Response;
  const isCloud = endpoint.includes("openrouter.ai");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  if (isCloud) {
    headers["HTTP-Referer"] = "https://viently.pt";
    headers["X-Title"] = "Viently";
  }
  const body = {
    model,
    temperature: 0.4,
    max_tokens: 4096,
    ...formatBody(mode),
    messages: [
      { role: "system", content: system },
      ...input.history.slice(-6),
      { role: "user", content: input.question },
    ],
  };
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers,
      signal: ctrl.signal,
      body: JSON.stringify(body),
    });
  } catch (e: any) {
    clearTimeout(timer);
    if (e?.name === "AbortError") {
      throw new Error("O modelo demorou demasiado a responder. Tenta outra vez.");
    }
    throw e;
  }

  try {
    if (!res.ok) {
      const responseBody = await res.text().catch(() => "");
      throw new HttpError(res.status, (isCloud ? "OpenRouter" : "API local") + " " + res.status + ": " + responseBody.slice(0, 220));
    }

    const json = await res.json();
    const content = json?.choices?.[0]?.message?.content
      || json?.choices?.[0]?.message?.reasoning_content;
    if (typeof content !== "string" || !content.trim()) {
      throw new Error("Resposta vazia do modelo.");
    }
    return parseLesson(content);
  } finally {
    clearTimeout(timer);
  }
}

// só estes erros podem vir do formato da resposta; os outros não melhoram a
// repetir o mesmo modelo, por isso passamos ao fallback seguinte
const FORMAT_RETRY = new Set([400, 404, 422]);

export async function generateLesson(input: GenerateInput): Promise<Lesson> {
  const key = await cacheKey(input);
  const cached = await readCache(key);
  if (cached) return cached;

  const system = lessonSystem({
    pace: input.pace,
    profile: input.profile,
    boardNow: input.boardNow,
    hasBoard: input.hasBoard,
    minutes: input.minutes,
    depth: input.depth,
  });

  const deadline = Date.now() + 300000;
  let lastError: unknown = null;

  // OpenRouter é o caminho principal; um endpoint compatível opcional
  // pode funcionar como último fallback.
  type Attempt = { model: string; endpoint: string; key: string | null };
  const attempts: Attempt[] = [];
  const cloudKey = input.key;
  if (cloudKey) {
    const cloudModels = [input.model || DEFAULT_MODEL, ...FALLBACK_MODELS];
    for (const m of cloudModels) attempts.push({ model: m, endpoint: ENDPOINT, key: cloudKey });
  }
  if (API_BASE) {
    attempts.push({ model: API_MODEL || DEFAULT_MODEL, endpoint: `${API_BASE}/chat/completions`, key: input.key });
  }
  if (!attempts.length) attempts.push({ model: DEFAULT_MODEL, endpoint: ENDPOINT, key: input.key });

  for (const attempt of attempts) {
    for (const mode of ["schema", "json", "none"] as Format[]) {
      if (Date.now() > deadline) break;
      try {
        const budget = Math.max(20000, Math.min(150000, deadline - Date.now()));
        const localEp = API_BASE ? `${API_BASE}/chat/completions` : null;
        const wait = localEp && attempt.endpoint === localEp ? Math.min(15000, budget) : budget;
        const lesson = await callModel(attempt.model, system, input, mode, wait, attempt.endpoint, attempt.key);
        if (!lesson.steps.length) throw new Error("A aula ficou sem passos utilizáveis.");
        if (!lesson.suggestions?.length) {
          lesson.suggestions = ["Dá-me um exemplo concreto", "Porque é que isso acontece?"];
        }
        await writeCache(key, lesson);
        return lesson;
      } catch (e: any) {
        lastError = e;
        // 401/402/403/429 não melhoram a tentar outro formato; modelo seguinte
        if (!(e instanceof HttpError) || !FORMAT_RETRY.has(e.status)) break;
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Falha ao gerar a aula.");
}
