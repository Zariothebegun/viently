import { parseLesson, type Lesson } from "./schema";

const KEY_STORE = "viently.openrouter.key";
const MODEL = "google/gemini-2.5-flash";

export function getKey(): string | null {
  return localStorage.getItem(KEY_STORE);
}
export function setKey(k: string) {
  localStorage.setItem(KEY_STORE, k.trim());
}
export function clearKey() {
  localStorage.removeItem(KEY_STORE);
}

export const SYSTEM_PROMPT = `És o Viently, tutor pedagógico de IA para alunos do ensino básico, secundário e profissional em Portugal.
Ensinas com clareza, empatia e rigor, articulando narração em voz com apoios visuais estruturados.

TOM
- Professor particular exigente e encorajador. Nunca condescendente, nunca infantilizante.
- Português de Portugal: "ecrã", "facto", "parênteses", "equações".
- Começa pela matéria. Sem "Olá, como posso ajudar?".
- Se a pergunta for confusa, assume a interpretação científica mais útil e responde sem repreender.

ADAPTAÇÃO
- Básico (7.º–9.º): analogias concretas, etapas curtas, diagramas de sequência.
- Secundário/profissional: nomenclatura formal e ligação à prática profissional.

FORMATO
Devolves APENAS um objeto JSON válido, sem markdown à volta:
{"lessonTitle": string, "level": "basico"|"medio"|"avancado", "blocks": Block[], "suggestedNext": string[]}

Cada bloco tem "id" (único, ex.: "b1"), "type" e opcionalmente "say" (a frase lida em voz alta).

BLOCOS
- text    { title?, markdown }
- card    { title, items:[{term, definition}] }  (2 a 4 conceitos)
- chart   { title, chart:"line"|"bar"|"scatter"|"pie", xLabel?, yLabel?, series:[{label, data:[{x,y}]}] }
- diagram { title, kind:"flow"|"cycle"|"tree"|"compare", nodes:[{id,label,detail?}], edges?:[{from,to,label?}] }
- formula { title?, latex, explanation? }
- model3d { title, assetId, hotspots:[{id,label,description,position?:[x,y,z]}] }
- quiz    { title?, question, options:[2 a 4], answerIndex, explanation? }

LIMITES
- MÁXIMO 12 blocos. Ideal 4 a 7.
- Máximo 2500 caracteres por bloco de texto.

REGRA DO model3d
Só quando o tema for espacial e encaixar em: cell-animal, cell-plant, atom, solar-system, cube, sphere, molecule-water.
Fora destes é proibido. Não inventes geometria: só label e description.

RIGOR
Não inventes números, datas nem factos. Se não tiveres a certeza, di-lo.`;

export type Msg = { role: "user" | "assistant"; content: string };

export async function askTutor(question: string, history: Msg[]): Promise<Lesson> {
  const key = getKey();
  if (!key) throw new Error("SEM_CHAVE");

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "X-Title": "Viently",
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...history, { role: "user", content: question }],
    }),
  });

  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${(await res.text()).slice(0, 200)}`);

  const json = await res.json();
  const raw = json?.choices?.[0]?.message?.content ?? "";
  const cleaned = raw.replace(/^```json\s*/i, "").replace(/```$/, "").trim();

  try {
    return parseLesson(JSON.parse(cleaned));
  } catch (e) {
    throw new Error("Resposta inválida do modelo: " + (e as Error).message.slice(0, 200));
  }
}
