// 3D por primitivas: o modelo de linguagem descreve uma cena com formas
// simples (esfera, caixa, cilindro…) e animações declarativas; nunca devolve
// código. Esta é a fronteira de segurança: tudo o que não for conhecido é
// descartado ou limitado, e o resultado é sempre uma cena que o renderer
// consegue desenhar sem rebentar.
//
// Pura (sem React Native, sem three) para poder ser testada em Node.

export type ShapeKind =
  | "sphere"
  | "box"
  | "cylinder"
  | "cone"
  | "torus"
  | "ring"
  | "plane"
  | "arrow";

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
  pos: Vec3;
  // escala por eixo (esfera usa o raio no x)
  size: Vec3;
  // rotação em graus
  rot: Vec3;
  color: ShapeInk;
  opacity: number;
  wire: boolean;
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
  | "color";

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
};

export type ShapesSpec = {
  objects: ShapeObject[];
  anims: ShapeAnim[];
  camera: "iso" | "front" | "side" | "top";
  ground: boolean;
  caption?: string;
};

export const SHAPE_LIMITS = {
  objects: 16,
  anims: 24,
  coord: 6,
  sizeMin: 0.05,
  sizeMax: 4,
  pathPoints: 8,
  durationMax: 20000,
  speedMax: 3,
  label: 22,
  note: 120,
  caption: 90,
} as const;

const KINDS: readonly ShapeKind[] = [
  "sphere", "box", "cylinder", "cone", "torus", "ring", "plane", "arrow",
];
const INKS: readonly ShapeInk[] = [
  "ink", "blue", "red", "green", "orange", "purple", "gray", "yellow",
];
const ANIMS: readonly AnimKind[] = [
  "spin", "orbit", "bounce", "pulse", "move", "fade", "color",
];
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
  const list = Array.isArray(r.objects) ? r.objects : [];
  for (const item of list) {
    if (objects.length >= L.objects) break;
    if (!item || typeof item !== "object") continue;
    if (!KINDS.includes(item.shape)) continue;
    let id = cleanId(item.id) || `o${objects.length + 1}`;
    // ids repetidos ficam únicos em vez de se perderem
    while (seen.has(id)) id = `${id.slice(0, 20)}_${objects.length + 1}`;
    seen.add(id);
    objects.push({
      id,
      shape: item.shape,
      pos: vec(item.pos, [0, 0, 0], -L.coord, L.coord),
      size: sizeOf(item.size),
      rot: vec(item.rot, [0, 0, 0], -360, 360),
      color: ink(item.color, "blue"),
      opacity: clamp(num(item.opacity, 1), 0.1, 1),
      wire: item.wire === true,
      label: text(item.label, L.label),
      note: text(item.note, L.note),
    });
  }
  if (!objects.length) return null;

  const anims: ShapeAnim[] = [];
  const animList = Array.isArray(r.anims) ? r.anims : [];
  for (const a of animList) {
    if (anims.length >= L.anims) break;
    if (!a || typeof a !== "object") continue;
    if (!ANIMS.includes(a.type)) continue;
    const target = cleanId(a.target);
    if (!seen.has(target)) continue;

    const anim: ShapeAnim = {
      target,
      type: a.type,
      at_ms: clamp(num(a.at_ms, 0), 0, L.durationMax),
      duration_ms: clamp(num(a.duration_ms, 0), 0, L.durationMax),
      // spin/orbit/bounce/pulse são contínuos; move/fade/color acontecem uma
      // vez e ficam no estado final, a não ser que peça "vai e volta"
      loop: a.type === "move" || a.type === "fade" || a.type === "color"
        ? a.loop === true
        : true,
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
      anim.to_opacity = clamp(num(a.to_opacity, 0.1), 0.1, 1);
      if (anim.duration_ms < 300) anim.duration_ms = 1200;
    }

    if (a.type === "color") {
      anim.to_color = ink(a.to_color, "red");
      if (anim.duration_ms < 300) anim.duration_ms = 1200;
    }

    anims.push(anim);
  }

  return {
    objects,
    anims,
    camera: CAMERAS.includes(r.camera) ? r.camera : "iso",
    ground: r.ground === true,
    caption: text(r.caption, L.caption),
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
