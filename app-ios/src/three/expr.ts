// Expressões matemáticas seguras para animações e superfícies: o modelo escreve
// "2*cos(t)" ou "sin(x*2)*exp(-z*z)" e nunca código. Sem eval nem Function
// (o Hermes não os tem, e seria uma porta aberta): é um analisador próprio,
// com funções e variáveis em lista fechada, tamanho e profundidade limitados.
//
// O mesmo algoritmo existe em JS puro em EXPR_RUNTIME (corre dentro da página
// do WebView); os testes garantem que os dois dão os mesmos números.

export type Vars = Record<string, number>;
export type ExprFn = (v: Vars) => number;

export const EXPR_MAX_LEN = 120;
const MAX_NODES = 80;
const MAX_DEPTH = 14;
export const EXPR_OUT = 1000;

const CONSTS: Record<string, number> = { pi: Math.PI, tau: Math.PI * 2, e: Math.E };
const hash = (x: number) => {
  const s = Math.sin(x * 12.9898) * 43758.5453;
  return s - Math.floor(s);
};
const FUNCS: Record<string, { n: number; f: (...a: number[]) => number }> = {
  sin: { n: 1, f: Math.sin },
  cos: { n: 1, f: Math.cos },
  tan: { n: 1, f: Math.tan },
  asin: { n: 1, f: Math.asin },
  acos: { n: 1, f: Math.acos },
  atan: { n: 1, f: Math.atan },
  atan2: { n: 2, f: Math.atan2 },
  abs: { n: 1, f: Math.abs },
  sqrt: { n: 1, f: (a) => Math.sqrt(Math.max(0, a)) },
  exp: { n: 1, f: (a) => Math.exp(Math.min(a, 20)) },
  log: { n: 1, f: (a) => Math.log(Math.max(1e-9, a)) },
  floor: { n: 1, f: Math.floor },
  fract: { n: 1, f: (a) => a - Math.floor(a) },
  sign: { n: 1, f: Math.sign },
  min: { n: 2, f: Math.min },
  max: { n: 2, f: Math.max },
  pow: { n: 2, f: (a, b) => Math.pow(a, Math.min(Math.max(b, -8), 8)) },
  mod: { n: 2, f: (a, b) => (b === 0 ? 0 : a - b * Math.floor(a / b)) },
  mix: { n: 3, f: (a, b, k) => a + (b - a) * k },
  clamp: { n: 3, f: (x, a, b) => Math.min(Math.max(x, a), b) },
  step: { n: 2, f: (a, x) => (x < a ? 0 : 1) },
  smooth: {
    n: 3,
    f: (a, b, x) => {
      const u = Math.min(Math.max((x - a) / (b - a || 1), 0), 1);
      return u * u * (3 - 2 * u);
    },
  },
  rnd: { n: 1, f: hash },
};

type Tok = { k: "num" | "id" | "op"; v: string | number };

function tokenize(src: string): Tok[] | null {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === " " || c === "\t") { i++; continue; }
    if ((c >= "0" && c <= "9") || c === ".") {
      let j = i;
      while (j < src.length && ((src[j] >= "0" && src[j] <= "9") || src[j] === ".")) j++;
      const n = Number(src.slice(i, j));
      if (!isFinite(n)) return null;
      out.push({ k: "num", v: n });
      i = j;
    } else if ((c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || c === "_") {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j++;
      out.push({ k: "id", v: src.slice(i, j) });
      i = j;
    } else if ("+-*/%^(),".includes(c)) {
      out.push({ k: "op", v: c });
      i++;
    } else return null;
  }
  return out;
}

