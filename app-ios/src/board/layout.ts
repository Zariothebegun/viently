// Passagem de layout — porta de `layout_pass` em tutori/engine.py.
// Objetivo: o modelo escolhe coordenadas aproximadas; este código garante
// que nada sai do quadro, nada se sobrepõe de forma ilegível, e que as
// setas acabam na borda da forma e não no meio dela.

import { CHAR_W, LINE_H, clampPt, dist } from "./geom";
import type { Item, Op, Pt, Size } from "./ops";

type Box = [number, number, number, number];
type Placed = { b: Box; w: number };

const TEXT_H: Record<Size, number> = { s: 3.6, m: 5.5, l: 6.4, xl: 7.6 };

export function opBBox(op: any): Box | null {
  const k = op.op;
  if (k === "title") return [8, 1, 92, 13];
  if (k === "text" || k === "note") {
    const [x, y] = (op.at ?? [10, 20]) as Pt;
    const size: Size = op.size ?? (k === "text" ? "m" : "s");
    const w = Math.min(
      String(op.text ?? "").length * CHAR_W[size],
      48,
    );
    const lines = Math.max(1, Math.floor(w / 52) + 1);
    const h = TEXT_H[size] * lines;
    const x0 = op.align === "center" ? x - w / 2 : x;
    return [x0, y - h / 2, x0 + w, y + h / 2];
  }
  if (k === "motion") {
    const points: Pt[] = Array.isArray(op.points) ? op.points : [];
    if (points.length < 2) return null;
    const xs = points.map((p) => p[0]);
    const ys = points.map((p) => p[1]);
    const labelPad = op.label ? Math.min(28, String(op.label).length * 1.35) : 0;
    return [
      Math.max(0, Math.min(...xs) - 3),
      Math.max(0, Math.min(...ys) - 7),
      Math.min(100, Math.max(...xs) + 3 + labelPad),
      Math.min(75, Math.max(...ys) + 3),
    ];
  }
  if (k === "graph") {
    const [x, y] = (op.at ?? [12, 22]) as Pt;
    // inclui a faixa do título e dos eixos, senão o texto cai em cima deles
    return [x - 2, y - 7, x + (op.w ?? 44) + 2, y + (op.h ?? 30) + 9];
  }
  if (k === "box" || k === "ellipse" || k === "axes") {
    const [x, y] = (op.at ?? [10, 20]) as Pt;
    return [x, y, x + (op.w ?? 20), y + (op.h ?? 10)];
  }
  if (k === "model3d") {
    const [x, y] = (op.at ?? [58, 16]) as Pt;
    return [x, y, x + (op.w ?? 34), y + (op.h ?? 18)];
  }
  if (k === "polygon") {
    const pts: Pt[] = op.points ?? [[10, 20]];
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const pad = op.side_labels ? 6 : 0;
    return [
      Math.min(...xs) - pad,
      Math.min(...ys) - pad,
      Math.max(...xs) + pad,
      Math.max(...ys) + pad,
    ];
  }
  if (k === "notes") {
    const [x, y] = (op.at ?? [66, 20]) as Pt;
    const compact = !!op.compact;
    const maxW = compact ? 30 : 38;
    const lines: { t: string; size: Size }[] = [];
    if (op.title) lines.push({ t: String(op.title), size: compact ? "s" : "m" });
    (op.lines ?? []).slice(0, 7).forEach((s: any) => lines.push({ t: String(s), size: "s" }));
    let h = 1.5;
    let w = 8;
    for (const l of lines) {
      const cw = l.size === "m" ? 1.9 : 1.45;
      const n = Math.max(1, Math.ceil((l.t.length * cw) / maxW));
      const base = l.size === "m" ? 6.2 : compact ? 4.0 : 5.2;
      h += base + (n - 1) * (compact ? 3.2 : 3.9);
      w = Math.max(w, Math.min(l.t.length * cw + 3, 42));
    }
    return [x - 1, y - 3, x + w, y + h];
  }
  if (k === "callout" && op.label) {
    const [x, y] = (op.label_at ?? op.to ?? [55, 35]) as Pt;
    const w = Math.min(String(op.label).length * 1.45, 28);
    return [x - w / 2, y - 2.5, x + w / 2, y + 2.5];
  }
  return null;
}

