// Primitivas de desenho à mão — portadas de tutori/static/board.js.
// O jitter é determinístico por semente, para o traço não tremer entre frames.

import type { Ink, Pt, Size } from "./ops";

export const LOGICAL_W = 100;
export const LOGICAL_H = 75;

export const PALETTE: Record<Ink, string> = {
  ink: "#273247",
  blue: "#4268b2",
  red: "#c75e58",
  green: "#4f8a83",
  orange: "#d58b45",
  purple: "#8173c4",
  gray: "#8a93a2",
  yellow: "#c89d3d",
};

// Cores com contraste suave: azul para ideias centrais, coral para alertas,
// âmbar para transformações e lilás para conceitos. Verde é apenas apoio.
export const FILL: Record<Ink, string> = {
  ink: "none",
  blue: "#e2eafb",
  red: "#fae5e1",
  green: "#e3efed",
  orange: "#faecd9",
  purple: "#eeeafb",
  gray: "#edf0f4",
  yellow: "#f8f0d9",
};

export const PAPER = "#fbfaf6";
export const GRID = "#e9e8e2";
export const HILITE = "#f6d98b";

export const FONT = "GochiHand_400Regular";
export const FONT_LIGHT = "GochiHand_400Regular";

export function color(c?: Ink | string): string {
  if (!c) return PALETTE.ink;
  return (PALETTE as Record<string, string>)[c] ?? c;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function dist(a: Pt, b: Pt): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

export function clampPt(p: Pt, loY = 3, hiY = 72): Pt {
  return [
    Math.min(Math.max(p[0], 2), 98),
    Math.min(Math.max(p[1], loY), hiY),
  ];
}

// Segmento com tremor controlado: 0.35 nos extremos, 1 a meio.
export function jitterSeg(
  rnd: () => number,
  a: Pt,
  b: Pt,
  wob = 0.9,
): Pt[] {
  const len = dist(a, b);
  const n = Math.max(3, Math.round(len / 3.2));
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const j = i === 0 || i === n ? 0.35 : 1;
    pts.push([
      a[0] + (b[0] - a[0]) * t + (rnd() - 0.5) * wob * j,
      a[1] + (b[1] - a[1]) * t + (rnd() - 0.5) * wob * j,
    ]);
  }
  return pts;
}

export function ellipsePts(
  rnd: () => number,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
): Pt[] {
  const n = 44;
  const start = rnd() * Math.PI * 2;
  const pts: Pt[] = [];
  const wob = 0.16;
  for (let i = 0; i <= n; i++) {
    const t = start + (i / n) * Math.PI * 2.015;
    pts.push([
      cx + Math.cos(t) * rx + (rnd() - 0.5) * wob,
      cy + Math.sin(t) * ry + (rnd() - 0.5) * wob,
    ]);
  }
  return pts;
}