/** Compila uma expressão ou devolve null se não for válida/segura. */
export function compileExpr(src: unknown, vars: readonly string[]): ExprFn | null {
  if (typeof src !== "string" || !src.trim() || src.length > EXPR_MAX_LEN) return null;
  const toks0 = tokenize(src);
  if (!toks0 || !toks0.length) return null;
  const toks: Tok[] = toks0;
  let p = 0, nodes = 0, bad = false;
  const peek = () => toks[p];
  const isOp = (v: string) => peek() && peek().k === "op" && peek().v === v;

  function expr(d: number): ExprFn {
    if (d > MAX_DEPTH || ++nodes > MAX_NODES) { bad = true; return () => 0; }
    let l = term(d + 1);
    while (isOp("+") || isOp("-")) {
      const op = toks[p++].v, r = term(d + 1), a = l;
      l = op === "+" ? (v) => a(v) + r(v) : (v) => a(v) - r(v);
    }
    return l;
  }
  function term(d: number): ExprFn {
    let l = unary(d + 1);
    while (isOp("*") || isOp("/") || isOp("%")) {
      const op = toks[p++].v, r = unary(d + 1), a = l;
      if (op === "*") l = (v) => a(v) * r(v);
      else if (op === "/") l = (v) => { const b = r(v); return b === 0 ? 0 : a(v) / b; };
      else l = (v) => { const b = r(v); return b === 0 ? 0 : a(v) - b * Math.floor(a(v) / b); };
    }
    return l;
  }
  function unary(d: number): ExprFn {
    if (d > MAX_DEPTH || ++nodes > MAX_NODES) { bad = true; return () => 0; }
    if (isOp("-")) { p++; const a = unary(d + 1); return (v) => -a(v); }
    if (isOp("+")) { p++; return unary(d + 1); }
    const b = atom(d + 1);
    if (isOp("^")) { p++; const e = unary(d + 1); return (v) => Math.pow(b(v), Math.min(Math.max(e(v), -8), 8)); }
    return b;
  }
  function atom(d: number): ExprFn {
    const t = toks[p++];
    if (!t) { bad = true; return () => 0; }
    if (t.k === "num") { const n = t.v as number; return () => n; }
    if (t.k === "op" && t.v === "(") {
      const e = expr(d + 1);
      if (!isOp(")")) bad = true; else p++;
      return e;
    }
    if (t.k === "id") {
      const name = t.v as string;
      if (isOp("(")) {
        p++;
        const fn = Object.prototype.hasOwnProperty.call(FUNCS, name) ? FUNCS[name] : undefined;
        const args: ExprFn[] = [];
        if (!isOp(")")) {
          args.push(expr(d + 1));
          while (isOp(",")) { p++; args.push(expr(d + 1)); }
        }
        if (!isOp(")")) bad = true; else p++;
        if (!fn || args.length !== fn.n) { bad = true; return () => 0; }
        const f = fn.f;
        if (args.length === 1) { const a = args[0]; return (v) => f(a(v)); }
        if (args.length === 2) { const a = args[0], b = args[1]; return (v) => f(a(v), b(v)); }
        const a = args[0], b = args[1], c = args[2];
        return (v) => f(a(v), b(v), c(v));
      }
      if (Object.prototype.hasOwnProperty.call(CONSTS, name)) { const n = CONSTS[name]; return () => n; }
      if (vars.includes(name)) return (v) => v[name] || 0;
      bad = true;
      return () => 0;
    }
    bad = true;
    return () => 0;
  }

  const root = expr(0);
  if (bad || p !== toks.length) return null;
  return (v) => {
    const r = root(v);
    return r !== r ? 0 : r > EXPR_OUT ? EXPR_OUT : r < -EXPR_OUT ? -EXPR_OUT : r;
  };
}

