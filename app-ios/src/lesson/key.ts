import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "viently.openrouter.key";

// A chave nunca fica neste repositório. Vem de EXPO_PUBLIC_OPENROUTER_KEY
// (ficheiro .env local, ignorado pelo git) ou é escrita pelo aluno dentro
// da app e guardada no armazenamento privado do dispositivo.
export async function loadKey(): Promise<string | null> {
  const env = process.env.EXPO_PUBLIC_OPENROUTER_KEY;
  if (env && env.startsWith("sk-")) return env;
  return AsyncStorage.getItem(KEY);
}

export async function saveKey(key: string): Promise<void> {
  await AsyncStorage.setItem(KEY, key.trim());
}

export async function clearKey(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}

export function looksLikeKey(v: string): boolean {
  const t = v.trim();
  return t.startsWith("sk-or-") || t.startsWith("sk-");
}

// chave vinda do .env (proxy local ou OpenRouter) — evita pedir ao utilizador
export function defaultKey(): string | null {
  if (process.env.EXPO_PUBLIC_API_BASE && process.env.EXPO_PUBLIC_API_KEY) {
    return process.env.EXPO_PUBLIC_API_KEY;
  }
  const env = process.env.EXPO_PUBLIC_OPENROUTER_KEY;
  if (env && env.startsWith("sk-")) return env;
  return null;
}