export function catmullRom(pts: Pt[]): Pt[] {
  if (pts.length < 3) return pts;
  const out: Pt[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let t = 0; t < 1; t += 0.12) {
      const t2 = t * t;
      const t3 = t2 * t;
      out.push([
        0.5 *
          (2 * p1[0] +
            (-p0[0] + p2[0]) * t +
            (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
            (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 *
          (2 * p1[1] +
            (-p0[1] + p2[1]) * t +
            (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
            (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

// Um polyline vira path SVG com curvas quadráticas pelos pontos médios —
// é o mesmo traço do board.js, transladado para path.
export function toPath(pts: Pt[], frac = 1): string {
  if (pts.length < 2 || frac <= 0) return "";
  const upto = Math.max(2, Math.ceil(pts.length * Math.min(1, frac)));
  let d = `M ${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`;
  for (let i = 1; i < upto - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2;
    const my = (pts[i][1] + pts[i + 1][1]) / 2;
    d += ` Q ${pts[i][0].toFixed(2)} ${pts[i][1].toFixed(2)} ${mx.toFixed(2)} ${my.toFixed(2)}`;
  }
  const last = pts[upto - 1];
  d += ` L ${last[0].toFixed(2)} ${last[1].toFixed(2)}`;
  return d;
}

// ---- texto ----
// Tutori mede com o canvas; aqui medimos com a mesma estimativa que o
// engine.py usa no layout (1.9 unidades/char a "m"), para o cálculo de
// colisões e o desenho concordarem.

export const FONT_UNITS: Record<Size, number> = {
  s: 3.0,
  m: 4.0,
  l: 5.1,
  xl: 6.2,
};

export const CHAR_W: Record<Size, number> = {
  s: 1.45,
  m: 1.9,
  l: 2.35,
  xl: 2.9,
};

export const LINE_H: Record<Size, number> = {
  s: 3.6,
  m: 4.5,
  l: 5.6,
  xl: 6.8,
};

export function textWidth(text: string, size: Size = "m"): number {
  return Math.min(
    String(text).replace(/\^/g, "").length * CHAR_W[size],
    size === "xl" ? 88 : 52,
  );
}

export function wrapText(
  text: string,
  size: Size = "m",
  maxW?: number,
): string[] {
  const limit = maxW ?? (size === "xl" ? 88 : 52);
  const words = String(text).replace(/\^/g, "").trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  const maxChars = Math.max(1, Math.floor(limit / CHAR_W[size]));
  let line = "";
  for (const source of words) {
    // Uma palavra técnica ou URL enorme também tem de caber no quadro.
    const chunks = source.length > maxChars
      ? source.match(new RegExp(".{1," + maxChars + "}", "g")) ?? [source]
      : [source];
    for (const word of chunks) {
      const next = line ? line + " " + word : word;
      if (line && next.length * CHAR_W[size] > limit) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

// custo relativo de desenho — usado para escalonar as ops dentro do passo
export function opCost(op: any): number {
  const d = (a: Pt, b: Pt) => Math.hypot(b[0] - a[0], b[1] - a[1]);
  switch (op.op) {
    case "title":
      return 22 + String(op.text ?? "").length * 1.6;
    case "text":
    case "note":
      return 10 + String(op.text ?? "").length * 1.4;
    case "line":
      return 8 + d(op.from ?? [0, 0], op.to ?? [0, 0]);
    case "arrow":
      return 14 + d(op.from ?? [0, 0], op.to ?? [0, 0]) + String(op.label ?? "").length;
    case "callout":
      return (
        18 +
        d(op.around ?? [0, 0], op.to ?? op.label_at ?? [0, 0]) +
        String(op.label ?? "").length * 1.2
      );
    case "box":
      return 16 + 2 * ((op.w ?? 22) + (op.h ?? 10)) + String(op.label ?? "").length;
    case "ellipse":
      return 16 + 3.2 * ((op.w ?? 22) + (op.h ?? 12)) / 2 + String(op.label ?? "").length;
    case "curve": {
      let s = 10;
      const p: Pt[] = op.points ?? [];
      for (let i = 1; i < p.length; i++) s += d(p[i - 1], p[i]);
      return s;
    }
    case "polygon": {
      let s = 14 + String(op.label ?? "").length + (op.side_labels ?? []).join("").length;
      const p: Pt[] = op.points ?? [];
      for (let i = 0; i < p.length; i++) s += d(p[i], p[(i + 1) % p.length]);
      return s;
    }
    case "notes": {
      let s = 10 + String(op.title ?? "").length;
      (op.lines ?? []).forEach((t: string) => (s += String(t).length));
      return s * 1.3;
    }
    case "axes":
      return 30 + (op.w ?? 46) + (op.h ?? 32);
    case "graph": {
      let s = 90 + (op.w ?? 56) + (op.h ?? 34);
      (op.series ?? []).forEach((v: any) => {
        s += (v.points ?? []).length * 8 + String(v.label ?? "").length;
      });
      return s;
    }
    case "underline":
    case "highlight":
      return 8 + (op.w ?? 20);
    case "dot":
      return 8;
    default:
      return 8;
  }
}