/** Versão JS pura do mesmo analisador, injectada na página (sem tipos). */
export const EXPR_RUNTIME = String.raw`
const EXPR_OUT = 1000;
const EXPR_FUNCS = (function () {
  const hash = function (x) { const s = Math.sin(x * 12.9898) * 43758.5453; return s - Math.floor(s); };
  return {
    sin: [1, Math.sin], cos: [1, Math.cos], tan: [1, Math.tan], asin: [1, Math.asin], acos: [1, Math.acos],
    atan: [1, Math.atan], atan2: [2, Math.atan2], abs: [1, Math.abs],
    sqrt: [1, function (a) { return Math.sqrt(Math.max(0, a)); }],
    exp: [1, function (a) { return Math.exp(Math.min(a, 20)); }],
    log: [1, function (a) { return Math.log(Math.max(1e-9, a)); }],
    floor: [1, Math.floor], fract: [1, function (a) { return a - Math.floor(a); }], sign: [1, Math.sign],
    min: [2, Math.min], max: [2, Math.max],
    pow: [2, function (a, b) { return Math.pow(a, Math.min(Math.max(b, -8), 8)); }],
    mod: [2, function (a, b) { return b === 0 ? 0 : a - b * Math.floor(a / b); }],
    mix: [3, function (a, b, k) { return a + (b - a) * k; }],
    clamp: [3, function (x, a, b) { return Math.min(Math.max(x, a), b); }],
    step: [2, function (a, x) { return x < a ? 0 : 1; }],
    smooth: [3, function (a, b, x) { const u = Math.min(Math.max((x - a) / (b - a || 1), 0), 1); return u * u * (3 - 2 * u); }],
    rnd: [1, hash]
  };
})();
const EXPR_CONSTS = { pi: Math.PI, tau: Math.PI * 2, e: Math.E };
function compileExpr(src, vars) {
  if (typeof src !== "string" || !src.trim() || src.length > 120) return null;
  const toks = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === " " || c === "\t") { i++; continue; }
    if ((c >= "0" && c <= "9") || c === ".") {
      let j = i;
      while (j < src.length && ((src[j] >= "0" && src[j] <= "9") || src[j] === ".")) j++;
      const n = Number(src.slice(i, j));
      if (!isFinite(n)) return null;
      toks.push({ k: "num", v: n }); i = j;
    } else if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j++;
      toks.push({ k: "id", v: src.slice(i, j) }); i = j;
    } else if ("+-*/%^(),".indexOf(c) >= 0) { toks.push({ k: "op", v: c }); i++; }
    else return null;
  }
  if (!toks.length) return null;
  let p = 0, nodes = 0, bad = false;
  const isOp = function (v) { return toks[p] && toks[p].k === "op" && toks[p].v === v; };
  const zero = function () { return 0; };
  function expr(d) {
    if (d > 14 || ++nodes > 80) { bad = true; return zero; }
    let l = term(d + 1);
    while (isOp("+") || isOp("-")) {
      const op = toks[p++].v, r = term(d + 1), a = l;
      l = op === "+" ? function (v) { return a(v) + r(v); } : function (v) { return a(v) - r(v); };
    }
    return l;
  }
  function term(d) {
    let l = unary(d + 1);
    while (isOp("*") || isOp("/") || isOp("%")) {
      const op = toks[p++].v, r = unary(d + 1), a = l;
      if (op === "*") l = function (v) { return a(v) * r(v); };
      else if (op === "/") l = function (v) { const b = r(v); return b === 0 ? 0 : a(v) / b; };
      else l = function (v) { const b = r(v); return b === 0 ? 0 : a(v) - b * Math.floor(a(v) / b); };
    }
    return l;
  }
  function unary(d) {
    if (d > 14 || ++nodes > 80) { bad = true; return zero; }
    if (isOp("-")) { p++; const a = unary(d + 1); return function (v) { return -a(v); }; }
    if (isOp("+")) { p++; return unary(d + 1); }
    const b = atom(d + 1);
    if (isOp("^")) { p++; const e = unary(d + 1); return function (v) { return Math.pow(b(v), Math.min(Math.max(e(v), -8), 8)); }; }
    return b;
  }
  function atom(d) {
    const t = toks[p++];
    if (!t) { bad = true; return zero; }
    if (t.k === "num") { const n = t.v; return function () { return n; }; }
    if (t.k === "op" && t.v === "(") {
      const e = expr(d + 1);
      if (!isOp(")")) bad = true; else p++;
      return e;
    }
    if (t.k === "id") {
      const name = t.v;
      if (isOp("(")) {
        p++;
        const fn = Object.prototype.hasOwnProperty.call(EXPR_FUNCS, name) ? EXPR_FUNCS[name] : null, args = [];
        if (!isOp(")")) {
          args.push(expr(d + 1));
          while (isOp(",")) { p++; args.push(expr(d + 1)); }
        }
        if (!isOp(")")) bad = true; else p++;
        if (!fn || args.length !== fn[0]) { bad = true; return zero; }
        const f = fn[1];
        if (args.length === 1) { const a = args[0]; return function (v) { return f(a(v)); }; }
        if (args.length === 2) { const a = args[0], b = args[1]; return function (v) { return f(a(v), b(v)); }; }
        const a = args[0], b = args[1], c = args[2];
        return function (v) { return f(a(v), b(v), c(v)); };
      }
      if (Object.prototype.hasOwnProperty.call(EXPR_CONSTS, name)) { const n = EXPR_CONSTS[name]; return function () { return n; }; }
      if (vars.indexOf(name) >= 0) return function (v) { return v[name] || 0; };
      bad = true; return zero;
    }
    bad = true; return zero;
  }
  const root = expr(0);
  if (bad || p !== toks.length) return null;
  return function (v) { const r = root(v); return r !== r ? 0 : r > EXPR_OUT ? EXPR_OUT : r < -EXPR_OUT ? -EXPR_OUT : r; };
}
`;
