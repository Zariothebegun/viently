import React from "react";

class OpBoundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    // Um elemento SVG inválido não deve derrubar a página inteira.
    if (__DEV__) console.warn("Viently: elemento visual ignorado", error.message);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}
import Svg, { Circle, Ellipse, G, Line, Path, Rect, Text as T } from "react-native-svg";
import {
  CHAR_W,
  FILL,
  FONT,
  FONT_UNITS,
  GRID,
  HILITE,
  LINE_H,
  LOGICAL_H,
  LOGICAL_W,
  PALETTE,
  PAPER,
  catmullRom,
  color,
  ellipsePts,
  jitterSeg,
  mulberry32,
  toPath,
  wrapText,
} from "./geom";
import { partFrac, timingOf, type Timing } from "./timeline";
import { CodeBlock, Plot3dBlock } from "./Blocks";
import type { Item, Pt, Size } from "./ops";

const W = 0.55;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

function stroked(pts: Pt[], frac: number, stroke: string, width = W) {
  const d = toPath(pts, frac);
  if (!d) return null;
  return (
    <Path
      d={d}
      stroke={stroke}
      strokeWidth={width}
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

// ---------------- texto ----------------

function RevealText({
  text,
  at,
  size = "m",
  fill,
  frac,
  align = "left",
  fitW,
  seed,
  bold,
  valign = "middle",
}: {
  text: string;
  at: Pt;
  size?: Size;
  fill: string;
  frac: number;
  align?: "left" | "center";
  fitW?: number;
  seed: number;
  bold?: boolean;
  valign?: "middle" | "top";
}) {
  const rnd = mulberry32(seed);
  const rot = (rnd() - 0.5) * 1.4;
  const fs = FONT_UNITS[size] * (bold ? 1.05 : 1);
  const lines = wrapText(text, size, fitW);
  const lineH = LINE_H[size];
  let budget = Math.ceil(String(text).replace(/\^/g, "").length * clamp01(frac));
  if (budget <= 0) return null;

  let x = at[0];
  if (align === "center") {
    const widest = Math.max(...lines.map((l) => l.length * CHAR_W[size]));
    x = at[0] - widest / 2;
  }
  const y0 = valign === "top" ? at[1] : at[1] - ((lines.length - 1) * lineH) / 2;

  const rows: React.ReactNode[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (budget <= 0) break;
    const line = lines[i];
    const shown = line.slice(0, budget);
    budget -= line.length;
    if (!shown) continue;
    rows.push(
      <T
        key={`l${i}`}
        x={x}
        y={y0 + i * lineH + fs * 0.34}
        fontSize={fs}
        fontFamily={FONT}
        fill={fill}
      >
        {shown}
      </T>,
    );
  }

  return <G transform={`rotate(${rot} ${at[0]} ${at[1]})`}>{rows}</G>;
}

// ---------------- formas ----------------

function fillFor(op: any): string {
  const c = (op.color ?? "ink") as keyof typeof FILL;
  if (c === "ink") return "none";
  return FILL[c] ?? "none";
}

function BoxOp({
  op,
  frac,
  seed,
  t,
}: {
  op: any;
  frac: number;
  seed: number;
  t: Timing;
}) {
  const rnd = mulberry32(seed);
  const [x, y] = op.at as Pt;
  const w = op.w ?? 22;
  const h = op.h ?? 10;
  const stroke = color(op.color);
  const fill = fillFor(op);
  const p0 = partFrac(t, frac, 0);
  const p1 = partFrac(t, frac, 1);
  const edges: [Pt, Pt][] = [
    [[x, y], [x + w, y]],
    [[x + w, y], [x + w, y + h]],
    [[x + w, y + h], [x, y + h]],
    [[x, y + h], [x, y]],
  ];
  const sf = p0 * 4;
  return (
    <G>
      {fill !== "none" && p0 > 0.02 && (
        <Rect
          x={x}
          y={y}
          width={w}
          height={h}
          rx={1.4}
          fill={fill}
          opacity={0.85 * Math.min(1, p0 * 2.5)}
        />
      )}
      {edges.map((e, i) => {
        const f = clamp01(sf - i);
        if (f <= 0) return null;
        return (
          <React.Fragment key={i}>
            {stroked(jitterSeg(rnd, e[0], e[1], 0.55), f, stroke)}
          </React.Fragment>
        );
      })}
      {op.label && p1 > 0 && (
        <RevealText
          text={op.label}
          at={[x + w / 2, y + h / 2]}
          size={op.size ?? "m"}
          fill={stroke}
          frac={p1}
          align="center"
          fitW={w * 0.9}
          seed={seed + 1}
        />
      )}
    </G>
  );
}

function EllipseOp({
  op,
  frac,
  seed,
  t,
}: {
  op: any;
  frac: number;
  seed: number;
  t: Timing;
}) {
  const rnd = mulberry32(seed);
  const [x, y] = op.at as Pt;
  const w = op.w ?? 22;
  const h = op.h ?? 12;
  const stroke = color(op.color);
  const fill = fillFor(op);
  const p0 = partFrac(t, frac, 0);
  const p1 = partFrac(t, frac, 1);
  return (
    <G>
      {fill !== "none" && p0 > 0.02 && (
        <Ellipse
          cx={x + w / 2}
          cy={y + h / 2}
          rx={w / 2}
          ry={h / 2}
          fill={fill}
          opacity={0.85 * Math.min(1, p0 * 2.5)}
        />
      )}
      {stroked(ellipsePts(rnd, x + w / 2, y + h / 2, w / 2, h / 2), p0, stroke)}
      {op.label && p1 > 0 && (
        <RevealText
          text={op.label}
          at={[x + w / 2, y + h / 2]}
          size={op.size ?? "m"}
          fill={stroke}
          frac={p1}
          align="center"
          fitW={w * 0.76}
          seed={seed + 1}
        />
      )}
    </G>
  );
}

function ArrowHead({ a, b, stroke, width = W }: { a: Pt; b: Pt; stroke: string; width?: number }) {
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const L = 2.6;
  const p1: Pt = [b[0] - L * Math.cos(ang - 0.45), b[1] - L * Math.sin(ang - 0.45)];
  const p2: Pt = [b[0] - L * Math.cos(ang + 0.45), b[1] - L * Math.sin(ang + 0.45)];
  return (
    <G stroke={stroke} strokeWidth={width} strokeLinecap="round" fill="none">
      <Line x1={b[0]} y1={b[1]} x2={p1[0]} y2={p1[1]} />
      <Line x1={b[0]} y1={b[1]} x2={p2[0]} y2={p2[1]} />
    </G>
  );
}

function GraphOp({
  op,
  frac,
  seed,
  t,
}: {
  op: any;
  frac: number;
  seed: number;
  t: Timing;
}) {
  const [x, y] = (op.at ?? [12, 22]) as Pt;
  const w = Math.max(12, op.w ?? 58);
  const h = Math.max(12, op.h ?? 38);
  const [xmin, xmax] = (op.x_range ?? [0, 1]) as Pt;
  const [ymin, ymax] = (op.y_range ?? [0, 1]) as Pt;
  const xs = xmax > xmin ? xmax - xmin : 1;
  const ys = ymax > ymin ? ymax - ymin : 1;
  const map = (point: Pt): Pt => [
    x + ((point[0] - xmin) / xs) * w,
    y + h - ((point[1] - ymin) / ys) * h,
  ];
  const fmt = (v: number) => {
    const n = Math.abs(v) < 0.001 ? 0 : v;
    return Number(n.toFixed(2)).toLocaleString("pt-PT", { maximumFractionDigits: 2 });
  };
  const series = (Array.isArray(op.series) ? op.series : [])
    .slice(0, 4)
    .map((s: any) => ({
      ...s,
      points: (Array.isArray(s.points) ? s.points : [])
        .filter((p: any) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]))
        .slice()
        .sort((a: Pt, b: Pt) => a[0] - b[0]),
    }))
    .filter((s: any) => s.points.length >= 2);
  const p = (i: number) => partFrac(t, frac, i);
  const gridP = p(0);
  const axisP = p(1);
  const dataP = p(2);
  const labelsP = p(3);
  const zeroY = ymin <= 0 && ymax >= 0 ? map([xmin, 0])[1] : y + h;
  const zeroX = xmin <= 0 && xmax >= 0 ? map([0, ymin])[0] : x;
  const makeD = (points: Pt[], progress: number) => {
    if (points.length < 2 || progress <= 0) return "";
    const total = points.length - 1;
    const upto = Math.max(1, Math.min(total, progress * total));
    const full = Math.floor(upto);
    const partial = upto - full;
    const shown = points.slice(0, full + 1);
    if (partial > 0 && full < total) {
      const from = points[full];
      const to = points[full + 1];
      shown.push([from[0] + (to[0] - from[0]) * partial, from[1] + (to[1] - from[1]) * partial]);
    }
    return shown.map((pt, i) => `${i ? "L" : "M"} ${pt[0].toFixed(2)} ${pt[1].toFixed(2)}`).join(" ");
  };

  return (
    <G>
      {[1, 2, 3, 4].map((i) => (
        <React.Fragment key={`grid-${i}`}>
          {stroked([[x + (w * i) / 5, y], [x + (w * i) / 5, y + h]], gridP, PALETTE.gray, W * 0.28)}
          {stroked([[x, y + (h * i) / 5], [x + w, y + (h * i) / 5]], gridP, PALETTE.gray, W * 0.28)}
        </React.Fragment>
      ))}
      {stroked([[x, zeroY], [x + w, zeroY]], axisP, PALETTE.ink, W * 0.95)}
      {stroked([[zeroX, y + h], [zeroX, y]], axisP, PALETTE.ink, W * 0.95)}
      {axisP > 0 && Array.from({ length: 5 }, (_, i) => {
        const xv = xmin + (xs * i) / 4;
        const yv = ymin + (ys * i) / 4;
        const xp = x + (w * i) / 4;
        const yp = y + h - (h * i) / 4;
        return (
          <React.Fragment key={`tick-${i}`}>
            <Line x1={xp} y1={zeroY - 0.7} x2={xp} y2={zeroY + 0.7} stroke={PALETTE.ink} strokeWidth={0.35} />
            <Line x1={zeroX - 0.7} y1={yp} x2={zeroX + 0.7} y2={yp} stroke={PALETTE.ink} strokeWidth={0.35} />
            {i % 2 === 0 && (
              <>
                <RevealText text={fmt(xv)} at={[xp, Math.min(74, zeroY + 3.3)]} size="s" fill={PALETTE.gray} frac={labelsP} align="center" seed={seed + i} />
                <RevealText text={fmt(yv)} at={[Math.max(2, zeroX - 3.2), yp]} size="s" fill={PALETTE.gray} frac={labelsP} align="center" seed={seed + 20 + i} />
              </>
            )}
          </React.Fragment>
        );
      })}
      {series.map((s: any, i: number) => {
        const pts = s.points.map(map);
        const d = makeD(pts, dataP);
        if (!d) return null;
        return <Path key={`series-${i}`} d={d} stroke={color(s.color ?? (i === 0 ? "blue" : "purple"))} strokeWidth={W * 1.55} strokeLinecap="round" strokeLinejoin="round" fill="none" />;
      })}
      {(Array.isArray(op.markers) ? op.markers : []).slice(0, 8).map((m: any, i: number) => {
        if (!Array.isArray(m.at)) return null;
        const [mx, my] = map(m.at as Pt);
        if (mx < x || mx > x + w || my < y || my > y + h) return null;
        return (
          <G key={`marker-${i}`}>
            <Circle cx={mx} cy={my} r={1.25} fill={color(m.color ?? "orange")} />
            {m.label && <RevealText text={String(m.label)} at={[mx + 2, my - 2.5]} size="s" fill={color(m.color ?? "orange")} frac={labelsP} seed={seed + 60 + i} />}
          </G>
        );
      })}
      {op.title && <RevealText text={String(op.title)} at={[x + w / 2, y - 5]} size="m" fill={PALETTE.ink} frac={labelsP} align="center" seed={seed + 80} fitW={w * 0.9} />}
      {op.xlabel && <RevealText text={String(op.xlabel)} at={[x + w / 2, Math.min(74, y + h + 5.5)]} size="s" fill={PALETTE.gray} frac={labelsP} align="center" seed={seed + 81} fitW={w} />}
      {op.ylabel && <RevealText text={String(op.ylabel)} at={[x - 2, y - 4]} size="s" fill={PALETTE.gray} frac={labelsP} align="center" seed={seed + 82} />}
    </G>
  );
}

