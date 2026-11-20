import { pickShapeExamples } from "./shapesExamples";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Check, Ink, Lesson, Op, Size, Step } from "../board/ops";
import { SURFACE_FNS } from "../board/plot3d";
import { lintShapes, sanitizeShapes, type ShapesSpec } from "../three/shapes";
import { lessonSystem } from "./prompt";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

// API alternativa (ex.: proxy local do AI Studio) configurada no .env.
const API_BASE = process.env.EXPO_PUBLIC_API_BASE;
const API_MODEL = process.env.EXPO_PUBLIC_API_MODEL;

// API oficial do Gemini (AI Studio). Com chave no .env é o primeiro caminho:
// responde em segundos, ao contrário do modelo gratuito do OpenRouter.
const GEMINI_KEY = process.env.EXPO_PUBLIC_GEMINI_KEY;
const GEMINI_KEY_2 = process.env.EXPO_PUBLIC_GEMINI_KEY_2;
const GEMINI_KEY_3 = process.env.EXPO_PUBLIC_GEMINI_KEY_3;
const GEMINI_MODEL = process.env.EXPO_PUBLIC_GEMINI_MODEL || "gemini-3-flash-preview";
// Várias contas e vários modelos: a quota gratuita é por modelo e por conta,
// por isso cada combinação é uma tentativa independente. Quando uma esgota
// (429), a seguinte tem quota própria.
const GEMINI_KEYS = [GEMINI_KEY, GEMINI_KEY_2, GEMINI_KEY_3]
  .map((k) => (k ?? "").trim())
  .filter((k, i, all) => !!k && all.indexOf(k) === i);
const GEMINI_MODELS = [
  // medido: 3.1-flash-lite responde em 4 a 7 s com JSON válido e texto longo;
  // flash-lite-latest devolve 503 e o 3-flash-preview está sempre em 429.
  "gemini-3.1-flash-lite",
  GEMINI_MODEL,
  "gemini-flash-lite-latest",
].filter((m, i, all) => !!m && all.indexOf(m) === i);

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

