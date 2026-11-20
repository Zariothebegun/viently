// 3D por primitivas: o modelo de linguagem descreve uma cena com formas
// simples (esfera, caixa, cilindro…) e animações declarativas; nunca devolve
// código. Esta é a fronteira de segurança: tudo o que não for conhecido é
// descartado ou limitado, e o resultado é sempre uma cena que o renderer
// consegue desenhar sem rebentar.
//
// Pura (sem React Native, sem three) para poder ser testada em Node.

import { compileExpr } from "./expr";

export type ShapeKind =
  | "sphere"
  | "box"
  | "cylinder"
  | "cone"
  | "torus"
  | "ring"
  | "plane"
  | "arrow"
  | "capsule"
  | "rbox"
  | "wheel"
  | "gear"
  | "stream"
  | "lathe"
  | "extrude"
  | "tube"
  | "surface"
  | "group";

// aspecto do material: matte (por defeito), metal, glass (translúcido) ou glow
// (emite luz: calor, chama, corrente)
export type ShapeFinish = "matte" | "metal" | "glass" | "glow";

export type ShapeInk =
  | "ink"
  | "blue"
  | "red"
  | "green"
  | "orange"
  | "purple"
  | "gray"
  | "yellow";

export type Vec3 = [number, number, number];

export type ShapeObject = {
  id: string;
  shape: ShapeKind;
  // posição relativa a este objecto (herda movimento, rotação e fade)
  parent?: string;
  pos: Vec3;
  // escala por eixo (esfera usa o raio no x)
  size: Vec3;
  // rotação em graus
  rot: Vec3;
  color: ShapeInk;
  opacity: number;
  wire: boolean;
  finish?: ShapeFinish;
  // stream: pontos do percurso, número de partículas e ciclos por segundo
  pts?: Vec3[];
  count?: number;
  speed?: number;
  // gear: número de dentes
  teeth?: number;
  // lathe: perfil [raio, altura] que gira em torno do eixo Y (garrafas, foguetes, vasos)
  profile?: [number, number][];
  // extrude: contorno [x, y] fechado, com espessura size[2] (asas, perfis, logótipos)
  outline?: [number, number][];
  // surface: altura y = expr(x, z, t) numa grelha (gráficos, ondas, terreno)
  expr?: string;
  extent?: number;
  grid?: number;
  label?: string;
  // frase curta mostrada ao tocar no objecto no painel grande
  note?: string;
};

export type AnimKind =
  | "spin"
  | "orbit"
  | "bounce"
  | "pulse"
  | "move"
  | "fade"
  | "color"
  | "rotate"
  | "scale"
  | "swing"
  | "wave"
  | "follow"
  | "keys"
  | "expr"
  | "camera";

export type Ease = "linear" | "in" | "out" | "inout" | "elastic" | "back" | "bounce" | "spring";

export type Keyframe = {
  // milissegundos desde o início desta animação
  t: number;
  pos?: Vec3;
  rot?: Vec3;
  scale?: Vec3;
  opacity?: number;
  color?: ShapeInk;
};

export type ShapeAnim = {
  target: string;
  type: AnimKind;
  at_ms: number;
  // 0 = sem fim (spin, orbit, bounce, pulse); move/fade/color usam o valor
  duration_ms: number;
  loop: boolean;
  // spin / orbit / bounce
  axis: "x" | "y" | "z";
  // voltas por segundo (spin/orbit) ou ciclos por segundo (bounce/pulse)
  speed: number;
  // bounce: amplitude; pulse: variação relativa da escala
  amp: number;
  // orbit: centro como id de outro objecto ou ponto fixo
  around?: string;
  center?: Vec3;
  // move: caminho (inclui o ponto de partida implícito)
  path?: Vec3[];
  // fade
  to_opacity?: number;
  // color
  to_color?: ShapeInk;
  // suavização do movimento (move/fade/color/rotate/scale/follow/keys/camera)
  ease?: Ease;
  // rotate: rotação final em graus; scale: escala final
  to_rot?: Vec3;
  to_scale?: Vec3;
  // swing: amplitude em graus; wave/swing: fase em voltas (0 a 1)
  deg?: number;
  phase?: number;
  // follow: a peça vira-se para onde vai
  orient?: "x" | "y" | "z";
  // keys: coreografia por fotogramas-chave
  frames?: Keyframe[];
  // expr: deslocamento/rotação(graus)/escala/opacidade como função de t (s) e u (0-1)
  fx?: { pos?: (string | null)[]; rot?: (string | null)[]; scale?: (string | null)[]; opacity?: string | null };
  // camera: azimute/elevação em graus, zoom, e o que olhar (id ou ponto)
  az?: number;
  el?: number;
  zoom?: number;
  look?: string | Vec3;
};

