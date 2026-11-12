// Ritmo do desenho — o mesmo do Teacher do Clicky, adaptado ao nosso modelo de ops.
//
// Cada op é decomposta em elementos (traços e texto). Os elementos entram por
// ordem, com uma pausa curta entre eles; o texto escreve-se à razão de 0,07 s
// por letra e os traços demoram em função do comprimento. O renderer recebe
// apenas o progresso global do item e deriva de aqui o progresso de cada parte.

import { dist } from "./geom";
import type { Item, Op, Pt } from "./ops";

export const LETTER_S = 0.07; // uma letra
export const GAP_S = 0.18; // entre elementos

const DIAGONAL = Math.hypot(100, 75);
const MIN_STROKE_S = 0.35;
const MAX_STROKE_S = 1.6;
const MIN_TEXT_S = 0.3;
const MAX_TEXT_S = 3.4;

export type Spec =
  | { kind: "text"; chars: number }
  | { kind: "stroke"; units: number };

export type Timing = {
  total: number; // segundos
  parts: { start: number; dur: number }[];
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function textSec(chars: number): number {
  if (chars <= 0) return 0;
  return clamp(chars * LETTER_S, MIN_TEXT_S, MAX_TEXT_S);
}

function strokeSec(units: number): number {
  return clamp((units / DIAGONAL) * 1.6, MIN_STROKE_S, MAX_STROKE_S);
}

function text(s?: string | null): Spec {
  return { kind: "text", chars: s ? String(s).replace(/\^/g, "").length : 0 };
}

function stroke(units: number): Spec {
  return { kind: "stroke", units: Math.max(0, units) };
}

function polyLen(pts: Pt[], closed = false): number {
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += dist(pts[i - 1], pts[i]);
  if (closed && pts.length > 1) total += dist(pts[pts.length - 1], pts[0]);
  return total;
}

function box(o: any): [number, number, number, number] {
  const [x, y] = (o.at ?? [10, 20]) as Pt;
  return [x, y, o.w ?? 22, o.h ?? 10];
}

// A ordem dos elementos tem de coincidir com a ordem em que o Board os desenha.
export function specsOf(op: Op): Spec[] {
  const o: any = op;
  switch (o.op) {
    case "title": {
      const n = String(o.text ?? "").length;
      return [text(o.text), stroke(Math.min(68, n * 2.2))];
    }
    case "text":
    case "note":
      return [text(o.text)];
    case "line":
      return [stroke(dist(o.from ?? [0, 0], o.to ?? [0, 0]))];
    case "arrow":
      return [
        stroke(dist(o.from ?? [0, 0], o.to ?? [0, 0])),
        stroke(4),
        text(o.label),
      ];
    case "callout": {
      const r = o.r ?? 3;
      const c: Pt = o.around ?? o.at ?? [50, 38];
      const dest: Pt = o.label_at ?? o.to ?? [c[0] + 12, c[1] - 8];
      return [
        stroke(2 * Math.PI * r),
        stroke(Math.max(0, dist(c, dest) - r)),
        text(o.label),
      ];
    }
    case "box": {
      const [, , w, h] = box(o);
      return [stroke(2 * (Math.abs(w) + Math.abs(h))), text(o.label)];
    }
    case "ellipse": {
      const [, , w, h] = box(o);
      const a = Math.abs(w) / 2;
      const b = Math.abs(h) / 2;
      return [stroke(2 * Math.PI * Math.sqrt((a * a + b * b) / 2)), text(o.label)];
    }
    case "motion":
      return [stroke(polyLen((o.points ?? []) as Pt[]))];
    case "curve":
      return [stroke(polyLen((o.points ?? []) as Pt[]))];
    case "polygon":
      return [stroke(polyLen((o.points ?? []) as Pt[], true)), text(o.label)];
    case "notes": {
      const out: Spec[] = [];
      if (o.title) out.push(text(o.title));
      (o.lines ?? []).slice(0, 7).forEach((l: any) => out.push(text(l)));
      return out;
    }
    case "graph": {
      const w = o.w ?? 56;
      const h = o.h ?? 34;
      const out: Spec[] = [stroke(w + h + 8), text("000000000000000000")];
      const map = (p: Pt): Pt => {
        const [xmin, xmax] = (o.x_range ?? [0, 1]) as Pt;
        const [ymin, ymax] = (o.y_range ?? [0, 1]) as Pt;
        return [
          ((p[0] - xmin) / Math.max(1e-9, xmax - xmin)) * w,
          ((p[1] - ymin) / Math.max(1e-9, ymax - ymin)) * h,
        ];
      };
      const series = Array.isArray(o.series)
        ? o.series.slice(0, 4).filter((s: any) => (s?.points ?? []).length >= 2)
        : [];
      series.forEach((s: any) => {
        out.push(stroke(polyLen(s.points.map(map)) * 1.15));
      });
      out.push(text(series.map((s: any) => (s.label ? String(s.label) : "")).join("")));
      out.push(
        text(
          (Array.isArray(o.markers) ? o.markers : [])
            .map((m: any) => (m?.label ? String(m.label) : ""))
            .join(""),
        ),
      );
      out.push(text(o.title));
      out.push(text(o.xlabel));
      out.push(text(o.ylabel));
      return out;
    }
    case "axes": {
      const w = o.w ?? 46;
      const h = o.h ?? 32;
      return [stroke(w + h), text(o.xlabel), text(o.ylabel)];
    }
    case "model3d": {
      const w = o.w ?? 34;
      const h = o.h ?? 18;
      return [stroke(2 * (w + h)), stroke(26), text(o.title), text("toca para abrir")];
    }
    case "underline":
    case "highlight":
      return [stroke(o.w ?? 20)];
    case "dot":
      return [stroke(3), text(o.label)];
    default:
      return [];
  }
}

export function timingOf(item: Item): Timing {
  const specs = specsOf(item.op);
  let clock = 0;
  const parts: { start: number; dur: number }[] = [];
  for (const s of specs) {
    const dur = s.kind === "text" ? textSec(s.chars) : strokeSec(s.units);
    parts.push({ start: clock, dur });
    clock += dur + GAP_S;
  }
  const last = parts[parts.length - 1];
  return { total: last ? last.start + last.dur : 0, parts };
}

// progresso 0..1 de uma parte, dado o progresso global do item
export function partFrac(t: Timing, frac: number, index: number): number {
  const part = t.parts[index];
  if (!part) return 0;
  const elapsed = clamp(frac, 0, 1) * t.total;
  if (part.dur <= 0) return elapsed >= part.start ? 1 : 0;
  return clamp((elapsed - part.start) / part.dur, 0, 1);
}

export function totalSeconds(item: Item): number {
  return timingOf(item).total;
}