function pointAlong(points: Pt[], progress: number): Pt {
  if (points.length < 2) return points[0] ?? [50, 38];
  const lengths = points.slice(1).map((p, i) => Math.hypot(p[0] - points[i][0], p[1] - points[i][1]));
  const total = lengths.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return points[0];
  let remaining = clamp01(progress) * total;
  for (let i = 0; i < lengths.length; i++) {
    const length = lengths[i];
    if (remaining <= length || i === lengths.length - 1) {
      const t = length > 0 ? clamp01(remaining / length) : 1;
      return [
        points[i][0] + (points[i + 1][0] - points[i][0]) * t,
        points[i][1] + (points[i + 1][1] - points[i][1]) * t,
      ];
    }
    remaining -= length;
  }
  return points[points.length - 1];
}

function renderOp(item: Item, frac: number, onHotspotPress?: (id: string) => void, activeHotspot?: string | null): React.ReactNode {
  const o: any = item.op;
  const seed = item.seed;
  const rnd = mulberry32(seed);
  const stroke = color(o.color);
  const tm = timingOf(item);
  const p = (i: number) => partFrac(tm, frac, i);

  switch (o.op) {
    case "title": {
      const p0 = p(0);
      const p1 = p(1);
      return (
        <G key={item.id}>
          <RevealText
            text={o.text}
            at={[50, 7.5]}
            size="xl"
            fill={stroke}
            frac={p0}
            align="center"
            fitW={86}
            seed={seed}
            bold
          />
          {p1 > 0 &&
            stroked(
              jitterSeg(
                mulberry32(seed + 7),
                [50 - Math.min(34, String(o.text).length * 1.1), 12.2],
                [50 + Math.min(34, String(o.text).length * 1.1), 12.2],
                0.5,
              ),
              p1,
              stroke,
            )}
        </G>
      );
    }

    case "text":
      return (
        <RevealText
          key={item.id}
          text={o.text}
          at={o.at ?? [10, 20]}
          size={o.size ?? "m"}
          fill={stroke}
          frac={p(0)}
          align={o.align}
          fitW={o.fit_w}
          seed={seed}
        />
      );

    case "note":
      return (
        <RevealText
          key={item.id}
          text={o.text}
          at={o.at ?? [10, 20]}
          size="s"
          fill={stroke === PALETTE.ink ? PALETTE.gray : stroke}
          frac={p(0)}
          align={o.align}
          seed={seed}
        />
      );

    case "line":
      return <G key={item.id}>{stroked(jitterSeg(rnd, o.from, o.to, 0.55), p(0), stroke)}</G>;

    case "motion": {
      const points = (o.points ?? []) as Pt[];
      if (points.length < 2) return null;
      const current = pointAlong(points, frac);
      const path = points.map((point, index) =>
        `${index === 0 ? "M" : "L"} ${point[0].toFixed(2)} ${point[1].toFixed(2)}`,
      ).join(" ");
      const c = color(o.color ?? "blue");
      const r = Math.max(0.8, Math.min(3.5, Number(o.radius) || 1.8));
      return (
        <G key={item.id}>
          {o.trail !== false && (
            <Path d={path} stroke={c} strokeWidth={0.55} strokeDasharray="1.8 1.8" strokeLinecap="round" fill="none" opacity={0.38} />
          )}
          <Circle cx={current[0]} cy={current[1]} r={r * 1.9} fill={c} opacity={0.14} />
          <Circle cx={current[0]} cy={current[1]} r={r} fill={c} />
          {!!o.label && frac > 0.28 && (
            <RevealText
              text={String(o.label)}
              at={[Math.min(94, current[0] + 3.2), Math.max(4, current[1] - 3.2)]}
              size="s"
              fill={c}
              frac={clamp01((frac - 0.28) / 0.5)}
              seed={seed + 3}
            />
          )}
        </G>
      );
    }

    case "scene": {
      const duration = Math.max(1, Number(o.duration_ms) || 1);
      return (
        <G key={item.id}>
          {(o.elements ?? []).map((element: any, index: number) => {
            const childDuration = Math.max(1, Number(element.duration_ms) || 1);
            const elapsed = frac * duration - Math.max(0, Number(element.at_ms) || 0);
            const childFrac = clamp01(elapsed / childDuration);
            if (childFrac <= 0) return null;
            return renderOp(
              { id: item.id + "-scene-" + index, seed: seed + (index + 1) * 37, op: element.op },
              childFrac,
              onHotspotPress,
              activeHotspot,
            );
          })}
        </G>
      );
    }

    case "arrow": {
      return (
        <G key={item.id}>
          {stroked(jitterSeg(rnd, o.from, o.to, 0.45), p(0), stroke)}
          {p(1) > 0 && (
            <G opacity={Math.min(1, p(1) * 3)}>
              <ArrowHead a={o.from} b={o.to} stroke={stroke} />
            </G>
          )}
          {o.label && p(2) > 0 && (
            <RevealText
              text={o.label}
              at={o.label_at ?? [(o.from[0] + o.to[0]) / 2, (o.from[1] + o.to[1]) / 2 - 3.4]}
              size="s"
              fill={stroke}
              frac={p(2)}
              align="center"
              seed={seed + 1}
            />
          )}
        </G>
      );
    }

    case "callout": {
      const c: Pt = o.around ?? o.at ?? [50, 38];
      const r = o.r ?? 3;
      const dest: Pt = o.label_at ?? o.to ?? [c[0] + 12, c[1] - 8];
      const dx = dest[0] - c[0];
      const dy = dest[1] - c[1];
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;
      const a: Pt = [c[0] + ux * (r + 0.5), c[1] + uy * (r + 0.5)];
      const b: Pt = [dest[0] - ux * 4, dest[1] - uy * 4];
      return (
        <G key={item.id}>
          {stroked(ellipsePts(rnd, c[0], c[1], r, r * 0.82), p(0), color(o.color ?? "orange"))}
          {stroked(jitterSeg(rnd, a, b, 0.4), p(1), color(o.color ?? "orange"), W * 0.85)}
          {o.label && p(2) > 0 && (
            <RevealText
              text={o.label}
              at={dest}
              size="s"
              fill={color(o.color ?? "orange")}
              frac={p(2)}
              align="center"
              fitW={o.fit_w ?? 24}
              seed={seed + 1}
            />
          )}
        </G>
      );
    }

    case "box":
      return <BoxOp key={item.id} op={o} frac={frac} seed={seed} t={tm} />;

    case "ellipse":
      return <EllipseOp key={item.id} op={o} frac={frac} seed={seed} t={tm} />;

    case "curve": {
      const pts = (o.points ?? []).map((q: Pt) => [q[0] + (rnd() - 0.5) * 0.3, q[1] + (rnd() - 0.5) * 0.3] as Pt);
      if (pts.length < 2) return null;
      return <G key={item.id}>{stroked(catmullRom(pts), p(0), stroke)}</G>;
    }

    case "polygon": {
      const pts: Pt[] = o.points ?? [];
      if (pts.length < 3) return null;
      const segs = pts.map((q, i) => [q, pts[(i + 1) % pts.length]] as [Pt, Pt]);
      const drawFrac = p(0) * segs.length;
      let all: Pt[] = [];
      segs.forEach((sg, i) => {
        const f = clamp01(drawFrac - i);
        if (f <= 0) return;
        const j = jitterSeg(rnd, sg[0], sg[1], 0.5);
        const upto = Math.max(2, Math.ceil(j.length * f));
        const part = j.slice(0, upto);
        all = all.concat(i === 0 ? part : part.slice(1));
      });
      return (
        <G key={item.id}>
          {all.length >= 2 && stroked(all, 1, stroke)}
          {o.label && p(1) > 0 && (
            <RevealText
              text={o.label}
              at={[
                pts.reduce((s, q) => s + q[0], 0) / pts.length,
                pts.reduce((s, q) => s + q[1], 0) / pts.length,
              ]}
              size={o.size ?? "m"}
              fill={stroke}
              frac={p(1)}
              align="center"
              seed={seed + 1}
            />
          )}
        </G>
      );
    }

    case "notes": {
      const [nx, ny] = (o.at ?? [66, 20]) as Pt;
      const compact = !!o.compact;
      const maxW = compact ? 30 : 38;
      const lines: { t: string; size: Size }[] = [];
      if (o.title) lines.push({ t: String(o.title), size: compact ? "s" : "m" });
      (o.lines ?? []).slice(0, 7).forEach((t: string) => lines.push({ t: String(t), size: "s" }));
      const rows: React.ReactNode[] = [];
      let yy = ny;
      lines.forEach((ln, li) => {
        const wrapped = wrapText(ln.t, ln.size, maxW);
        rows.push(
          <RevealText
            key={li}
            text={ln.t}
            at={[nx + (li > 0 ? (compact ? 1.5 : 2) : 0), yy]}
            size={ln.size}
            fill={li === 0 && o.title ? PALETTE.ink : stroke === PALETTE.ink ? "#3b3d45" : stroke}
            frac={p(li)}
            seed={seed + li}
            fitW={maxW}
            valign="top"
          />,
        );
        const base = li === 0 && o.title ? (compact ? 4.8 : 6.2) : compact ? 4.0 : 5.2;
        yy += base + (wrapped.length - 1) * (compact ? 3.2 : 3.9);
      });
      return <G key={item.id}>{rows}</G>;
    }

    case "code":
      return <CodeBlock key={item.id} op={o} frac={frac} t={tm} />;

    case "plot3d":
      return <Plot3dBlock key={item.id} op={o} frac={frac} t={tm} />;

    case "graph":
      return <GraphOp key={item.id} op={o} frac={frac} seed={seed} t={tm} />;

    case "axes": {
      const [x, y] = (o.at ?? [16, 22]) as Pt;
      const w = o.w ?? 46;
      const h = o.h ?? 32;
      const c = color(o.color);
      const p0 = p(0);
      const f1 = clamp01(p0 / 0.45);
      const f2 = clamp01((p0 - 0.45) / 0.45);
      return (
        <G key={item.id}>
          {stroked(jitterSeg(rnd, [x, y], [x, y + h], 0.5), f1, c)}
          {f1 >= 1 && <ArrowHead a={[x, y + h]} b={[x, y]} stroke={c} />}
          {f2 > 0 && stroked(jitterSeg(rnd, [x, y + h], [x + w, y + h], 0.5), f2, c)}
          {f2 >= 1 && <ArrowHead a={[x, y + h]} b={[x + w, y + h]} stroke={c} />}
          {p(1) > 0 && o.xlabel && (
            <RevealText text={o.xlabel} at={[x + w + 2, y + h]} size="s" fill={PALETTE.gray} frac={p(1)} seed={seed + 1} />
          )}
          {p(2) > 0 && o.ylabel && (
            <RevealText text={o.ylabel} at={[x, y - 4]} size="s" fill={PALETTE.gray} frac={p(2)} align="center" seed={seed + 2} />
          )}
        </G>
      );
    }

    case "model3d": {
      const [x, y] = (o.at ?? [66, 15]) as Pt;
      const w = o.w ?? 34;
      const h = o.h ?? 18;
      const p0 = p(0);
      const p1 = p(1);
      const p2 = p(2);
      const p3 = p(3);

      // modelo da Poly Pizza: a fotografia entra no App por cima do cartão;
      // aqui fica só o contorno e a indicação de toque (nada de cubo desenhado)
      if (o.poly) {
        const sf = p0 * 4;
        const edgeColor = o.color ? stroke : "#4c6b53";
        const edgesPoly: [Pt, Pt][] = [
          [[x, y], [x + w, y]],
          [[x + w, y], [x + w, y + h]],
          [[x + w, y + h], [x, y + h]],
          [[x, y + h], [x, y]],
        ];
        return (
          <G key={item.id}>
            <Rect x={x} y={y} width={w} height={h} rx={2.2} fill="#eef1e9" opacity={0.55 * Math.min(1, p0 * 3)} />
            {edgesPoly.map((e, i) => {
              const f = clamp01(sf - i);
              return f > 0 ? (
                <React.Fragment key={i}>{stroked(jitterSeg(rnd, e[0], e[1], 0.5), f, edgeColor)}</React.Fragment>
              ) : null;
            })}
            {p1 > 0 && (
              <RevealText
                text="toca para abrir"
                at={[x + w / 2, y + h - 3.4]}
                size="s"
                fill={PALETTE.gray}
                frac={p1}
                seed={seed + 2}
                align="center"
                fitW={w - 4}
              />
            )}
          </G>
        );
      }

      // cartão vertical: o cubo em cima, a legenda por baixo (funciona em cartões estreitos)
      const s0 = Math.min(3.7, h * 0.19, w * 0.115);
      const cx = x + w / 2;
      const cy = y + h * 0.235;
      const line = o.color ? stroke : "#4c6b53";
      const top: Pt[] = [
        [cx, cy - s0],
        [cx + s0 * 0.88, cy - s0 * 0.44],
        [cx, cy + s0 * 0.12],
        [cx - s0 * 0.88, cy - s0 * 0.44],
      ];
      const left: Pt[] = [
        [cx - s0 * 0.88, cy - s0 * 0.44],
        [cx, cy + s0 * 0.12],
        [cx, cy + s0 * 1.16],
        [cx - s0 * 0.88, cy + s0 * 0.6],
      ];
      const right: Pt[] = [
        [cx + s0 * 0.88, cy - s0 * 0.44],
        [cx, cy + s0 * 0.12],
        [cx, cy + s0 * 1.16],
        [cx + s0 * 0.88, cy + s0 * 0.6],
      ];
      const edges: [Pt, Pt][] = [
        [[x, y], [x + w, y]],
        [[x + w, y], [x + w, y + h]],
        [[x + w, y + h], [x, y + h]],
        [[x, y + h], [x, y]],
      ];
      const sf = p0 * 4;
      return (
        <G key={item.id}>
          <Rect x={x} y={y} width={w} height={h} rx={2.2} fill="#eef1e9" opacity={0.9 * Math.min(1, p0 * 3)} />
          {edges.map((e, i) => {
            const f = clamp01(sf - i);
            return f > 0 ? (
              <React.Fragment key={i}>{stroked(jitterSeg(rnd, e[0], e[1], 0.5), f, line)}</React.Fragment>
            ) : null;
          })}
          {p1 > 0 &&
            [top, left, right].map((poly, i) => {
              const f = clamp01(p1 * 3 - i);
              if (f <= 0) return null;
              return (
                <Path
                  key={`c${i}`}
                  d={toPath([...poly, poly[0]], f)}
                  fill={i === 0 ? "#d7e3d6" : i === 1 ? "#c3d4c4" : "#b0c5b3"}
                  fillOpacity={0.55 + 0.4 * f}
                  stroke={line}
                  strokeWidth={W * 0.85}
                  strokeLinejoin="round"
                />
              );
            })}
          {p2 > 0 && o.title && (
            <RevealText
              text={o.title}
              at={[cx, y + h * 0.63]}
              size="m"
              fill={PALETTE.ink}
              frac={p2}
              seed={seed + 1}
              align="center"
              fitW={w - 3}
            />
          )}
          {p3 > 0 && (
            <RevealText
              text="toca para abrir"
              at={[cx, y + h * 0.9]}
              size="s"
              fill={PALETTE.gray}
              frac={p3}
              seed={seed + 2}
              align="center"
              fitW={w - 4}
            />
          )}
        </G>
      );
    }

    case "underline":
    case "highlight": {
      const [x, y] = o.at as Pt;
      const w = o.w ?? 20;
      const isH = o.op === "highlight";
      const pts = jitterSeg(rnd, [x, y], [x + w, y], 1.2);
      const d = toPath(pts, p(0));
      if (!d) return null;
      return (
        <Path
          key={item.id}
          d={d}
          stroke={isH ? HILITE : color(o.color ?? "orange")}
          strokeWidth={isH ? 3.4 : 0.8}
          strokeLinecap="round"
          fill="none"
          opacity={isH ? 0.75 : 1}
        />
      );
    }

    case "hotspot": {
      const [x, y] = o.at as Pt;
      const selected = activeHotspot === item.id;
      const c = color(o.color ?? "orange");
      const label = String(o.label ?? "");
      const labelW = Math.min(52, label.length * CHAR_W.s);
      const labelX = x > 62 ? Math.max(2, x - 4 - labelW) : Math.min(98 - labelW, x + 4);
      return (
        <G key={item.id}>
          <Circle cx={x} cy={y} r={selected ? 4.1 : 3.2} fill={c} opacity={0.13} />
          <Circle cx={x} cy={y} r={2.2} fill="none" stroke={c} strokeWidth={selected ? 0.9 : 0.65} />
          <Circle cx={x} cy={y} r={0.85} fill={c} />
          <Circle cx={x} cy={y} r={5.5} fill="transparent" onPress={() => onHotspotPress?.(item.id)} />
          <RevealText text={label} at={[labelX, Math.max(5, y - 3.5)]} size="s" fill={c} frac={1} seed={seed + 1} fitW={labelW} />
        </G>
      );
    }

    case "dot": {
      const [x, y] = o.at;
      const r = 0.9 * p(0);
      return (
        <G key={item.id}>
          <Circle cx={x} cy={y} r={Math.max(r, 0.01)} fill={color(o.color)} />
          {o.label && p(1) > 0 && (
            <RevealText
              text={o.label}
              at={o.label_at ?? [x + 2.5, y - 2.5]}
              size="s"
              fill={color(o.color)}
              frac={p(1)}
              align={o.label_at ? "center" : "left"}
              seed={seed + 1}
            />
          )}
        </G>
      );
    }

    default:
      return null;
  }
}