export type ShapesSpec = {
  objects: ShapeObject[];
  anims: ShapeAnim[];
  camera: "iso" | "front" | "side" | "top";
  // vista inicial personalizada [azimute, elevação] em graus (substitui a predefinida)
  view?: [number, number];
  // a câmara dá uma volta lenta à cena (só no painel grande)
  turntable?: boolean;
  ground: boolean;
  caption?: string;
  // frases que acompanham a animação: a última com at_ms <= tempo fica visível
  captions: { at_ms: number; text: string }[];
};

export const SHAPE_LIMITS = {
  objects: 64,
  anims: 64,
  captions: 8,
  coord: 6,
  sizeMin: 0.05,
  sizeMax: 4,
  lenMax: 20,
  streamCount: 14,
  pathPoints: 16,
  profilePts: 24,
  outlinePts: 40,
  frames: 16,
  cams: 8,
  durationMax: 20000,
  speedMax: 3,
  label: 22,
  note: 120,
  caption: 90,
} as const;

const KINDS: readonly ShapeKind[] = [
  "sphere", "box", "cylinder", "cone", "torus", "ring", "plane", "arrow",
  "capsule", "rbox", "wheel", "gear", "stream", "lathe", "extrude", "tube", "surface", "group",
];
const FINISHES: readonly ShapeFinish[] = ["matte", "metal", "glass", "glow"];
// formas que se podem definir por dois pontos (from → to), sem rotações
const LINEAR: readonly ShapeKind[] = ["arrow", "cylinder", "capsule", "rbox", "box"];
const INKS: readonly ShapeInk[] = [
  "ink", "blue", "red", "green", "orange", "purple", "gray", "yellow",
];
const ANIMS: readonly AnimKind[] = [
  "spin", "orbit", "bounce", "pulse", "move", "fade", "color",
  "rotate", "scale", "swing", "wave", "follow", "keys", "expr", "camera",
];
const EASES: readonly Ease[] = ["linear", "in", "out", "inout", "elastic", "back", "bounce", "spring"];
// animações que acontecem uma vez e ficam no estado final (as outras são contínuas)
const ONESHOT: readonly AnimKind[] = ["move", "fade", "color", "rotate", "scale", "follow", "keys"];
const CAMERAS = ["iso", "front", "side", "top"] as const;

function num(v: unknown, d: number): number {
  const n = typeof v === "string" && v.trim() === "" ? NaN : Number(v);
  return Number.isFinite(n) ? n : d;
}

function clamp(v: number, a: number, b: number): number {
  return v < a ? a : v > b ? b : v;
}

function vec(v: unknown, d: Vec3, lo: number, hi: number): Vec3 {
  if (!Array.isArray(v)) return [...d] as Vec3;
  return [
    clamp(num(v[0], d[0]), lo, hi),
    clamp(num(v[1], d[1]), lo, hi),
    clamp(num(v[2], d[2]), lo, hi),
  ];
}

function ink(v: unknown, d: ShapeInk): ShapeInk {
  return INKS.includes(v as ShapeInk) ? (v as ShapeInk) : d;
}

function text(v: unknown, max: number): string | undefined {
  if (typeof v !== "string" && typeof v !== "number") return undefined;
  const s = String(v).replace(/\s+/g, " ").trim().slice(0, max);
  return s.length ? s : undefined;
}

function cleanId(v: unknown): string {
  return String(v ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24);
}

function sizeOf(v: unknown): Vec3 {
  const { sizeMin: lo, sizeMax: hi } = SHAPE_LIMITS;
  if (Array.isArray(v)) {
    return [
      clamp(num(v[0], 1), lo, hi),
      clamp(num(v[1], num(v[0], 1)), lo, hi),
      clamp(num(v[2], num(v[0], 1)), lo, hi),
    ];
  }
  const s = clamp(num(v, 1), lo, hi);
  return [s, s, s];
}

