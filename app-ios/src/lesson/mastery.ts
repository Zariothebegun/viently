import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "viently.mastery.v1";
const MAX_TOPICS = 40;
const RECENT_WINDOW = 8;

export type TopicMastery = {
  attempts: number;
  correct: number;
  recent: boolean[];
  updatedAt: number;
};

export type MasteryStore = {
  version: 1;
  topics: Record<string, TopicMastery>;
};

const EMPTY: MasteryStore = { version: 1, topics: {} };

export function normalizeTopic(topic: string): string {
  return String(topic ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .slice(0, 80);
}

export function updateMastery(
  store: MasteryStore | null | undefined,
  topic: string,
  wasCorrect: boolean,
  now = Date.now(),
): MasteryStore {
  const key = normalizeTopic(topic);
  if (!key) return store ?? EMPTY;
  const safe = store?.version === 1 && store.topics ? store : EMPTY;
  const previous = safe.topics[key] ?? { attempts: 0, correct: 0, recent: [], updatedAt: 0 };
  const recent = [...previous.recent, !!wasCorrect].slice(-RECENT_WINDOW);
  const topics = {
    ...safe.topics,
    [key]: {
      attempts: previous.attempts + 1,
      correct: previous.correct + (wasCorrect ? 1 : 0),
      recent,
      updatedAt: now,
    },
  };
  const trimmed = Object.fromEntries(
    Object.entries(topics)
      .sort((a, b) => b[1].updatedAt - a[1].updatedAt)
      .slice(0, MAX_TOPICS),
  );
  return { version: 1, topics: trimmed };
}

export function masteryProfile(store: MasteryStore | null | undefined, topic: string): string {
  const key = normalizeTopic(topic);
  const record = key ? store?.topics?.[key] : undefined;
  if (!record || record.attempts < 1) {
    return "Ainda não há respostas avaliadas suficientes neste tema. Não assumas que o aluno domina ou desconhece a matéria; verifica os pré-requisitos quando forem relevantes.";
  }

  const accuracy = record.correct / record.attempts;
  const recent = record.recent.length
    ? record.recent.filter(Boolean).length / record.recent.length
    : accuracy;
  const evidence = `Histórico de avaliação neste tema: ${record.correct}/${record.attempts} respostas correctas; janela recente ${Math.round(recent * 100)}% (${record.recent.length} respostas).`;

  if (record.attempts < 3) {
    return `${evidence} Evidência ainda limitada: confirma a compreensão com uma pergunta nova antes de acelerar ou simplificar muito.`;
  }
  if (recent < 0.5 || accuracy < 0.55) {
    return `${evidence} Há sinais de dificuldade. Reexplica o pré-requisito mais provável com linguagem simples, exemplo resolvido e uma verificação diferente; não repitas apenas a mesma pergunta.`;
  }
  if (recent >= 0.8 && accuracy >= 0.8) {
    return `${evidence} Há evidência consistente de bom desempenho. Evita repetir o básico; avança para aplicação, transferência e casos-limite, mas confirma o domínio com tarefas novas.`;
  }
  return `${evidence} Domínio parcial ou irregular. Mantém o nível, identifica a confusão específica e alterna explicação curta com aplicação guiada.`;
}

export async function loadMastery(): Promise<MasteryStore> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed?.version !== 1 || !parsed.topics || typeof parsed.topics !== "object") return EMPTY;
    return parsed as MasteryStore;
  } catch {
    return EMPTY;
  }
}

export async function recordMasteryAttempt(topic: string, wasCorrect: boolean): Promise<MasteryStore> {
  const current = await loadMastery();
  const next = updateMastery(current, topic, wasCorrect);
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // A falha de persistência não deve bloquear a resposta ao aluno.
  }
  return next;
}

export async function getMasteryProfile(topic: string): Promise<string> {
  return masteryProfile(await loadMastery(), topic);
}