export function Paper({ width, height }: { width: number; height: number }) {
  const step = 4.2;
  const cols = Math.ceil(LOGICAL_W / step);
  const rows = Math.ceil(LOGICAL_H / step);
  return (
    <G>
      <Rect x={0} y={0} width={LOGICAL_W} height={LOGICAL_H} fill={PAPER} />
      {Array.from({ length: cols }, (_, i) => (
        <Line
          key={`c${i}`}
          x1={i * step}
          y1={0}
          x2={i * step}
          y2={LOGICAL_H}
          stroke={GRID}
          strokeWidth={0.09}
        />
      ))}
      {Array.from({ length: rows }, (_, i) => (
        <Line
          key={`r${i}`}
          x1={0}
          y1={i * step}
          x2={LOGICAL_W}
          y2={i * step}
          stroke={GRID}
          strokeWidth={0.09}
        />
      ))}
    </G>
  );
}

export function PaperScreen({ width, height }: { width: number; height: number }) {
  const step = (width / LOGICAL_W) * 4.2;
  const cols = Math.ceil(width / step);
  const rows = Math.ceil(height / step);
  return (
    <Svg width={width} height={height}>
      <Rect x={0} y={0} width={width} height={height} fill={PAPER} />
      {Array.from({ length: cols }, (_, i) => (
        <Line key={`sc${i}`} x1={i * step} y1={0} x2={i * step} y2={height} stroke={GRID} strokeWidth={0.18} />
      ))}
      {Array.from({ length: rows }, (_, i) => (
        <Line key={`sr${i}`} x1={0} y1={i * step} x2={width} y2={i * step} stroke={GRID} strokeWidth={0.18} />
      ))}
    </Svg>
  );
}

export function Board({
  ops,
  fracOf,
  width,
  height,
  paper = true,
  onHotspotPress,
  activeHotspot,
}: {
  ops: Item[];
  fracOf: (item: Item) => number;
  width: number;
  height: number;
  paper?: boolean;
  onHotspotPress?: (id: string) => void;
  activeHotspot?: string | null;
}) {
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${LOGICAL_W} ${LOGICAL_H}`}>
      {paper && <Paper width={width} height={height} />}
      {ops.map((item) => (
        <OpBoundary key={item.id}>
          <G>{renderOp(item, fracOf(item), onHotspotPress, activeHotspot)}</G>
        </OpBoundary>
      ))}
    </Svg>
  );
}