// Rotação (graus, ordem XYZ do three.js) que leva o eixo +Y para a direcção
// a→b. O modelo de linguagem erra contas de rotação; erra muito menos pontos.
function aim(a: Vec3, b: Vec3): { pos: Vec3; rot: Vec3; len: number } | null {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
  const len = Math.hypot(dx, dy, dz);
  if (len < 0.05) return null;
  const ux = dx / len, uy = dy / len, uz = dz / len;
  let qx = 1, qy = 0, qz = 0, qw = 0; // 180° em torno de X quando aponta para baixo
  if (uy > -0.9999) {
    qx = uz; qz = -ux; qw = 1 + uy;
    const n = Math.hypot(qx, qz, qw);
    qx /= n; qz /= n; qw /= n;
  }
  const m11 = 1 - 2 * (qy * qy + qz * qz);
  const m12 = 2 * (qx * qy - qz * qw);
  const m13 = 2 * (qx * qz + qy * qw);
  const m22 = 1 - 2 * (qx * qx + qz * qz);
  const m23 = 2 * (qy * qz - qx * qw);
  const m32 = 2 * (qy * qz + qx * qw);
  const m33 = 1 - 2 * (qx * qx + qy * qy);
  const ey = Math.asin(clamp(m13, -1, 1));
  let ex: number, ez: number;
  if (Math.abs(m13) < 0.9999999) {
    ex = Math.atan2(-m23, m33);
    ez = Math.atan2(-m12, m11);
  } else {
    ex = Math.atan2(m32, m22);
    ez = 0;
  }
  const deg = 180 / Math.PI;
  return {
    pos: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2],
    rot: [ex * deg, ey * deg, ez * deg],
    len,
  };
}


/*
  Operadores de layout, aplicados ANTES da validação: o modelo descreve o padrão
  (repetir, grelha, anel, hélice, "em cima de") e o código calcula as posições.
  Sai uma lista de objectos simples, sem repeat/on, por isso é idempotente.
*/
type Raw = Record<string, any>;
const rotAbout = (p: Vec3, c: Vec3, axis: "x" | "y" | "z", deg: number): Vec3 => {
  const a = (deg * Math.PI) / 180, co = Math.cos(a), si = Math.sin(a);
  const d = [p[0] - c[0], p[1] - c[1], p[2] - c[2]];
  let [x, y, z] = d;
  if (axis === "y") { x = d[0] * co + d[2] * si; z = -d[0] * si + d[2] * co; }
  else if (axis === "x") { y = d[1] * co - d[2] * si; z = d[1] * si + d[2] * co; }
  else { x = d[0] * co - d[1] * si; y = d[0] * si + d[1] * co; }
  return [c[0] + x, c[1] + y, c[2] + z];
};
const v3 = (v: unknown, d: Vec3): Vec3 =>
  Array.isArray(v) ? [num(v[0], d[0]), num(v[1], d[1]), num(v[2], d[2])] : [...d] as Vec3;
const SIDE: Record<string, [number, number]> = {
  top: [1, 1], bottom: [1, -1], right: [0, 1], left: [0, -1], front: [2, 1], back: [2, -1],
};

