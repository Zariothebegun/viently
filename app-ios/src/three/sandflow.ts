// Modelos 3D reais, procurados num catálogo público.
//
// Não geramos geometria: o modelo de linguagem escreve uma consulta curta em
// inglês, procuramos no catálogo da Polyfork (API pública, sem chave, licença
// livre e CDN com CORS aberto) e desenhamos o GLB com three.js dentro da
// página. O Sandflow (sand3d) está desligado do lado deles, por isso deixou de
// ser a fonte; a estrutura ficou igual para se poder voltar a ligar.
//
// Falha em silêncio: sem resultado, a página fica só com o desenho 2D.

import AsyncStorage from "@react-native-async-storage/async-storage";

const API = "https://polyfork.dev/api";
const CACHE_KEY = "viently.models.v2";
const CACHE_TTL = 1000 * 60 * 60 * 24 * 30; // 30 dias
const CACHE_MAX = 60;
const TIMEOUT = 9000;

export type SandflowModel = {
  id: string;
  title: string;
  // GLB real, desenhado em three.js
  glb: string;
  // imagem de pré-visualização (entra enquanto o GLB carrega)
  thumb: string;
  author: string;
  licence: string;
  page: string;
};

type CacheEntry = { q: string; at: number; item: SandflowModel | null };
type Cache = Record<string, CacheEntry>;

function fold(s: string): string {
  return String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function tokens(s: string): string[] {
  return fold(s)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2);
}

// palavras que não ajudam a escolher ("3d", "model", "the")
const STOP = new Set([
  "the",
  "and",
  "for",
  "with",
  "model",
  "asset",
  "low",
  "poly",
  "free",
  "set",
  "kit",
  "pack",
]);

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
  const keys = Object.keys(cache);
  if (keys.length > CACHE_MAX) {
    keys
      .sort((a, b) => cache![a].at - cache![b].at)
      .slice(0, keys.length - CACHE_MAX)
      .forEach((k) => delete cache![k]);
  }
  writing = AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache))
    .catch(() => undefined)
    .then(() => undefined);
  void now;
}

async function getJson(url: string, timeout = TIMEOUT): Promise<any | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Escolhe o modelo cujo nome mais se aproxima da consulta. Palavras da consulta
// que aparecem no título contam; a ordem do catálogo desempata.
function rank(items: any[], query: string): any | null {
  const want = tokens(query).filter((w) => !STOP.has(w));
  const usable = items.filter(
    (it) => it && it.free !== false && (it.preview_glb || it.id) && String(it.title ?? "").trim(),
  );
  if (!usable.length) return null;
  if (!want.length) return usable[0];

  let best: { it: any; score: number } | null = null as { it: any; score: number } | null;
  usable.forEach((it, i) => {
    const title = tokens(String(it.title ?? ""));
    const kit = tokens(String(it.kit ?? ""));
    let sc = Math.max(0, 6 - i) * 0.5;
    for (const w of want) {
      if (title.some((t) => t === w)) sc += 6;
      else if (title.some((t) => t.startsWith(w) || w.startsWith(t))) sc += 4;
      else if (kit.some((k) => k === w)) sc += 2;
    }
    // modelos enormes não rolam bem num telemóvel
    const tris = Number(it.triangles ?? it.preview_triangles ?? 0);
    if (tris > 120000) sc -= 4;
    if (!best || sc > best.score) best = { it, score: sc };
  });

  // abaixo disto é melhor não mostrar nada do que mostrar uma coisa errada
  return best && best.score >= 4 ? best.it : null;
}

function toModel(it: any): SandflowModel | null {
  const id = String(it.id ?? "");
  const glb = String(it.preview_glb || `${API.replace("/api", "")}/cdn/${id}.glb`);
  if (!id || !glb) return null;
  const title = String(it.title ?? "modelo 3D").replace(/\s+/g, " ").trim().slice(0, 60);
  return {
    id,
    title,
    glb,
    thumb: String(it.thumbnail ?? ""),
    author: String(it.author?.name ?? it.author ?? it.user?.name ?? "Autor não indicado").slice(0, 80),
    licence: String(it.licence ?? it.license ?? it.license_name ?? "Licença não indicada").slice(0, 80),
    page: String(it.page ?? it.url ?? "https://polyfork.dev"),
  };
}

async function searchOnce(query: string): Promise<any[]> {
  const url = `${API}/assets?q=${encodeURIComponent(query)}&free=1&per_page=24`;
  const data = await getJson(url);
  const list = Array.isArray(data?.assets) ? data.assets : Array.isArray(data) ? data : [];
  return list;
}

// Procura o modelo mais próximo da consulta. Devolve null quando não há
// nenhum resultado utilizável — nesse caso a página fica só com o desenho 2D.
export async function resolveSandflow(rawQuery: string): Promise<SandflowModel | null> {
  const query = String(rawQuery ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  if (!query) return null;

  const c = await loadCache();
  const key = fold(query);
  const hit = c[key];
  if (hit && Date.now() - hit.at < CACHE_TTL) return hit.item;

  let chosen = rank(await searchOnce(query), query);

  // segunda tentativa: a última palavra costuma ser o objecto ("spare engine")
  if (!chosen) {
    const words = tokens(query).filter((w) => !STOP.has(w));
    const head = words[words.length - 1];
    if (head && head !== fold(query)) chosen = rank(await searchOnce(head), head);
  }

  const model = chosen ? toModel(chosen) : null;
  c[key] = { q: query, at: Date.now(), item: model };
  saveCache();
  return model;
}

export function sandflowReady(): Promise<void> {
  return writing ?? Promise.resolve();
}