const CACHE_KEY = "viently.lessons.v30";
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
  // Cache version is bumped when lesson structure/prompt rules change. Include
  // the learner profile and the same six history turns sent to the model.
  const tail = input.history.slice(-6)
    .map((m) => `${m.role}:${String(m.content ?? "")}`)
    .join("~");
  return hash(
    `lesson-v30|${input.question}|${input.pace}|${input.minutes}|${input.depth ?? 1}|${input.profile}|${tail}|${input.model ?? ""}`,
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
  "dot", "hotspot", "motion", "scene", "model3d", "erase", "clear", "code", "plot3d",
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
      case "code": {
        const lines = Array.isArray(o.lines) ? o.lines.slice(0, 16).map((v: any) => String(v ?? "").replace(/\t/g, "    ").replace(/\s+$/, "").slice(0, 52)) : typeof o.code === "string" ? String(o.code).replace(/\r/g, "").split("\n").slice(0, 16).map((v) => v.replace(/\t/g, "    ").replace(/\s+$/, "").slice(0, 52)) : [];
        while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
        if (!lines.length) break;
        const focus = Array.isArray(o.focus) ? Array.from(new Set(o.focus.map((v: any) => Math.round(num(v, 0))).filter((v: number) => v >= 1 && v <= lines.length))).slice(0, 8) as number[] : undefined;
        out.push({ op: "code", lines, focus: focus?.length ? focus : undefined, lang: o.lang ? String(o.lang).replace(/[^\w+#.-]/g, "").slice(0, 12) : undefined, title: o.title ? String(o.title).replace(/\s+/g, " ").trim().slice(0, 28) : undefined, at: o.at ? pt(o.at, [3, 4]) : undefined, w: o.w != null ? Math.max(30, Math.min(96, num(o.w, 94))) : undefined, h: o.h != null ? Math.max(12, Math.min(70, num(o.h, 40))) : undefined });
        break;
      }
      case "plot3d": {
        const kindName = o.kind === "ridgeline" ? "ridgeline" : "surface";
        const base = { op: "plot3d" as const, kind: kindName as "surface" | "ridgeline", title: o.title ? String(o.title).replace(/\s+/g, " ").trim().slice(0, 40) : undefined, xlabel: o.xlabel ? String(o.xlabel).slice(0, 16) : undefined, ylabel: o.ylabel ? String(o.ylabel).slice(0, 16) : undefined, zlabel: o.zlabel ? String(o.zlabel).slice(0, 16) : undefined, at: o.at ? pt(o.at, [10, 10]) : undefined, w: o.w != null ? Math.max(24, Math.min(96, num(o.w, 70))) : undefined, h: o.h != null ? Math.max(18, Math.min(70, num(o.h, 44))) : undefined };
        if (kindName === "surface") {
          const fn = SURFACE_FNS.includes(o.fn) ? o.fn : "gaussian";
          const clamp1 = (p: [number, number]): [number, number] => [Math.max(-1, Math.min(1, p[0])), Math.max(-1, Math.min(1, p[1]))];
          const path = pts(o.path, 24).map(clamp1);
          out.push({ ...base, fn, path: path.length >= 2 ? path : undefined, marker: o.marker && typeof o.marker === "object" ? { at: clamp1(pt(o.marker.at, [0, 0])), label: o.marker.label ? String(o.marker.label).slice(0, 24) : undefined } : undefined });
        } else {
          const groups = Array.isArray(o.groups) ? o.groups.slice(0, 6).map((g: any) => ({ label: g?.label ? String(g.label).replace(/\s+/g, " ").trim().slice(0, 18) : undefined, mean: num(g?.mean, 0), spread: Math.max(1e-6, Math.abs(num(g?.spread, 1))), skew: g?.skew != null ? Math.max(-8, Math.min(8, num(g.skew, 0))) : undefined, color: g?.color != null ? safeColor(g.color, "blue") : undefined })).filter((g: any) => Number.isFinite(g.mean) && Number.isFinite(g.spread)) : [];
          if (groups.length >= 2) out.push({ ...base, groups });
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
        // The page overlay supports exactly one 3D model. Reject extras here
        // instead of silently losing them later in the renderer.
        if (out.some((item) => item.op === "model3d")) break;
        const base = {
          op: "model3d" as const,
          at: (o.at ? pt(o.at, [22, 2]) : [22, 2]) as [number, number],
          w: num(o.w, 54),
          h: num(o.h, 38),
          title: o.title ? String(o.title).slice(0, 40) : undefined,
          color: safeColor(o.color),
        };
        if (o.model === "shapes" || o.shapes) {
          // a cena vem em o.shapes ou directamente no próprio op
          const spec = sanitizeShapes(o.shapes ?? o);
          if (spec) out.push({ ...base, model: "shapes", shapes: spec });
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
        // Keep the interaction layer sparse and predictable on small screens.
        if (out.filter((item) => item.op === "hotspot").length >= 4) break;
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
      while (next < value.length && /\s/.test(value[next])) next++;
      if (value[next] === "}" || value[next] === "]") continue;
    }
    out += ch;
  }
  return out;
}

export function parseLesson(raw: string): Lesson {
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
    const repaired = removeTrailingCommas(text);
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
    .filter((o) => o.op !== "title" && o.op !== "clear" && o.op !== "erase")
    .slice(0, 12);
  // A clear one- or two-element diagram can be valid; destructive-only
  // boards were filtered above and must not count as teaching visuals.
  if (pageBoard.length >= 1) {
    const say = String(data.say ?? "").replace(/\s+/g, " ").trim().slice(0, 950);
    const note = String(data.note ?? "")
      .replace(/\r/g, "")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{2,}/g, "\n")
      .trim()
      .slice(0, 1200);
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
    const example = String(data.example ?? "").replace(/\s+/g, " ").trim().slice(0, 360);
    const mw = String(data.mistake?.wrong ?? "").replace(/\s+/g, " ").trim().slice(0, 220);
    const mr = String(data.mistake?.right ?? "").replace(/\s+/g, " ").trim().slice(0, 220);
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
  const visualRaw = String(data.visual ?? "").toLowerCase();
  return {
    visual: visualRaw.startsWith("3") ? "3d" : visualRaw.startsWith("2") ? "2d" : undefined,
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
  // recebe a cena 3D a crescer, peça a peça, enquanto a aula é escrita
  onScene?: (spec: ShapesSpec) => void;
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
    note: { type: "string", maxLength: 1200 },
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
      minItems: 1,
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

// Gemini usa o mesmo prompt, mas o corpo e a resposta têm outro formato.
async function callGemini(
  model: string,
  system: string,
  input: GenerateInput,
  mode: "json" | "none",
  timeoutMs: number,
  apiKey: string | null = GEMINI_KEY ?? null,
): Promise<Lesson> {
  if (!apiKey) throw new Error("Sem chave Gemini configurada.");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model,
  )}:generateContent?key=${apiKey}`;
  const contents = [
    ...input.history.slice(-6).map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: String(m.content ?? "") }],
    })),
    { role: "user", parts: [{ text: input.question }] },
  ];
  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents,
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 8192,
      ...(mode === "json" ? { responseMimeType: "application/json" } : {}),
    },
  };
  let res: Response | null = null;
  for (let tryIndex = 0; tryIndex < 3; tryIndex++) {
    try {
      res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
    // 503/500 = modelo sobrecarregado; 429 = quota por minuto. Ambos passam.
    if (![429, 500, 502, 503, 504].includes(res.status) || tryIndex === 2) break;
    await new Promise((r) => setTimeout(r, 900 + tryIndex * 700));
  }
  if (!res) throw new Error("Sem resposta do Gemini.");

  try {
    if (!res.ok) {
      const responseBody = await res.text().catch(() => "");
      throw new HttpError(res.status, "Gemini " + res.status + ": " + responseBody.slice(0, 220));
    }
    const json = await res.json();
    const text = (json?.candidates?.[0]?.content?.parts ?? [])
      .map((part: any) => (typeof part?.text === "string" ? part.text : ""))
      .join("");
    if (!text.trim()) throw new Error("Resposta vazia do modelo.");
    return parseLesson(text);
  } finally {
    clearTimeout(timer);
  }
}


// Segunda chamada, focada: escrever SÓ a cena 3D. O pedido grande de uma vez
// fazia o modelo cortar a cena a meio (5 a 8 peças em vez das 12 a 30 pedidas)
// ou devolver JSON inválido; aqui a única tarefa é geometria.
export const SHAPES_SYSTEM = [
  "Desenhas uma cena 3D didáctica com formas simples e animação coreografada. Respondes APENAS com um objecto JSON compacto numa só linha, nunca código.",
  'Formato: {"objects":[...],"anims":[...],"captions":[...],"camera":"iso|front|side|top","view":[azimute°,elevação°]?,"turntable":true?,"ground":true?}.',
  "Objecto: {id, shape, parent?, pos:[x,y,z], size:número|[x,y,z], rot?:[x,y,z graus], color, opacity?, finish?, mirror?:'x'|'z'|'xz', from?, to?, repeat?, on?, label?, note?}. Cores: ink blue red green orange purple gray yellow.",
  "Formas básicas: sphere, box, rbox, cylinder, capsule, cone, torus (size [diâmetro, espessura do tubo, diâmetro]), ring, plane, arrow (+y), group (agrupa; sem malha), wheel (eixo z; size [diâmetro, largura, diâmetro]), gear (teeth 6-24, eixo z), stream (partículas de from a to ou por path; count 3-14).",
  "Formas livres (servem para qualquer coisa): lathe {profile:[[raio,y],…]} gira um perfil em torno de y (garrafas, foguetes, vasos, torres, peões); extrude {outline:[[x,y],…] polígono, size:[escala x, escala y, espessura]} (asas, barbatanas, engrenagens, silhuetas, letras); tube {path:[[x,y,z],…], size = espessura} curva suave (veias, fios, carris, mangueiras, molas); surface {expr:'f(x,z,t)', extent, grid} altura y = expressão (ondas, terreno, gráficos de funções, campos).",
  "finish: matte, metal, glass (translúcido), glow (luz/energia). from/to [x,y,z] ligam dois pontos em cylinder, capsule, box, rbox, arrow. repeat {n, step:[x,y,z], around:'y', angle, center, cols, row_step} cria padrões (anel, hélice, grelha, fila). on {id, at:'top|bottom|left|right|front|back', gap} põe uma peça junto a outra.",
  "ANIMAÇÕES (todas com at_ms, duration_ms, ease: linear|in|out|inout|elastic|back|bounce|spring): spin, orbit (around|center), bounce, pulse, swing (axis, deg, speed: pêndulo), wave (axis, amp, speed), move (path), follow (path de pontos: curva suave; orient:'x|y|z' vira a peça para onde vai), rotate (to_rot graus), scale (to_scale), fade (to_opacity), color (to_color), keys (frames:[{t ms, pos, rot, scale, opacity, color}]: coreografia de vários passos numa só peça).",
  "LIBERDADE TOTAL: {type:'expr', target, pos:['ex','ey','ez'], rot:[…graus], scale:'e', opacity:'e'} aplica expressões de t (segundos) e u (0-1 se houver duration_ms) por cima do resto: movimentos físicos exactos (mola amortecida '-0.7*exp(-0.2*t)*cos(3*t)', projéctil, lissajous, tremor '0.03*sin(t*55)'). Funções: sin cos tan abs sqrt exp log pow min max mix clamp smooth step fract mod atan2 rnd; constantes pi tau e; operadores + - * / % ^.",
  "CÂMARA: {type:'camera', az, el, zoom, look:'id'|[x,y,z], at_ms, duration_ms, ease} move a câmara durante a explicação (aproxima da peça de que falas, roda para mostrar o outro lado, afasta no fim). Começa com um plano geral e usa 2 a 4 movimentos.",
  "MÉTODO: (1) decompõe o real em 14 a 40 peças com proporções verdadeiras (x comprimento, y altura, z largura; 1 unidade ≈ 1 m); prefere formas livres a caixas quando o real é curvo; (2) group + parent agrupa o que se move junto; mirror/repeat para simetrias e padrões; (3) cascas em glass para se ver o interior; (4) mostra a CAUSA com setas e streams (azul fluido, verde força útil, vermelho peso/perda, laranja energia) que entram com opacity 0 + fade por ordem;",
  "(5) a animação conta uma história em 3 a 5 fases ao longo de 6 a 14 segundos (preparação → causa → efeito → resultado) e termina no efeito visível; (6) captions: 3 a 8 frases curtas sincronizadas com at_ms, uma por fase; (7) label (≤22 caracteres) em 4 a 8 peças que a explicação usa, cada uma com note que ensina; (8) conceitos abstractos (algoritmos, memória, economia, tempo): usa metáforas visuais (barras, caixas, camadas, setas, filas) e movimento para mostrar o processo.",
  "Eixos: x direita, y cima, z para ti; câmara front vê o plano x-y (pontes, mecanismos, esquemas); iso mostra volume; top para órbitas. Máx. 64 objectos. O objecto principal ocupa 60% a 80% da cena. Rótulos em português. Nada de texto fora do JSON.",
  "ESCALA ÚNICA (importante): todas as peças entre 0,1 e 6 unidades e o objecto principal entre 3 e 8; perfis lathe e contornos extrude também. Nunca uma peça gigante (mais de 10) ao lado de peças pequenas: a câmara afasta-se e o desenho perde-se.",
  "ESCREVE MENOS E FICA IGUAL: mirror:'x'|'z'|'xz' numa peça cria as cópias simétricas (rodas, asas, pernas, parafusos); repeat:{n,step:[x,y,z],cols?,row_step?,around?:'x'|'y'|'z',center?,angle?} faz fileiras, colunas, grelhas e rodas de peças iguais; on:{id,at:'top'|'bottom'|'left'|'right'|'front'|'back',gap?} encaixa a peça em cima de outra. Usa sempre estes atalhos em vez de escrever peças repetidas uma a uma (mesmo desenho, resposta mais curta).",
  "Não copies os exemplos: imita o nível de detalhe e a lógica (peças reais, causa → efeito, câmara e legendas sincronizadas) para o tema pedido.",
].join(" ");

export function shapesSystemFor(prompt: string): string {
  const ex = pickShapeExamples(prompt)
    .map((e) => `Exemplo (${e.name}): ${e.scene}`)
    .join(" ");
  return SHAPES_SYSTEM + " " + ex;
}

function extractObject(text: string): any | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}


/* ---------------------------------------------------------------
   Leitura da cena à medida que o modelo a escreve.

   O Gemini web devolve a resposta em pedaços (o primeiro chega aos
   ~16 s, as peças continuam a chegar durante ~9 s). Em vez de esperar
   pelo fim, cada peça completa que aparece no texto é logo transformada
   numa cena parcial: o desenho cresce no ecrã enquanto a aula é escrita.
   --------------------------------------------------------------- */

// objectos completos já escritos dentro de "objects": [ ... ]
export function partialObjects(text: string): any[] {
  const key = text.indexOf('"objects"');
  if (key < 0) return [];
  const start = text.indexOf("[", key);
  if (start < 0) return [];
  const out: any[] = [];
  let depth = 0, inStr = false, esc = false, objStart = -1;
  for (let i = start + 1; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') { inStr = true; continue; }
    if (c === "{" || c === "[") {
      if (depth === 0 && c === "{") objStart = i;
      depth++;
    } else if (c === "}" || c === "]") {
      depth--;
      if (depth <= 0 && c === "]") break;        // fim da lista
      if (depth === 0 && objStart >= 0) {
        try { out.push(JSON.parse(text.slice(objStart, i + 1))); } catch { /* ignora */ }
        objStart = -1;
      }
    }
  }
  return out;
}

function partialScene(text: string, seen: number): { spec: ShapesSpec | null; n: number } {
  const objs = partialObjects(text);
  if (objs.length <= seen) return { spec: null, n: seen };
  const head = text.match(/"camera"\s*:\s*"(iso|front|side|top)"/);
  const spec = sanitizeShapes({
    objects: objs,
    anims: [],
    camera: head ? head[1] : "iso",
    ground: !/"ground"\s*:\s*false/.test(text),
    captions: [],
  });
  return { spec: spec && spec.objects.length ? spec : null, n: objs.length };
}

async function readStream(
  res: Response,
  onText: (text: string) => void,
): Promise<string | null> {
  const body: any = (res as any).body;
  if (!body || typeof body.getReader !== "function") return null;
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let text = "", buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const parts = buf.split("\n\n");
    buf = parts.pop() ?? "";
    for (const part of parts) {
      const line = part.split("\n").find((l) => l.startsWith("data:"));
      if (!line) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const j = JSON.parse(data);
        const d = j?.choices?.[0]?.delta?.content;
        if (typeof d === "string" && d) {
          text += d;
          onText(text);
        }
        if (j?.error?.message) throw new Error(String(j.error.message));
      } catch (e: any) {
        if (e && typeof e.message === "string" && /^stream |API local|Gemini/.test(e.message)) throw e;
      }
    }
  }
  return text;
}

async function askShapesStream(
  prompt: string,
  deadline: number,
  onScene?: (spec: ShapesSpec) => void,
): Promise<any | null> {
  if (!API_BASE || !onScene) return null;
  let seen = 0, lastAt = 0;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), Math.max(30000, deadline - Date.now()));
  try {
    const res = await fetch(API_BASE + "/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: ctrl.signal,
      body: JSON.stringify({
        model: API_MODEL || "gemini-web",
        temperature: 0.5,
        stream: true,
        messages: [
          { role: "system", content: shapesSystemFor(prompt) },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!res.ok) throw new Error("stream " + res.status);
    const text = await readStream(res, (acc) => {
      const agora = Date.now();
      if (agora - lastAt < 260) return;
      const { spec, n } = partialScene(acc, seen);
      if (!spec) return;
      seen = n;
      lastAt = agora;
      onScene(spec);
    });
    if (!text) return null;
    const obj = extractObject(text);
    if (obj) {
      const final = sanitizeShapes(obj);
      if (final) onScene(final);
      return obj;
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function askShapes(prompt: string, deadline: number, onScene?: (spec: ShapesSpec) => void): Promise<any | null> {
  const viaStream = await askShapesStream(prompt, deadline, onScene);
  if (viaStream) return viaStream;

  const targets: Array<() => Promise<string>> = [];

  if (API_BASE) {
    const url = `${API_BASE}/chat/completions`;
    targets.push(async () => {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: API_MODEL || "gemini-web",
          temperature: 0.5,
          messages: [
            { role: "system", content: shapesSystemFor(prompt) },
            { role: "user", content: prompt },
          ],
        }),
      });
      if (!res.ok) throw new Error(`bridge ${res.status}`);
      const json: any = await res.json();
      return String(json?.choices?.[0]?.message?.content ?? "");
    });
  }

  for (const apiKey of GEMINI_KEYS.slice(0, 2)) {
    for (const model of ["gemini-3.1-flash-lite", "gemini-flash-lite-latest"]) {
      targets.push(async () => {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: shapesSystemFor(prompt) }] },
              contents: [{ role: "user", parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.5, maxOutputTokens: 8192 },
            }),
          },
        );
        if (!res.ok) throw new Error(`gemini ${res.status}`);
        const json: any = await res.json();
        return (json?.candidates?.[0]?.content?.parts ?? [])
          .map((part: any) => (typeof part?.text === "string" ? part.text : ""))
          .join("");
      });
    }
  }

  for (const run of targets) {
    if (Date.now() > deadline) break;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 25000);
      const text = await run();
      clearTimeout(timer);
      const obj = extractObject(text);
      if (obj) return obj;
    } catch {
      /* tenta o próximo */
    }
  }
  return null;
}

// Junta a cena à página (uma só model3d, no primeiro passo).
function attachScene(lesson: Lesson, raw: any, title?: string): boolean {
  const spec = sanitizeShapes(raw);
  if (!spec || !spec.objects.length) return false;
  const step = lesson.steps[0];
  if (!step) return false;
  if ((step.board ?? []).some((o: any) => o.op === "model3d")) return false;
  const op: any = {
    op: "model3d",
    model: "shapes",
    shapes: spec,
    at: [10, 4],
    w: 78,
    h: 40,
    title: title ? String(title).slice(0, 40) : undefined,
  };
  step.board = [op, ...(step.board ?? [])];
  return true;
}

// só estes erros podem vir do formato da resposta; os outros não melhoram a
// repetir o mesmo modelo, por isso passamos ao fallback seguinte
const FORMAT_RETRY = new Set([400, 404, 422]);

export async function generateLesson(input: GenerateInput): Promise<Lesson> {
  const inicio = Date.now();
  // tempos de cada fase (aparecem na consola do browser; ajudam a ver o que
  // está lento sem adivinhar)
  const marca = (etapa: string) => {
    try {
      console.log("[viently] " + etapa + " " + (Date.now() - inicio) + " ms");
    } catch (e) {}
  };
  const key = await cacheKey(input);
  const cached = await readCache(key);
  if (cached) { marca("cache"); return cached; }

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

  // A cena 3D não espera pela página: assim que o aluno pergunta, o pedido
  // da cena segue em paralelo com o da explicação. A ponte aceita os dois
  // ao mesmo tempo, por isso o total passa a ser a chamada mais lenta em
  // vez da soma das duas (~30 s + ~30 s antes).
  const contexto = (input.history ?? [])
    .slice(-2)
    .map((m) => String(m.content ?? ""))
    .join(" / ")
    .slice(0, 240);
  const pedidoCena = [
    "TEMA DA CENA: " + input.question,
    contexto ? "Contexto do aluno: " + contexto : "",
    "Mostra o mecanismo central deste tema: as peças reais que o compõem, como se ligam e o que se move por causa de quê.",
    "Exigência: 14 a 24 peças reais (nada de versões simplificadas), 3 a 6 captions sincronizadas, rótulos nas peças que a explicação usa e animação que mostre a causa e o efeito.",
    "Usa mirror, repeat e on para as peças simétricas ou repetidas.",
    "Devolve SÓ a cena JSON (objects, anims, captions). Não escrevas página, título, say nem board.",
  ]
    .filter(Boolean)
    .join("\n");
  const cenaEmParalelo: Promise<any | null> = askShapes(
    pedidoCena,
    Date.now() + 150000,
    input.onScene,
  ).catch(
    () => null,
  );


  // Gemini responde em segundos; OpenRouter é o fallback quando não há chave
  // Gemini ou ela falha.
  type Attempt = {
    kind: "gemini" | "chat";
    model: string;
    endpoint: string;
    key: string | null;
  };
  const attempts: Attempt[] = [];
  // Ponte local (Gemini web via cookies do GemCLI) primeiro: grátis e sem
  // quota por minuto. O prompt completo é aceite; se recusar, a própria
  // ponte repete com um pedido curto.
  if (API_BASE) {
    attempts.push({
      kind: "chat",
      model: API_MODEL || DEFAULT_MODEL,
      endpoint: `${API_BASE}/chat/completions`,
      key: input.key,
    });
  }
  for (const apiKey of GEMINI_KEYS) {
    for (const m of GEMINI_MODELS) {
      attempts.push({ kind: "gemini", model: m, endpoint: "gemini", key: apiKey });
    }
  }
  const cloudKey = input.key && String(input.key).trim() ? input.key : null;
  if (cloudKey) {
    const cloudModels = [input.model || DEFAULT_MODEL, ...FALLBACK_MODELS];
    for (const m of cloudModels) {
      attempts.push({ kind: "chat", model: m, endpoint: ENDPOINT, key: cloudKey });
    }
  }
  if (!attempts.length) {
    attempts.push({ kind: "chat", model: DEFAULT_MODEL, endpoint: ENDPOINT, key: input.key });
  }

  for (const attempt of attempts) {
    const modes: Format[] =
      attempt.kind === "gemini" ? ["none", "json"] : ["json", "none"];
    for (const mode of modes) {
      if (Date.now() > deadline) break;
      try {
        const budget = Math.max(20000, Math.min(150000, deadline - Date.now()));
        const localEp = API_BASE ? `${API_BASE}/chat/completions` : null;
        const wait = localEp && attempt.endpoint === localEp ? Math.min(90000, budget) : budget;
        const lesson =
          attempt.kind === "gemini"
            ? await callGemini(
                attempt.model,
                system,
                input,
                mode === "schema" ? "json" : mode,
                Math.min(60000, budget),
                attempt.key,
              )
            : await callModel(
                attempt.model,
                system,
                input,
                mode,
                wait,
                attempt.endpoint,
                attempt.key,
              );
        if (!lesson.steps.length) throw new Error("A aula ficou sem passos utilizáveis.");
        marca("página");

        // A página pedida em 3D mas ainda sem cena: pede-se a cena à parte,
        // com um pedido pequeno e só de geometria.
        const firstBoard = lesson.steps[0]?.board ?? [];
        const hasShapes = firstBoard.some(
          (o) => o.op === "model3d" && (o as any).model === "shapes",
        );
        if (lesson.visual === "3d" && !hasShapes) {
          // a cena tem orçamento próprio: a página já gastou o tempo dela
          const sceneDeadline = Math.max(deadline, Date.now() + 45000);
          // a que arrancou em paralelo já deve estar pronta; só se falhou é
          // que se pede outra, agora com a ideia exacta da página
          let raw = await cenaEmParalelo;
          marca("cena em paralelo");
          if (!raw || !sanitizeShapes(raw)) {
            raw = await askShapes(
              [
                `TEMA DA CENA: ${lesson.title ?? input.question}`,
                lesson.subtitle ?? "",
                `IDEIA A MOSTRAR: ${String(lesson.steps[0]?.say ?? "").slice(0, 320)}`,
                "Devolve SÓ a cena JSON (objects, anims, captions). Não escrevas página, título, say nem board.",
              ]
                .filter(Boolean)
                .join("\n"),
              sceneDeadline,
            );
          }
          if (raw) attachScene(lesson, raw, lesson.title);
          marca("cena");
          // revisão: se a cena ficou pobre, uma segunda tentativa com o que falta
          const first = (lesson.steps[0]?.board ?? []).find((o: any) => o.op === "model3d") as any;
          const issues = first?.shapes ? lintShapes(first.shapes) : ["a cena não passou a validação"];
          marca(issues.length ? "revisao: " + issues.join(" | ") : "revisao: ok");
          if (issues.length && Date.now() < sceneDeadline - 8000) {
            const again = await askShapes(
              [
                `Página: "${lesson.title ?? input.question}"`,
                String(lesson.steps[0]?.say ?? "").slice(0, 600),
                `Pedido do aluno: ${input.question}`,
                `A versão anterior ficou fraca: ${issues.join("; ")}. Refaz a cena completa com 14 a 24 peças reais: mantém o que já estava correcto e acrescenta as peças, rótulos, captions e animações que faltam.`,
              ].join("\n"),
              deadline,
            );
            const better = again ? sanitizeShapes(again) : null;
            if (better && (!first?.shapes || lintShapes(better).length < issues.length)) {
              if (first) first.shapes = better;
              else attachScene(lesson, again, lesson.title);
            }
          }
        }
        if (!lesson.suggestions?.length) {
          lesson.suggestions = ["Dá-me um exemplo concreto", "Porque é que isso acontece?"];
        }
        await writeCache(key, lesson);
        marca("fim");
        return lesson;
      } catch (e: any) {
        marca("falhou " + attempt.kind + "/" + mode + ": " + String(e && e.message).slice(0, 90));
        lastError = e;
        // 401/402/403/429 não melhoram a tentar outro formato; modelo seguinte
        if (!(e instanceof HttpError) || !FORMAT_RETRY.has(e.status)) break;
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Falha ao gerar a aula.");
}