function expandLayout(rawObjects: unknown[], rawAnims: unknown[]): { objects: Raw[]; anims: Raw[] } {
  const out: Raw[] = [];
  const extra: Raw[] = [];
  const at = new Map<string, { pos: Vec3; half: Vec3 }>();
  const cap = SHAPE_LIMITS.objects;
  for (const raw of rawObjects) {
    if (!raw || typeof raw !== "object") continue;
    const base: Raw = { ...(raw as Raw) };
    const id = cleanId(base.id);
    const rep = base.repeat && typeof base.repeat === "object" ? (base.repeat as Raw) : null;
    delete base.repeat;
    // posicionamento relativo a outra peça
    if (base.on && typeof base.on === "object" || typeof base.on === "string") {
      const spec: Raw = typeof base.on === "string" ? { id: base.on, at: base.at } : base.on;
      const tg = at.get(cleanId(spec.id));
      const side = SIDE[String(spec.at ?? "top")] ?? SIDE.top;
      if (tg) {
        const s = sizeOf(base.size);
        const own: Vec3 = [s[0] / 2, s[1] / 2, s[2] / 2];
        const off = v3(base.pos, [0, 0, 0]);
        const p: Vec3 = [tg.pos[0] + off[0], tg.pos[1] + off[1], tg.pos[2] + off[2]];
        p[side[0]] = tg.pos[side[0]] + side[1] * (tg.half[side[0]] + own[side[0]] + num(spec.gap, 0));
        base.pos = p;
      }
      delete base.on; delete base.at;
    }
    const s0 = sizeOf(base.size);
    const pos0 = v3(base.pos, [0, 0, 0]);
    const note = (o: Raw, pos: Vec3) => {
      if (o.id) at.set(cleanId(o.id), { pos, half: [s0[0] / 2, s0[1] / 2, s0[2] / 2] });
    };
    if (!rep) { out.push(base); note(base, pos0); continue; }

    const n = Math.round(clamp(num(rep.n, 2), 1, 24));
    const step = v3(rep.step, [0, 0, 0]);
    const rowStep = v3(rep.row_step, [0, 0, step[0] || 1]);
    const cols = Math.max(0, Math.round(num(rep.cols, 0)));
    const axisRaw = rep.around;
    const axis: "x" | "y" | "z" | null = axisRaw === "x" || axisRaw === "y" || axisRaw === "z" ? axisRaw : null;
    const centre = v3(rep.center, [0, 0, 0]);
    const ang = num(rep.angle, axis ? 360 / n : 0);
    const rot0 = v3(base.rot, [0, 0, 0]);
    note(base, pos0);
    for (let i = 0; i < n && out.length < cap; i++) {
      const o: Raw = { ...base };
      let sv: Vec3;
      if (cols > 0) {
        const c = i % cols, r = Math.floor(i / cols);
        sv = [step[0] * c + rowStep[0] * r, step[1] * c + rowStep[1] * r, step[2] * c + rowStep[2] * r];
      } else sv = [step[0] * i, step[1] * i, step[2] * i];
      // a mesma transformação vale para pos, from/to e caminhos
      const tf = (q: Vec3): Vec3 => {
        let r: Vec3 = [q[0] + sv[0], q[1] + sv[1], q[2] + sv[2]];
        if (axis) r = rotAbout(r, centre, axis, ang * i);
        return r;
      };
      const p = tf(pos0);
      if (axis) {
        const r2: Vec3 = [...rot0] as Vec3;
        r2[axis === "x" ? 0 : axis === "y" ? 1 : 2] += rep.face === false ? 0 : ang * i;
        o.rot = r2;
      }
      o.pos = p;
      for (const k of ["from", "to"]) if (Array.isArray(base[k])) o[k] = tf(v3(base[k], [0, 0, 0]));
      for (const k of ["pts", "path"]) if (Array.isArray(base[k])) o[k] = base[k].map((q: unknown) => tf(v3(q, [0, 0, 0])));
      if (i > 0) {
        o.id = `${id || "r"}_${i + 1}`.slice(0, 24);
        o.label = undefined;
        o.note = undefined;
        extra.push({ id: o.id, __of: id, __d: [p[0] - pos0[0], p[1] - pos0[1], p[2] - pos0[2]] });
      }
      out.push(o);
    }
  }
  // as animações valem também para as cópias (um "move" desloca-se com a cópia)
  const anims: Raw[] = [];
  for (const a of rawAnims) {
    if (!a || typeof a !== "object") continue;
    anims.push(a as Raw);
    const tgt = cleanId((a as Raw).target);
    for (const e of extra) {
      if (e.__of !== tgt) continue;
      const c: Raw = { ...(a as Raw), target: e.id };
      if (Array.isArray(c.path)) c.path = c.path.map((q: unknown) => { const w = v3(q, [0, 0, 0]); return [w[0] + e.__d[0], w[1] + e.__d[1], w[2] + e.__d[2]]; });
      anims.push(c);
    }
  }
  for (const o of out) { delete o.__of; delete o.__i; delete o.__d; }
  return { objects: out, anims };
}

