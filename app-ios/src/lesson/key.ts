import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

const KEY = "viently.openrouter.key";

// The BYOK key lives in the OS-backed secure store. The AsyncStorage read is
// only a one-time migration for keys saved by older app versions.
export async function loadKey(): Promise<string | null> {
  try {
    const secure = await SecureStore.getItemAsync(KEY);
    if (secure) return secure;

    const legacy = await AsyncStorage.getItem(KEY);
    if (!legacy) return null;

    await SecureStore.setItemAsync(KEY, legacy);
    await AsyncStorage.removeItem(KEY);
    return legacy;
  } catch {
    // Do not silently fall back to storing/using a plaintext key.
    return null;
  }
}

export async function saveKey(key: string): Promise<void> {
  const value = key.trim();
  if (!value) {
    await clearKey();
    return;
  }
  await SecureStore.setItemAsync(KEY, value);
  await AsyncStorage.removeItem(KEY);
}

export async function clearKey(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY);
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
