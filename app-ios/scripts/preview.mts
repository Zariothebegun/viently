/*
  Pré-visualização fora do telemóvel.
  Corre a MESMA geometria da app (jitter, layout, coordenadas) e rasteriza
  para PNG, para se poder olhar para o quadro sem iPhone à frente.

  Uso: npx tsx scripts/preview.mts
*/
import { writeFileSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";
import { catmullRom, ellipsePts, jitterSeg, mulberry32, toPath } from "../src/board/geom";
import { applyOps } from "../src/board/layout";
import type { Item, Op, Pt } from "../src/board/ops";
import { seedLesson } from "../src/lesson/seed";

const SCALE = 10; // 100x75 -> 1000x750

const C: Record<string, string> = {
  ink: "#1f2024", blue: "#3b74c9", red: "#c2564f", green: "#3f7d4e",
  orange: "#d06a2c", purple: "#6f63c9", gray: "#8a93a5", yellow: "#d4a017",
};
const F: Record<string, string> = {
  ink: "none", blue: "#c3d8ef", red: "#f0cfc9", green: "#cfe3d2",
  orange: "#f4d8c2", purple: "#ded9f6", gray: "#e7e6df", yellow: "#f6e6bd",
};
const col = (c?: string) => (c && C[c]) || c || C.ink;
const fll = (c?: string) => (c && F[c]) || "none";

const body: string[] = [];

function path(pts: Pt[], stroke: string, width = 0.55, extra = "") {
  const d = toPath(pts, 1);
  if (!d) return;
  body.push(
    `<path d="${d}" stroke="${stroke}" stroke-width="${width}" fill="none" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`,
  );
}

function text(t: string, at: Pt, size = "m", fill = C.ink, align: "left" | "center" = "left", maxW?: number) {
  const fs = { s: 3, m: 4, l: 5.1, xl: 6.2 }[size] ?? 4;
  const cw = { s: 1.45, m: 1.9, l: 2.35, xl: 2.9 }[size] ?? 1.9;
  const limit = maxW ?? (size === "xl" ? 88 : 52);
  const words = String(t).split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? line + " " + w : w;
    if (line && next.length * cw > limit) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  const lh = fs * 1.12;
  const x = align === "center" ? at[0] - (Math.max(...lines.map((l) => l.length * cw)) / 2) : at[0];
  lines.forEach((l, i) => {
    body.push(
      `<text x="${x}" y="${at[1] + i * lh + fs * 0.34}" font-size="${fs}" font-family="Segoe Print, Caveat, cursive" fill="${fill}">${esc(l)}</text>`,
    );
  });
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function head(a: Pt, b: Pt, stroke: string) {
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const L = 2.6;
  const p1 = [b[0] - L * Math.cos(ang - 0.45), b[1] - L * Math.sin(ang - 0.45)];
  const p2 = [b[0] - L * Math.cos(ang + 0.45), b[1] - L * Math.sin(ang + 0.45)];
  body.push(
    `<path d="M ${b[0]} ${b[1]} L ${p1[0]} ${p1[1]} M ${b[0]} ${b[1]} L ${p2[0]} ${p2[1]}" stroke="${stroke}" stroke-width="0.55" fill="none" stroke-linecap="round"/>`,
  );
}

function draw(item: Item) {
  const o: any = item.op;
  const rnd = mulberry32(item.seed);
  const s = col(o.color);

  switch (o.op) {
    case "title":
      text(o.text, [50, 7.5], "xl", s, "center", 86);
      body.push(`<path d="M ${50 - Math.min(34, o.text.length * 1.1)} 12.2 L ${50 + Math.min(34, o.text.length * 1.1)} 12.2" stroke="${s}" stroke-width="0.5" stroke-linecap="round"/>`);
      break;
    case "text":
      text(o.text, o.at, o.size ?? "m", s, o.align ?? "left", o.fit_w);
      break;
    case "note":
      text(o.text, o.at, "s", s === C.ink ? C.gray : s, o.align ?? "left");
      break;
    case "line":
      path(jitterSeg(rnd, o.from, o.to, 0.55), s);
      break;
    case "arrow":
      path(jitterSeg(rnd, o.from, o.to, 0.45), s);
      head(o.from, o.to, s);
      if (o.label) {
        const mid = o.label_at ?? [(o.from[0] + o.to[0]) / 2, (o.from[1] + o.to[1]) / 2 - 3.4];
        text(o.label, mid, "s", s, "center");
      }
      break;
    case "callout": {
      const c: Pt = o.around ?? o.at ?? [50, 38];
      const r = o.r ?? 3;
      const dest: Pt = o.label_at ?? o.to ?? [c[0] + 12, c[1] - 8];
      const dx = dest[0] - c[0], dy = dest[1] - c[1];
      const len = Math.hypot(dx, dy) || 1;
      path(ellipsePts(rnd, c[0], c[1], r, r * 0.82), col(o.color ?? "orange"));
      const a: Pt = [c[0] + (dx / len) * (r + 0.5), c[1] + (dy / len) * (r + 0.5)];
      const b: Pt = [dest[0] - (dx / len) * 4, dest[1] - (dy / len) * 4];
      path(jitterSeg(rnd, a, b, 0.4), col(o.color ?? "orange"), 0.47);
      if (o.label) text(o.label, dest, "s", col(o.color ?? "orange"), "center", 24);
      break;
    }
    case "box": {
      const [x, y] = o.at;
      const w = o.w ?? 22, h = o.h ?? 10;
      body.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.4" fill="${fll(o.color)}" opacity="0.85"/>`);
      const e: [Pt, Pt][] = [[[x, y], [x + w, y]], [[x + w, y], [x + w, y + h]], [[x + w, y + h], [x, y + h]], [[x, y + h], [x, y]]];
      e.forEach((seg) => path(jitterSeg(rnd, seg[0], seg[1], 0.55), s));
      if (o.label) text(o.label, [x + w / 2, y + h / 2], o.size ?? "m", s, "center", w * 0.9);
      break;
    }
    case "ellipse": {
      const [x, y] = o.at;
      const w = o.w ?? 22, h = o.h ?? 12;
      body.push(`<ellipse cx="${x + w / 2}" cy="${y + h / 2}" rx="${w / 2}" ry="${h / 2}" fill="${fll(o.color)}" opacity="0.85"/>`);
      path(ellipsePts(rnd, x + w / 2, y + h / 2, w / 2, h / 2), s);
      if (o.label) text(o.label, [x + w / 2, y + h / 2], o.size ?? "m", s, "center", w * 0.76);
      break;
    }
    case "curve": {
      const pts = (o.points as Pt[]).map((p) => [p[0] + (rnd() - 0.5) * 0.3, p[1] + (rnd() - 0.5) * 0.3] as Pt);
      path(catmullRom(pts), s);
      break;
    }
    case "polygon": {
      const pts: Pt[] = o.points;
      path([...pts, pts[0]], s);
      if (o.label) {
        const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length;
        const cy = pts.reduce((a, p) => a + p[1], 0) / pts.length;
        text(o.label, [cx, cy], o.size ?? "m", s, "center");
      }
      break;
    }
    case "notes": {
      const [nx, ny] = o.at ?? [66, 20];
      const compact = !!o.compact;
      const maxW = compact ? 30 : 38;
      const lines: [string, string][] = [];
      if (o.title) lines.push([String(o.title), compact ? "s" : "m"]);
      (o.lines ?? []).slice(0, 7).forEach((t: string) => lines.push([String(t), "s"]));
      let yy = ny;
      lines.forEach(([t, sz], i) => {
        text(t, [nx + (i > 0 ? (compact ? 1.5 : 2) : 0), yy], sz as any, i === 0 && o.title ? C.ink : "#3b3d45", "left", maxW);
        const wrapped = Math.max(1, Math.ceil((t.length * (sz === "m" ? 1.9 : 1.45)) / maxW));
        const base = i === 0 && o.title ? (compact ? 4.8 : 6.2) : compact ? 4 : 5.2;
        yy += base + (wrapped - 1) * (compact ? 3.2 : 3.9);
      });
      break;
    }
    case "axes": {
      const [x, y] = o.at ?? [16, 22];
      const w = o.w ?? 46, h = o.h ?? 32;
      path(jitterSeg(rnd, [x, y], [x, y + h], 0.5), C.ink);
      head([x, y + h], [x, y], C.ink);
      path(jitterSeg(rnd, [x, y + h], [x + w, y + h], 0.5), C.ink);
      head([x, y + h], [x + w, y + h], C.ink);
      break;
    }
    case "graph": {
      const [x, y] = o.at ?? [12, 22];
      const w = o.w ?? 56, h = o.h ?? 34;
      const [xmin, xmax] = o.x_range ?? [0, 1];
      const [ymin, ymax] = o.y_range ?? [0, 1];
      const xs = Math.max(1e-9, xmax - xmin), ys = Math.max(1e-9, ymax - ymin);
      const map = (p: Pt): Pt => [x + Math.max(0, Math.min(1, (p[0] - xmin) / xs)) * w, y + h - Math.max(0, Math.min(1, (p[1] - ymin) / ys)) * h];
      for (let i = 1; i < 5; i++) {
        path(jitterSeg(rnd, [x + (w * i) / 5, y], [x + (w * i) / 5, y + h], 0.4), C.gray, 0.19);
        path(jitterSeg(rnd, [x, y + (h * i) / 5], [x + w, y + (h * i) / 5], 0.4), C.gray, 0.19);
      }
      path(jitterSeg(rnd, [x, y], [x, y + h], 0.5), C.ink);
      path(jitterSeg(rnd, [x, y + h], [x + w, y + h], 0.5), C.ink);
      for (let i = 0; i <= 5; i++) {
        text(String(Math.round((xmin + (xs * i) / 5) * 100) / 100), [x + (w * i) / 5, y + h + 4], "s", C.gray, "center");
        if (i % 2 === 0) text(String(Math.round((ymin + (ys * i) / 5) * 100) / 100), [x - 3, y + h - (h * i) / 5], "s", C.gray, "center");
      }
      (o.series ?? []).forEach((sr: any, si: number) => {
        const pts = (sr.points as Pt[]).map(map);
        if (pts.length < 2) return;
        path(catmullRom(pts), col(sr.color ?? "blue"), 0.69);
        if (sr.label) text(String(sr.label), [x + w - 12, y + 2 + si * 4.2], "s", col(sr.color ?? "blue"), "left", 14);
      });
      (o.markers ?? []).forEach((m: any) => {
        const [mx, my] = map(m.at);
        body.push(`<circle cx="${mx}" cy="${my}" r="0.9" fill="${col(m.color ?? "orange")}"/>`);
        if (m.label) text(String(m.label), [mx + 2, my - 3], "s", col(m.color ?? "orange"), "left");
      });
      if (o.title) text(o.title, [x + w / 2, y - 5], "m", C.ink, "center", w * 0.9);
      if (o.xlabel) text(o.xlabel, [x + w / 2, y + h + 8.5], "s", C.gray, "center", w);
      break;
    }
    case "model3d": {
      const [x, y] = (o.at ?? [66, 14]) as Pt;
      const w = o.w ?? 34;
      const h = o.h ?? 18;
      const s0 = Math.min(3.7, h * 0.19, w * 0.115);
      const cx = x + w / 2;
      const cy = y + h * 0.235;
      const ink = "#4c6b53";
      body.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2.2" fill="#eef1e9" opacity="0.9"/>`);
      const e: [Pt, Pt][] = [[[x, y], [x + w, y]], [[x + w, y], [x + w, y + h]], [[x + w, y + h], [x, y + h]], [[x, y + h], [x, y]]];
      e.forEach((seg) => path(jitterSeg(rnd, seg[0], seg[1], 0.5), ink));
      const top: Pt[] = [[cx, cy - s0], [cx + s0 * 0.88, cy - s0 * 0.44], [cx, cy + s0 * 0.12], [cx - s0 * 0.88, cy - s0 * 0.44]];
      const left: Pt[] = [[cx - s0 * 0.88, cy - s0 * 0.44], [cx, cy + s0 * 0.12], [cx, cy + s0 * 1.16], [cx - s0 * 0.88, cy + s0 * 0.6]];
      const right: Pt[] = [[cx + s0 * 0.88, cy - s0 * 0.44], [cx, cy + s0 * 0.12], [cx, cy + s0 * 1.16], [cx + s0 * 0.88, cy + s0 * 0.6]];
      body.push(`<path d="${toPath([...top, top[0]])}" fill="#d7e3d6"/>`);
      body.push(`<path d="${toPath([...left, left[0]])}" fill="#c3d4c4"/>`);
      body.push(`<path d="${toPath([...right, right[0]])}" fill="#b0c5b3"/>`);
      [top, left, right].forEach((poly) => path([...poly, poly[0]], ink, 0.47));
      if (o.title) text(o.title, [cx, y + h * 0.63], "m", C.ink, "center", w - 3);
      text("toca para abrir", [cx, y + h * 0.9], "s", C.gray, "center", w - 4);
      break;
    }
    case "underline":
    case "highlight": {
      const [x, y] = o.at;
      path(jitterSeg(rnd, [x, y], [x + (o.w ?? 20), y], 1.2), o.op === "highlight" ? "#f5e3a3" : col(o.color ?? "orange"), o.op === "highlight" ? 3.4 : 0.8, o.op === "highlight" ? 'opacity="0.75"' : "");
      break;
    }
    case "dot": {
      body.push(`<circle cx="${o.at[0]}" cy="${o.at[1]}" r="0.9" fill="${s}"/>`);
      if (o.label) text(o.label, o.label_at ?? [o.at[0] + 2.5, o.at[1] - 2.5], "s", s, o.label_at ? "center" : "left");
      break;
    }
  }
}

function render(items: Item[], out: string, note: string) {
  body.length = 0;
  items.forEach(draw);
  const grid: string[] = [];
  for (let i = 0; i <= 100; i += 4.2) grid.push(`<line x1="${i}" y1="0" x2="${i}" y2="75" stroke="#e3e0d2" stroke-width="0.09"/>`);
  for (let j = 0; j <= 75; j += 4.2) grid.push(`<line x1="0" y1="${j}" x2="100" y2="${j}" stroke="#e3e0d2" stroke-width="0.09"/>`);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${100 * SCALE}" height="${75 * SCALE}" viewBox="0 0 100 75">
    <rect width="100" height="75" fill="#f6f4ec"/>${grid.join("")}${body.join("")}
    <text x="50" y="74" font-size="1.6" font-family="Segoe UI" fill="#b9b5a6" text-anchor="middle">${esc(note)}</text>
  </svg>`;
  const png = new Resvg(svg, { fitTo: { mode: "width", value: 100 * SCALE } }).render().asPng();
  writeFileSync(out, png);
  console.log("ok", out, png.length, "bytes");
}

// 1. quadro da aula-semente, passo a passo acumulado
let items: Item[] = [];
let n = 1;
for (const step of seedLesson.steps) {
  items = applyOps(items, step.board as Op[], () => n++);
}
render(items, "preview-seed.png", "aula-semente · estado final");

// 2. teste hostil: ops deliberadamente sobrepostas e fora do quadro
const evil: Op[] = [
  { op: "title", text: "Teste de colisões" },
  { op: "box", at: [5, 20], w: 20, h: 10, label: "caixa A", color: "blue" },
  { op: "box", at: [7, 22], w: 20, h: 10, label: "caixa B", color: "red" },
  { op: "text", text: "texto por cima da caixa", at: [8, 24], size: "m" },
  { op: "text", text: "texto 2 no mesmo sítio", at: [8, 24], size: "m" },
  { op: "arrow", from: [10, 30], to: [95, 60], label: "seta enorme" },
  { op: "ellipse", at: [90, 60], w: 20, h: 14, label: "sai do quadro", color: "green" },
  { op: "notes", at: [70, 30], title: "Notas", lines: ["linha um", "linha dois", "linha três", "linha quatro"] },
  { op: "notes", at: [71, 32], title: "Notas 2", lines: ["a", "b", "c"] },
  { op: "dot", at: [50, 50], label: "ponto" },
  { op: "callout", around: [50, 50], to: [60, 44], label: "explicação" },
];
let evilItems: Item[] = [];
evilItems = applyOps(evilItems, evil, () => n++);
render(evilItems, "preview-stress.png", "teste de colisões");