/*
  Devolve uma cena válida ou null. Null significa "não há nada que valha a
  pena desenhar" e o chamador deve cair para o diagrama 2D.
*/
export function sanitizeShapes(raw: unknown): ShapesSpec | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, any>;
  const L = SHAPE_LIMITS;

  const objects: ShapeObject[] = [];
  const seen = new Set<string>();
  const copies: Record<string, { id: string; sx: number; sz: number }[]> = {};
  const uniqueId = (base: string) => {
    let id = base;
    while (seen.has(id)) id = `${base.slice(0, 20)}_${objects.length + 1}`;
    seen.add(id);
    return id;
  };
  const expanded = expandLayout(Array.isArray(r.objects) ? r.objects : [], Array.isArray(r.anims) ? r.anims : []);
  const list = expanded.objects;
  const L2 = SHAPE_LIMITS;
  const pt = (v: unknown, fx: number, fz: number): Vec3 | null => {
    if (!Array.isArray(v) || v.length < 2) return null;
    const p = vec(v, [0, 0, 0], -L2.coord, L2.coord);
    return [p[0] * fx, p[1], p[2] * fz];
  };

  // constrói um objecto; fx/fz espelham as coordenadas (simetria)
  const build = (item: any, id: string, parent: string | undefined, fx: number, fz: number): ShapeObject | null => {
    const shape: ShapeKind = item.shape;
    const finish: ShapeFinish = FINISHES.includes(item.finish) ? item.finish : "matte";
    let opacity = clamp(num(item.opacity, 1), 0, 1);
    if (finish === "glass") opacity = Math.min(opacity, 0.4);
    const obj: ShapeObject = {
      id,
      shape,
      parent,
      pos: vec(item.pos, [0, 0, 0], -L2.coord, L2.coord),
      size: sizeOf(item.size),
      rot: vec(item.rot, [0, 0, 0], -360, 360),
      color: ink(item.color, shape === "wheel" ? "ink" : "blue"),
      opacity,
      wire: item.wire === true,
      finish,
      label: text(item.label, L2.label),
      note: text(item.note, L2.note),
    };
    // tubos, vigas e setas podem ser compridos (a validação corre duas vezes)
    if (LINEAR.includes(shape) && Array.isArray(item.size)) {
      obj.size[1] = clamp(num(item.size[1], 1), L2.sizeMin, L2.lenMax);
    }
    obj.pos = [obj.pos[0] * fx, obj.pos[1], obj.pos[2] * fz];
    if (fx !== 1 || fz !== 1) {
      obj.rot = [fz < 0 ? -obj.rot[0] : obj.rot[0], obj.rot[1] * fx * fz, fx < 0 ? -obj.rot[2] : obj.rot[2]];
    }

    if (shape === "stream") {
      // aceita o formato de entrada (path ou from/to) e o já validado (pts)
      const pts = (Array.isArray(item.pts) ? item.pts : Array.isArray(item.path) ? item.path : [item.from, item.to])
        .slice(0, L2.pathPoints)
        .map((p: unknown) => pt(p, fx, fz))
        .filter((p: Vec3 | null): p is Vec3 => !!p);
      if (pts.length < 2) return null;
      obj.pts = pts;
      obj.count = Math.round(clamp(num(item.count, 6), 2, L2.streamCount));
      obj.speed = clamp(num(item.speed, 0.6), 0.1, L2.speedMax);
      const d = clamp(num(Array.isArray(item.size) ? item.size[0] : item.size, 0.18), 0.05, 1);
      obj.size = [d, d, d];
      obj.pos = [0, 0, 0];
      obj.rot = [0, 0, 0];
      return obj;
    }

    const pairs = (v: unknown, max: number, lim: [number, number], lim2: [number, number]): [number, number][] =>
      (Array.isArray(v) ? v : [])
        .slice(0, max)
        .filter((q: unknown) => Array.isArray(q))
        .map((q: any): [number, number] => [clamp(num(q[0], 0), lim[0], lim[1]), clamp(num(q[1], 0), lim2[0], lim2[1])]);
    if (shape === "lathe") {
      // raio limitado a metade do tamanho máximo: um perfil com raio 6
      // (diâmetro 12) ao lado de peças de 2 esmagava a cena toda
      const prof = pairs(item.profile, L2.profilePts, [0, L2.sizeMax / 2], [-L2.sizeMax, L2.sizeMax]);
      if (prof.length < 2) return null;
      obj.profile = prof;
    }
    if (shape === "extrude") {
      const out = pairs(item.outline, L2.outlinePts, [-L2.coord, L2.coord], [-L2.coord, L2.coord]);
      if (out.length < 3) return null;
      obj.outline = fx < 0 ? out.map((q): [number, number] => [-q[0], q[1]]).reverse() : out;
    }
    if (shape === "tube") {
      const tp = (Array.isArray(item.pts) ? item.pts : Array.isArray(item.path) ? item.path : [item.from, item.to])
        .slice(0, L2.pathPoints)
        .map((q: unknown) => pt(q, fx, fz))
        .filter((q: Vec3 | null): q is Vec3 => !!q);
      if (tp.length < 2) return null;
      obj.pts = tp;
      const d = clamp(num(Array.isArray(item.size) ? item.size[0] : item.size, 0.12), 0.03, 1);
      obj.size = [d, d, d];
      obj.pos = [0, 0, 0];
      obj.rot = [0, 0, 0];
      return obj;
    }
    if (shape === "surface") {
      if (!compileExpr(item.expr, ["x", "z", "t"])) return null;
      obj.expr = String(item.expr).trim();
      obj.extent = clamp(num(item.extent, 3), 0.5, L2.coord);
      obj.grid = Math.round(clamp(num(item.grid, 26), 8, 40));
      obj.size = [1, 1, 1];
    }

    const from = pt(item.from, fx, fz);
    const to = pt(item.to, fx, fz);
    if (from && to && LINEAR.includes(shape)) {
      const a = aim(from, to);
      if (!a) return null;
      const thick = clamp(num(Array.isArray(item.size) ? item.size[0] : item.size, shape === "arrow" ? 0.5 : 0.2), L2.sizeMin, L2.sizeMax);
      obj.pos = a.pos;
      obj.rot = a.rot;
      obj.size = [thick, clamp(a.len, L2.sizeMin, L2.lenMax), thick];
    }

    if (shape === "wheel" || shape === "gear") {
      // diâmetro, largura e diâmetro; o eixo da roda/engrenagem é o Z
      const d = obj.size[0];
      const w = Array.isArray(item.size) ? obj.size[1] : clamp(d * 0.35, L2.sizeMin, L2.sizeMax);
      obj.size = [d, w, d];
      if (shape === "gear") obj.teeth = Math.round(clamp(num(item.teeth, 12), 6, 24));
    }
    return obj;
  };

  for (const item of list) {
    if (objects.length >= L.objects) break;
    if (!item || typeof item !== "object") continue;
    if (!KINDS.includes(item.shape)) continue;
    const id = uniqueId(cleanId(item.id) || `o${objects.length + 1}`);
    const parentId = cleanId(item.parent);
    // o pai tem de existir antes: impede ciclos
    const parent = parentId && parentId !== id && seen.has(parentId) ? parentId : undefined;
    const obj = build(item, id, parent, 1, 1);
    if (!obj) { seen.delete(id); continue; }
    objects.push(obj);

    // simetria: "x", "z" ou "xz" cria cópias espelhadas (rodas, asas, patas)
    const m = item.mirror;
    if (m === "x" || m === "z" || m === "xz") {
      const flips: [string, number, number][] =
        m === "x" ? [["x", -1, 1]] : m === "z" ? [["z", 1, -1]] : [["x", -1, 1], ["z", 1, -1], ["xz", -1, -1]];
      copies[id] = [];
      for (const [suffix, sx, sz] of flips) {
        if (objects.length >= L.objects) break;
        const cid = uniqueId(`${id.slice(0, 20)}_${suffix}`);
        const c = build(item, cid, parent, sx, sz);
        if (!c) { seen.delete(cid); continue; }
        c.label = undefined;
        objects.push(c);
        copies[id].push({ id: cid, sx, sz });
      }
    }
  }
  if (!objects.length) return null;

  const anims: ShapeAnim[] = [];
  const animList = expanded.anims;
  for (const a of animList) {
    if (anims.length >= L.anims) break;
    if (!a || typeof a !== "object") continue;
    if (!ANIMS.includes(a.type)) continue;
    const ease: Ease | undefined = EASES.includes(a.ease) ? a.ease : undefined;
    if (a.type === "camera") {
      if (anims.filter((q) => q.type === "camera").length >= L.cams) continue;
      const cam: ShapeAnim = {
        target: "@camera", type: "camera",
        at_ms: clamp(num(a.at_ms, 0), 0, L.durationMax),
        duration_ms: clamp(num(a.duration_ms, 1800), 200, L.durationMax),
        loop: false, axis: "y", speed: 0, amp: 0, ease,
      };
      if (a.az !== undefined && Number.isFinite(Number(a.az))) cam.az = clamp(num(a.az, 0), -720, 720);
      if (a.el !== undefined && Number.isFinite(Number(a.el))) cam.el = clamp(num(a.el, 20), -85, 89);
      if (a.zoom !== undefined && Number.isFinite(Number(a.zoom))) cam.zoom = clamp(num(a.zoom, 1), 0.4, 3);
      if (typeof a.look === "string" && seen.has(cleanId(a.look))) cam.look = cleanId(a.look);
      else if (Array.isArray(a.look)) cam.look = vec(a.look, [0, 0, 0], -L.coord, L.coord);
      anims.push(cam);
      continue;
    }
    const target = cleanId(a.target);
    if (!seen.has(target)) continue;

    const anim: ShapeAnim = {
      target,
      type: a.type,
      at_ms: clamp(num(a.at_ms, 0), 0, L.durationMax),
      duration_ms: clamp(num(a.duration_ms, 0), 0, L.durationMax),
      // spin/orbit/bounce/pulse são contínuos; move/fade/color acontecem uma
      // vez e ficam no estado final, a não ser que peça "vai e volta"
      loop: ONESHOT.includes(a.type) ? a.loop === true : true,
      ease,
      axis: a.axis === "x" || a.axis === "z" ? a.axis : "y",
      speed: clamp(num(a.speed, 0.5), -L.speedMax, L.speedMax),
      amp: clamp(num(a.amp, a.type === "pulse" ? 0.2 : 0.5), 0, 3),
    };

    if (a.type === "orbit") {
      const around = cleanId(a.around);
      if (around && around !== target && seen.has(around)) {
        anim.around = around;
      } else if (Array.isArray(a.center)) {
        anim.center = vec(a.center, [0, 0, 0], -L.coord, L.coord);
      } else {
        anim.center = [0, 0, 0];
      }
    }

    if (a.type === "move") {
      const path = (Array.isArray(a.path) ? a.path : [])
        .slice(0, L.pathPoints)
        .filter((p: unknown) => Array.isArray(p))
        .map((p: unknown) => vec(p, [0, 0, 0], -L.coord, L.coord));
      if (!path.length) continue;
      anim.path = path;
      // um deslocamento precisa de duração; senão ficaria parado
      if (anim.duration_ms < 300) anim.duration_ms = 2000;
    }

    if (a.type === "fade") {
      anim.to_opacity = clamp(num(a.to_opacity, 0.1), 0, 1);
      if (anim.duration_ms < 300) anim.duration_ms = 1200;
    }

    if (a.type === "color") {
      anim.to_color = ink(a.to_color, "red");
      if (anim.duration_ms < 300) anim.duration_ms = 1200;
    }

    if (a.type === "rotate") {
      if (!Array.isArray(a.to_rot)) continue;
      anim.to_rot = vec(a.to_rot, [0, 0, 0], -720, 720);
      if (anim.duration_ms < 300) anim.duration_ms = 1500;
    }

    if (a.type === "scale") {
      const s = Array.isArray(a.to_scale) ? vec(a.to_scale, [1, 1, 1], 0.05, 4) : (() => { const k = clamp(num(a.to_scale, 1), 0.05, 4); return [k, k, k] as Vec3; })();
      anim.to_scale = s;
      if (anim.duration_ms < 300) anim.duration_ms = 1500;
    }

    if (a.type === "swing" || a.type === "wave") {
      anim.deg = clamp(num(a.deg, 25), 0, 180);
      anim.phase = clamp(num(a.phase, 0), 0, 1);
    }

    if (a.type === "follow") {
      const path = (Array.isArray(a.path) ? a.path : [])
        .slice(0, L.pathPoints)
        .filter((q: unknown) => Array.isArray(q))
        .map((q: unknown) => vec(q, [0, 0, 0], -L.coord, L.coord));
      if (!path.length) continue;
      anim.path = path;
      anim.orient = a.orient === "y" || a.orient === "z" ? a.orient : a.orient === true || a.orient === "x" ? "x" : undefined;
      if (anim.duration_ms < 300) anim.duration_ms = 3000;
    }

    if (a.type === "keys") {
      const fr: Keyframe[] = [];
      for (const f of (Array.isArray(a.frames) ? a.frames : []).slice(0, L.frames)) {
        if (!f || typeof f !== "object") continue;
        const k: Keyframe = { t: clamp(num(f.t, 0), 0, L.durationMax) };
        if (Array.isArray(f.pos)) k.pos = vec(f.pos, [0, 0, 0], -L.coord, L.coord);
        if (Array.isArray(f.rot)) k.rot = vec(f.rot, [0, 0, 0], -720, 720);
        if (Array.isArray(f.scale)) k.scale = vec(f.scale, [1, 1, 1], 0.05, 4);
        else if (f.scale !== undefined) { const s = clamp(num(f.scale, 1), 0.05, 4); k.scale = [s, s, s]; }
        if (f.opacity !== undefined) k.opacity = clamp(num(f.opacity, 1), 0, 1);
        if (f.color !== undefined) k.color = ink(f.color, "blue");
        if (k.pos || k.rot || k.scale || k.opacity !== undefined || k.color) fr.push(k);
      }
      if (fr.length < 2) continue;
      fr.sort((p, q) => p.t - q.t);
      anim.frames = fr;
      anim.duration_ms = Math.max(300, fr[fr.length - 1].t);
    }

    if (a.type === "expr") {
      const src = (a.fx && typeof a.fx === "object" ? a.fx : a) as Record<string, any>;
      const ok = (e: unknown) => (compileExpr(e, ["t", "u"]) && typeof e === "string" ? e.trim() : null);
      const three = (v: unknown) => (Array.isArray(v) ? [ok(v[0]), ok(v[1]), ok(v[2])] : undefined);
      const fxo: NonNullable<ShapeAnim["fx"]> = {};
      const pos = three(src.pos), rot = three(src.rot);
      if (pos && pos.some(Boolean)) fxo.pos = pos;
      if (rot && rot.some(Boolean)) fxo.rot = rot;
      const sc = Array.isArray(src.scale) ? three(src.scale) : src.scale !== undefined ? (() => { const e = ok(src.scale); return e ? [e, e, e] : undefined; })() : undefined;
      if (sc && sc.some(Boolean)) fxo.scale = sc;
      const op = ok(src.opacity);
      if (op) fxo.opacity = op;
      if (!fxo.pos && !fxo.rot && !fxo.scale && !fxo.opacity) continue;
      anim.fx = fxo;
    }

    anims.push(anim);
    // as cópias espelhadas fazem o mesmo movimento (caminho espelhado)
    for (const c of copies[target] ?? []) {
      if (anims.length >= L.anims) break;
      const copy: ShapeAnim = { ...anim, target: c.id };
      if (anim.path) copy.path = anim.path.map((p): Vec3 => [p[0] * c.sx, p[1], p[2] * c.sz]);
      if (anim.frames) copy.frames = anim.frames.map((f) => (f.pos ? { ...f, pos: [f.pos[0] * c.sx, f.pos[1], f.pos[2] * c.sz] as Vec3 } : f));
      anims.push(copy);
    }
  }

  const captions = (Array.isArray(r.captions) ? r.captions : [])
    .map((c: any) => ({ at_ms: clamp(num(c?.at_ms, 0), 0, L.durationMax), text: text(c?.text, L.caption) }))
    .filter((c: { text?: string }) => !!c.text)
    .slice(0, L.captions)
    .sort((a: any, b: any) => a.at_ms - b.at_ms) as { at_ms: number; text: string }[];
  const caption = text(r.caption, L.caption);
  if (!captions.length && caption) captions.push({ at_ms: 0, text: caption });

  return {
    objects,
    anims,
    camera: CAMERAS.includes(r.camera) ? r.camera : "iso",
    view: Array.isArray(r.view) && r.view.length >= 2
      ? [clamp(num(r.view[0], 0), -720, 720), clamp(num(r.view[1], 20), -85, 89)]
      : undefined,
    turntable: r.turntable === true ? true : undefined,
    ground: r.ground === true,
    caption,
    captions,
  };
}

