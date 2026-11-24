/*
  A biblioteca 3D é descarregada uma única vez pela app e entregue a todas as
  cenas como um endereço local (blob). Antes, cada iframe pedia quatro
  ficheiros ao CDN e, quando o host abortava um pedido, a cena ficava em branco
  — a página aparecia com a faixa do 3D vazia ("Nada"). Os CDN ficam só como
  alternativa, para o caso de o primeiro download falhar.
*/

const CDN = [
  "https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js",
  "https://unpkg.com/three@0.169.0/build/three.module.js",
  "https://esm.sh/three@0.169.0",
];

let cached: Promise<string[]> | null = null;

async function fetchSource(): Promise<string | null> {
  for (let round = 0; round < 3; round++) {
    for (const base of CDN) {
      const url = round === 0 ? base : `${base}${base.includes("?") ? "&" : "?"}r=${round}`;
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const src = await res.text();
        if (src.length < 5000) continue;
        return src;
      } catch {
        // tenta o seguinte
      }
    }
    await new Promise((r) => setTimeout(r, 400 * (round + 1)));
  }
  return null;
}

export function threeSources(): Promise<string[]> {
  if (cached) return cached;
  cached = (async () => {
    const src = await fetchSource();
    if (!src) return [...CDN];
    try {
      const url = URL.createObjectURL(new Blob([src], { type: "text/javascript" }));
      return [url, ...CDN];
    } catch {
      return [...CDN];
    }
  })();
  return cached;
}