function overlapArea(a: Box, b: Box): number {
  return (
    Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) *
    Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]))
  );
}

function score(b: Box, placed: Placed[]): number {
  let s = 0;
  for (const p of placed) s += overlapArea(b, p.b) * p.w;
  return s;
}

function solidArea(placed: Placed[]): number {
  let s = 0;
  for (const p of placed) if (p.w >= 0.5) s += (p.b[2] - p.b[0]) * (p.b[3] - p.b[1]);
  return s;
}

const TEXT_CANDIDATES: Pt[] = [
  [0, 0], [0, 6], [0, -7], [0, 12], [14, 0], [-14, 0],
  [16, 8], [-16, 8], [0, 18], [20, -8],
];
const LABEL_CANDIDATES: Pt[] = [
  [0, -4], [0, 5], [8, -4], [-8, -4], [10, 4], [-10, 4], [0, -9],
];
const SHAPE_CANDIDATES: Pt[] = [
  [0, 0], [0, 7], [9, 0], [-9, 0], [0, -8], [12, 9], [-12, 9],
  [0, 15], [18, 0], [-18, 0],
];

const VALUE_RE = /^\s*[\w^()]{1,6}\s*[=≈→]\s*[\d?][\w.?]{0,7}\s*$/;

function shiftPt(pt: Pt, displaced: { b: Box; dx: number; dy: number }[]): Pt {
  for (let i = displaced.length - 1; i >= 0; i--) {
    const d = displaced[i];
    if (pt[0] >= d.b[0] && pt[0] <= d.b[2] && pt[1] >= d.b[1] && pt[1] <= d.b[3]) {
      return clampPt([pt[0] + d.dx, pt[1] + d.dy]);
    }
  }
  return pt;
}

// Se a ponta da seta cai dentro de uma forma sólida, encosta-a à borda.
function snapEndpoint(pt: Pt, other: Pt, placed: Placed[]): Pt {
  const [x, y] = pt;
  const [ox, oy] = other;
  for (let i = placed.length - 1; i >= 0; i--) {
    const p = placed[i];
    if (p.w < 0.5) continue;
    const [x1, y1, x2, y2] = p.b;
    const w = x2 - x1;
    const h = y2 - y1;
    if (y2 <= 16 || w < 8 || h < 6) continue;
    if (w > 44 && h > 24) continue;
    if (!(x1 < x && x < x2 && y1 < y && y < y2)) continue;
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;
    const dx = ox - cx;
    const dy = oy - cy;
    if (Math.abs(dx) < 1e-4 && Math.abs(dy) < 1e-4) return pt;
    const sx = dx ? Math.abs((x2 - cx) / dx) : 1e9;
    const sy = dy ? Math.abs((y2 - cy) / dy) : 1e9;
    const s = Math.min(sx, sy);
    return clampPt([cx + dx * s, cy + dy * s]);
  }
  return pt;
}

// O anel do callout não pode ficar por cima da etiqueta centrada da forma.
function ringToShapeEdge(op: any, board: any[]) {
  const ax = Number(op.around?.[0] ?? 50);
  const ay = Number(op.around?.[1] ?? 38);
  const tx = Number(op.to?.[0] ?? ax + 8);
  const ty = Number(op.to?.[1] ?? ay - 6);
  for (let i = board.length - 1; i >= 0; i--) {
    const shape = board[i];
    if (shape === op || shape._drop || !shape.label) continue;
    if (!["box", "ellipse", "polygon"].includes(shape.op)) continue;
    const bb = opBBox(shape);
    if (!bb) continue;
    if (!(bb[0] < ax && ax < bb[2] && bb[1] < ay && ay < bb[3])) continue;
    const cx = (bb[0] + bb[2]) / 2;
    const cy = (bb[1] + bb[3]) / 2;
    let dx = tx - cx;
    let dy = ty - cy;
    if (Math.abs(dx) + Math.abs(dy) < 0.01) {
      dx = 1;
      dy = 0;
    }
    const s = Math.min(
      dx ? Math.abs((bb[2] - cx) / dx) : 1e9,
      dy ? Math.abs((bb[3] - cy) / dy) : 1e9,
    );
    op.around = clampPt([cx + dx * s, cy + dy * s]);
    op.r = Math.min(Number(op.r ?? 3) || 3, 1.4);
    return;
  }
}