// Cena para JSON dentro de um <script>: impede que o texto das etiquetas feche
// a tag ou parta a linha.
export function safeJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

/*
  Revisão automática: o que falta a uma cena válida para ensinar bem. Devolve
  frases curtas que servem de pedido de correcção ao modelo; vazio = boa.
*/
export function lintShapes(spec: ShapesSpec): string[] {
  const issues: string[] = [];
  const solid = spec.objects.filter((o) => o.shape !== "group");
  if (solid.length < 8) issues.push(`só tem ${solid.length} peças: decompõe o tema em 14 a 30 peças reais`);
  if (spec.objects.filter((o) => o.label).length < 3) issues.push("faltam rótulos (label+note) nas peças que a explicação usa");
  if (spec.captions.length < 3) issues.push("faltam 3 a 6 captions sincronizadas com at_ms");
  if (!spec.anims.some((a) => a.type !== "camera"))
    issues.push("falta animação que mostre a causa e o efeito");
  const near = (a: ShapeObject, b: ShapeObject) => Math.hypot(a.pos[0] - b.pos[0], a.pos[1] - b.pos[1], a.pos[2] - b.pos[2]);
  const stray = solid.filter((o) => !o.parent && solid.every((q) => q === o || near(o, q) > 6));
  if (stray.length >= 2) issues.push("há peças soltas, longe de tudo o resto: aproxima-as do conjunto");
  // Escala: uma peça gigante esmaga tudo o resto (a câmara afasta-se para a
  // enquadrar e as outras ficam pontos). Mede-se o tamanho visível de cada
  // peça — perfis e contornos incluídos — e compara-se com a mediana.
  const extent = (o: ShapeObject): number => {
    if (o.shape === "lathe" && o.profile?.length) {
      const r = Math.max(...o.profile.map((q) => Math.abs(q[0])));
      const h = Math.max(...o.profile.map((q) => Math.abs(q[1])));
      return Math.max(2 * r, 2 * h);
    }
    if (o.shape === "extrude" && o.outline?.length) {
      const x = Math.max(...o.outline.map((q) => Math.abs(q[0])));
      const y = Math.max(...o.outline.map((q) => Math.abs(q[1])));
      return Math.max(2 * x, 2 * y, Math.abs(o.size[2] ?? 0.2));
    }
    return Math.max(...o.size.map((v) => Math.abs(v)));
  };
  const sizes = solid.map(extent).sort((x, y) => x - y);
  const median = sizes[Math.floor(sizes.length / 2)] || 1;
  const giant = solid.filter((o) => extent(o) > 14 || extent(o) > Math.max(6, median * 8));
  if (giant.length) {
    const pior = Math.max(...giant.map(extent)).toFixed(0);
    issues.push(`peças fora de escala (até ${pior} unidades): usa uma escala única, o objecto principal com 3 a 8 unidades`);
  }
  return issues;
}
