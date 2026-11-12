// Pesquisa de modelos 3D na Poly Pizza (https://poly.pizza).
//
// A app não gera geometria: pede ao modelo de linguagem uma consulta curta em
// inglês e vai buscar um GLB já feito, com licença e autor. O resultado é
// guardado em cache para a mesma pergunta não bater duas vezes na API.
//
// A chave é gratuita e só permite pesquisar/descarregar modelos. Fica no
// bundle (como a chave do OpenRouter no telemóvel); pode ser trocada por
// EXPO_PUBLIC_POLY_KEY num .env local sem mexer no código.

import AsyncStorage from "@react-native-async-storage/async-storage";

const ENDPOINT = "https://api.poly.pizza/v1/search";
const CACHE_KEY = "viently.poly.v1";
const CACHE_TTL = 1000 * 60 * 60 * 24 * 30; // 30 dias
const CACHE_MAX = 40;
const TIMEOUT = 9000;

const POLY_KEY =
  process.env.EXPO_PUBLIC_POLY_KEY ?? "807211ee560e48878c81fefae419180d";

export type PolyModel = {
  id: string;
  title: string;
  glb: string;
  thumb: string;
  author: string;
  licence: string;
  tris: number;
  page: string;
};

type CacheEntry = { q: string; at: number; items: PolyModel[] };
type Cache = Record<string, CacheEntry>;

const STOP = new Set([
  "a", "an", "the", "of", "and", "or", "for", "with", "in", "on", "to",
  "de", "da", "do", "das", "dos", "e", "ou", "para", "com", "em", "no", "na",
]);

function fold(s: string): string {
  return String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function words(s: string): string[] {
  return fold(s)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !STOP.has(w));
}

// ---- cache ----

let cache: Cache | null = null;
let writing: Promise<void> | null = null;

async function loadCache(): Promise<Cache> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    cache = raw ? (JSON.parse(raw) as Cache) : {};
  } catch {
    cache = {};
  }
  return cache;
}

function saveCache() {
  if (!cache) return;
  const now = Date.now();
  const entries = Object.entries(cache)
    .filter(([, v]) => now - v.at < CACHE_TTL)
    .sort((a, b) => b[1].at - a[1].at)
    .slice(0, CACHE_MAX);
  cache = Object.fromEntries(entries);
  writing = AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache)).catch(() => {});
}

// ---- ranking ----
// A busca da Poly Pizza é literal, por isso uma consulta como "cell" devolve
// uma prisão. Aqui exigimos que a palavra principal apareça no título ou nas
// etiquetas, e penalizamos cenas/armas e modelos com demasiados triângulos.

const BAD_CATEGORY = /scenes?\s*&?\s*levels?|weapons?/i;

function score(item: any, q: string[]): number {
  const title = fold(item.Title ?? "");
  const tagText = fold((item.Tags ?? []).join(" "));
  const desc = fold(item.Description ?? "");
  let s = 0;
  let hit = 0;

  for (const w of q) {
    // palavras curtas como "cell" também contam: comparamos por início
    const inTitle = title.split(/[^a-z0-9]+/).some((t) => t === w || t.startsWith(w));
    if (inTitle) {
      s += 6;
      hit += 1;
      continue;
    }
    if (tagText.split(/[^a-z0-9]+/).some((t) => t === w || t.startsWith(w))) {
      s += 3;
      hit += 1;
      continue;
    }
    if (desc.includes(w)) {
      s += 1;
      hit += 1;
    }
  }

  const phrase = q.join(" ");
  if (phrase && title.includes(phrase)) s += 8;
  if (!hit) return -1;

  const head = q[q.length - 1];
  const headInTitle = title.split(/[^a-z0-9]+/).some((t) => t === head || t.startsWith(head));
  if (!headInTitle) s -= 2;

  const tris = Number(item["Tri Count"] ?? 0);
  if (tris > 90000) s -= 4;
  if (tris > 180000) return -1;
  if (BAD_CATEGORY.test(String(item.Category ?? ""))) s -= 5;

  return s;
}

function normalise(item: any): PolyModel | null {
  const glb = String(item.Download ?? "");
  const thumb = String(item.Thumbnail ?? "");
  if (!/^https:\/\//.test(glb)) return null;
  const id = String(item.ID ?? "");
  return {
    id,
    title: String(item.Title ?? "modelo 3D").slice(0, 48),
    glb,
    thumb,
    author: String(item.Creator?.Username ?? "Poly Pizza").slice(0, 48),
    licence: String(item.Licence ?? "CC-BY 3.0").slice(0, 24),
    tris: Number(item["Tri Count"] ?? 0),
    page: id ? `https://poly.pizza/m/${id}` : "https://poly.pizza",
  };
}

export async function searchPoly(rawQuery: string): Promise<PolyModel[]> {
  const query = String(rawQuery ?? "").replace(/\s+/g, " ").trim().slice(0, 60);
  if (!query) return [];

  const c = await loadCache();
  const key = fold(query);
  const hit = c[key];
  if (hit && Date.now() - hit.at < CACHE_TTL) return hit.items;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const res = await fetch(`${ENDPOINT}/${encodeURIComponent(query)}`, {
      headers: { "x-auth-token": POLY_KEY, Accept: "application/json" },
      signal: ctrl.signal,
    });
    if (!res.ok) return [];
    const data = await res.json();
    const q = words(query);
    if (!q.length) return [];

    const seen = new Set<string>();
    const items = (Array.isArray(data?.results) ? data.results : [])
      .map((it: any) => ({ it, sc: score(it, q) }))
      .filter((r: any) => r.sc >= 4)
      .sort((a: any, b: any) => b.sc - a.sc)
      .map((r: any) => normalise(r.it))
      .filter((m: PolyModel | null): m is PolyModel => {
        if (!m) return false;
        if (seen.has(m.glb)) return false;
        seen.add(m.glb);
        return true;
      })
      .slice(0, 8);

    c[key] = { q: query, at: Date.now(), items };
    saveCache();
    return items;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

export async function resolvePoly(rawQuery: string): Promise<PolyModel | null> {
  const items = await searchPoly(rawQuery);
  return items.length ? items[0] : null;
}

export function polyReady(): Promise<void> {
  return writing ?? Promise.resolve();
}
