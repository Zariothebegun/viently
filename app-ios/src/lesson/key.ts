import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "viently.openrouter.key";

// Não ler chaves de EXPO_PUBLIC_*: essas variáveis são embutidas no
// bundle e podem ser extraídas da aplicação. A chave BYOK é introduzida pelo
// utilizador e guardada no armazenamento privado da app.
export async function loadKey(): Promise<string | null> {
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

// Não existe chave de fornecedor embutida na aplicação.
export function defaultKey(): string | null {
  return null;
}