function segSamples(a: Pt, b: Pt, step = 7): Pt[] {
  const n = Math.max(1, Math.floor(dist(a, b) / step));
  return Array.from({ length: n + 1 }, (_, t) => [
    a[0] + ((b[0] - a[0]) * t) / n,
    a[1] + ((b[1] - a[1]) * t) / n,
  ] as Pt);
}

function capArrow(op: any, maxLen = 26) {
  const f = op.from as Pt;
  const t = op.to as Pt;
  const len = dist(f, t);
  if (len > maxLen) {
    const s = maxLen / len;
    op.from = [t[0] - (t[0] - f[0]) * s, t[1] - (t[1] - f[1]) * s];
  }
}

function capCallout(op: any, maxLen = 24) {
  const a = op.around as Pt;
  const t = op.to as Pt;
  const len = dist(a, t);
  if (len > maxLen) {
    const s = maxLen / len;
    op.to = [a[0] + (t[0] - a[0]) * s, a[1] + (t[1] - a[1]) * s];
  }
}

export type LayoutResult = {
  ops: Op[];
  placed: Placed[];
};

export function layoutPass(ops: Op[], prior: Placed[]): LayoutResult {
  const placed: Placed[] = [...prior];
  const displaced: { b: Box; dx: number; dy: number }[] = [];
  const dropped: Box[] = [];
  let hasTitle = ops.some((o) => o.op === "title");
  let areaUsed = placed.reduce((s, p) => s + (p.b[2] - p.b[0]) * (p.b[3] - p.b[1]), 0);

  // 0. clamp + orçamento de área
  const work: any[] = [];
  for (const raw of ops) {
    const op: any = { ...raw };
    const kind = op.op;
    const stroke = ["curve", "line", "arrow"].includes(kind);
    const ylo = hasTitle && stroke ? 16.5 : 3;
    if (op.at) op.at = clampPt(op.at);
    if (op.from) op.from = clampPt(op.from, ylo);
    if (op.to) op.to = clampPt(op.to, ylo);
    if (op.around) op.around = clampPt(op.around, ylo);
    if (Array.isArray(op.points)) op.points = op.points.slice(0, 12).map((p: Pt) => clampPt(p, ylo));
    if (["box", "ellipse", "axes", "graph", "model3d"].includes(kind)) {
      const [rawX, rawY] = op.at ?? [10, 20];
      const x = Math.min(96, Math.max(2, Number(rawX) || 2));
      const y = Math.min(71, Math.max(3, Number(rawY) || 3));
      op.at = [x, y];
      const defaultW = kind === "model3d" ? 54 : 20;
      const defaultH = kind === "model3d" ? 38 : 10;
      op.w = Math.max(1, Math.min(Number(op.w ?? defaultW) || defaultW, 98 - x));
      op.h = Math.max(1, Math.min(Number(op.h ?? defaultH) || defaultH, 73 - y));
    }
    if (["box", "ellipse", "axes", "graph", "polygon", "notes", "text", "note", "title", "model3d"].includes(kind)) {
      const bb = opBBox(op);
      if (bb) {
        let est = (bb[2] - bb[0]) * (bb[3] - bb[1]);
        if (kind === "notes") est *= 0.6;
        if (kind !== "title" && areaUsed + est > 5200) continue;
        areaUsed += est;
      }
    }
    work.push(op);
  }

  // Reserva primeiro o rectângulo 3D. Assim, texto e formas são deslocados
  // para fora do modelo em vez de ficarem desenhados por cima dele.
  work.sort((a, b) => Number(b.op === "model3d") - Number(a.op === "model3d"));
  const modelRegions = work
    .filter((op) => op.op === "model3d")
    .map((op) => opBBox(op))
    .filter((b): b is Box => !!b);
  const insideModel = (p: Pt) =>
    modelRegions.some(([x1, y1, x2, y2]) => p[0] > x1 && p[0] < x2 && p[1] > y1 && p[1] < y2);
  const crossesModel = (a: Pt, b: Pt) =>
    segSamples(a, b, 3).some(insideModel);

  // 1. formas procuram espaço
  for (const op of work) {
    const kind = op.op;
    if (kind === "title") {
      const b = opBBox(op);
      if (b) placed.push({ b, w: 2.5 });
      continue;
    }
    if (!["box", "ellipse", "axes", "graph", "polygon", "notes", "model3d"].includes(kind)) continue;

    if (kind === "notes" && !op.compact && solidArea(placed) > 2600) op.compact = true;
    const originalBBox = opBBox(op);

    const minW = String(op.label ?? "").length * 2.2 + 6;
    let best: { pos: Pt; bbox: Box; score: number } | null = null;

    for (let attempt = 0; attempt < 6; attempt++) {
      let x0: number, y0: number, w: number, h: number;
      if (kind === "polygon" || kind === "notes") {
        const bx = opBBox(op)!;
        x0 = bx[0];
        y0 = bx[1];
        w = bx[2] - bx[0];
        h = bx[3] - bx[1];
      } else {
        [x0, y0] = op.at ?? [10, 20];
        w = Number(op.w ?? 20) || 20;
        h = Number(op.h ?? 10) || 10;
      }

      best = null;
      for (const [dx, dy] of SHAPE_CANDIDATES) {
        const px = Math.min(Math.max(x0 + dx, 2), 96 - w);
        const py = Math.min(Math.max(y0 + dy, 3), 71 - h);
        const bbox: Box = [px, py, px + w, py + h];
        const sc = score(bbox, placed);
        if (sc <= 0.5) {
          best = { pos: [px, py], bbox, score: sc };
          break;
        }
        if (!best || sc < best.score) best = { pos: [px, py], bbox, score: sc };
      }
      if (!best) break;

      if (best.score > 1) {
        // varredura do quadro inteiro, com preferência pelo sítio original
        for (let py = 16; py < Math.max(17, 72 - h); py += 5) {
          for (let px = 3; px < Math.max(4, 95 - w); px += 5) {
            const bbox: Box = [px, py, px + w, py + h];
            const sc = score(bbox, placed) + 0.02 * (Math.abs(px - x0) + Math.abs(py - y0));
            if (sc < best.score) best = { pos: [px, py], bbox, score: sc };
          }
        }
      }
      if (best.score <= 1) break;

      // cheio: encolhe, como um humano faria
      if (kind === "notes") {
        if (!op.compact) {
          op.compact = true;
          continue;
        }
        if ((op.lines ?? []).length > 2) {
          op.lines = op.lines.slice(0, -1);
          continue;
        }
        break;
      }
      if (kind === "polygon") {
        const pts: Pt[] = op.points;
        const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
        const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
        if (w * 0.72 < 12) break;
        op.points = pts.map((p) => [cx + (p[0] - cx) * 0.72, cy + (p[1] - cy) * 0.72] as Pt);
      } else {
        let nw = w * 0.72;
        let nh = Math.max(h * 0.72, 8);
        if (nw < Math.max(11, minW)) {
          nw = w;
          if (h * 0.72 < 8) break;
          nh = h * 0.72;
        }
        op.w = nw;
        op.h = nh;
      }
    }

    if (!best) continue;
    if (best.score > 6) {
      // empilhado é pior do que ausente
      op._drop = true;
      dropped.push([x0Of(op) - 3, y0Of(op) - 3, x0Of(op) + 6, y0Of(op) + 6]);
      continue;
    }
    const { pos, bbox } = best;
    const dx = pos[0] - (kind === "polygon" || kind === "notes" ? (originalBBox?.[0] ?? 0) : (op.at?.[0] ?? 0));
    const dy = pos[1] - (kind === "polygon" || kind === "notes" ? (originalBBox?.[1] ?? 0) : (op.at?.[1] ?? 0));
    if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
      displaced.push({ b: bbox, dx, dy });
    }
    if (kind === "polygon") {
      op.points = op.points.map((p: Pt) => [p[0] + dx, p[1] + dy] as Pt);
    } else if (kind === "notes") {
      const [ax, ay] = op.at ?? [66, 20];
      op.at = [ax + dx, ay + dy];
    } else {
      op.at = pos;
    }
    placed.push({ b: bbox, w: kind === "polygon" ? 0.6 : 1 });
  }

  // 2a. ligações seguem as formas que se moveram
  for (const op of work) {
    if (op._drop) continue;
    const kind = op.op;
    if (kind === "arrow" || kind === "line") {
      op.from = shiftPt(op.from, displaced);
      op.to = shiftPt(op.to, displaced);
      if (crossesModel(op.from, op.to)) {
        op._drop = true;
        continue;
      }
      if (kind === "arrow") {
        op.from = snapEndpoint(op.from, op.to, placed);
        op.to = snapEndpoint(op.to, op.from, placed);
      }
      if (kind === "arrow") capArrow(op);
      for (const [x, y] of segSamples(op.from, op.to, 5)) {
        placed.push({ b: [x - 2.2, y - 2.2, x + 2.2, y + 2.2], w: 0.25 });
      }
    } else if (kind === "callout") {
      op.around = shiftPt(op.around ?? [50, 38], displaced);
      op.to = shiftPt(op.to ?? [60, 32], displaced);
      if (crossesModel(op.around, op.to) || insideModel(op.around) || insideModel(op.to)) {
        op._drop = true;
        continue;
      }
      ringToShapeEdge(op, work);
      capCallout(op);
      if (op.label) {
        // a etiqueta do callout também foge ao que já está desenhado
        const w = Math.min(String(op.label).length * 1.45, 28);
        const base = op.to as Pt;
        let best: { pos: Pt; sc: number } = { pos: base, sc: Infinity };
        for (const [dx, dy] of LABEL_CANDIDATES) {
          const pos: Pt = clampPt([base[0] + dx, base[1] + dy]);
          const bb: Box = [pos[0] - w / 2, pos[1] - 2.5, pos[0] + w / 2, pos[1] + 2.5];
          const sc = score(bb, placed);
          if (sc <= 0.5) {
            best = { pos, sc };
            break;
          }
          if (sc < best.sc) best = { pos, sc };
        }
        op.to = best.pos;
        placed.push({
          b: [best.pos[0] - w / 2, best.pos[1] - 2.5, best.pos[0] + w / 2, best.pos[1] + 2.5],
          w: 1,
        });
      }
      const r = Number(op.r ?? 3) || 3;
      const [ax, ay] = op.around;
      placed.push({ b: [ax - r - 1.2, ay - r - 1.2, ax + r + 1.2, ay + r + 1.2], w: 0.35 });
      for (const [x, y] of segSamples(op.around, op.to, 5)) {
        placed.push({ b: [x - 1.8, y - 1.8, x + 1.8, y + 1.8], w: 0.2 });
      }
    } else if (kind === "curve" || kind === "polygon") {
      let pts: Pt[] = [...(op.points ?? [])];
      if (kind === "polygon" && pts.length >= 3) pts = [...pts, pts[0]];
      if (pts.some(insideModel) || pts.some((p, i) => i > 0 && crossesModel(pts[i - 1], p))) {
        op._drop = true;
        continue;
      }
      for (let i = 0; i < pts.length - 1; i++) {
        for (const [x, y] of segSamples(pts[i], pts[i + 1], 6)) {
          placed.push({ b: [x - 2.2, y - 2.2, x + 2.2, y + 2.2], w: 0.25 });
        }
      }
    } else if (kind === "dot" && op.at) {
      op.at = shiftPt(op.at, displaced);
      if (insideModel(op.at)) {
        op._drop = true;
        continue;
      }
      placed.push({ b: [op.at[0] - 1.2, op.at[1] - 1.2, op.at[0] + 1.2, op.at[1] + 1.2], w: 0.6 });
      if (op.label) {
        const lp: Pt = op.label_at ?? [op.at[0] + 2.5, op.at[1] - 2.5];
        const lw = String(op.label).length * 1.45;
        const x0 = op.label_at ? lp[0] - lw / 2 : lp[0];
        placed.push({ b: [x0, lp[1] - 2, x0 + lw, lp[1] + 2], w: 0.8 });
      }
    }
  }

  // 2b. texto solto procura espaço livre perto de onde o modelo o pôs
  for (const op of work) {
    if (op._drop) continue;
    if (!["text", "note"].includes(op.op)) continue;

    const modelAt: Pt = op.at ?? [10, 20];
    let origAt = modelAt;
    const isValue = VALUE_RE.test(String(op.text ?? ""));
    if (isValue) origAt = [origAt[0], origAt[1]];

    const fitX = (pos: Pt, w: number, h: number, center: boolean): Pt => {
      const x = center
        ? Math.min(Math.max(pos[0], w / 2 + 2), 98 - w / 2)
        : Math.min(pos[0], Math.max(3, 97 - w));
      const y = Math.min(Math.max(pos[1], h / 2 + 2), 73 - h / 2);
      return [x, y];
    };

    const raw = opBBox(op)!;
    const estW = raw[2] - raw[0];
    const estH = raw[3] - raw[1];
    const center = op.align === "center";

    let bestPos: Pt = origAt;
    let bestScore = Infinity;
    for (const [dx, dy] of TEXT_CANDIDATES) {
      const pos = fitX([origAt[0] + dx, origAt[1] + dy], estW, estH, center);
      const probe = { ...op, at: pos };
      const bb = opBBox(probe)!;
      const sc = score(bb, placed);
      if (sc <= 0.5) {
        bestPos = pos;
        bestScore = sc;
        break;
      }
      if (sc < bestScore) {
        bestScore = sc;
        bestPos = pos;
      }
    }

    if (bestScore > 0.75) {
      for (let py = 16; py < 70; py += 5) {
        for (let px = 3; px < 96; px += 5) {
          const pos = fitX([px, py], estW, estH, center);
          const bb = opBBox({ ...op, at: pos })!;
          const sc =
            score(bb, placed) + 0.03 * (Math.abs(px - origAt[0]) + Math.abs(py - origAt[1]));
          if (sc < bestScore) {
            bestScore = sc;
            bestPos = pos;
          }
        }
      }
    }

    if (bestScore > 6) {
      op._drop = true;
      continue;
    }
    op.at = bestPos;
    const fb = opBBox(op)!;
    placed.push({ b: [fb[0] - 1.8, fb[1] - 1.8, fb[2] + 1.8, fb[3] + 1.8], w: 1 });
    if (op.label_at) {
      // etiquetas de seta também fogem
      const lp = op.label_at as Pt;
      op.label_at = clampPt(lp);
    }
  }

  return { ops: work.filter((o) => !o._drop) as Op[], placed };
}

function x0Of(op: any): number {
  const b = opBBox(op);
  return b ? b[0] : 0;
}
function y0Of(op: any): number {
  const b = opBBox(op);
  return b ? b[1] : 0;
}

// Aplica ops novas por cima do quadro existente, tratando clear/erase.
export function applyOps(existing: Item[], incoming: Op[], nextSeed: () => number): Item[] {
  let base = [...existing];
  const fresh: Op[] = [];

  for (const op of incoming) {
    if (op.op === "clear") {
      base = [];
      continue;
    }
    if (op.op === "erase") {
      if (op.id) base = base.filter((i) => i.id !== op.id);
      continue;
    }
    fresh.push(op);
  }

  const prior = base
    .map((i) => opBBox(i.op))
    .filter((b): b is Box => !!b)
    .map((b) => ({ b, w: 1 }));

  const { ops } = layoutPass(fresh, prior);
  return [
    ...base,
    ...ops.map((op, i) => ({
      id: `op-${nextSeed()}-${i}`,
      op,
      seed: nextSeed(),
    })),
  ];
}
