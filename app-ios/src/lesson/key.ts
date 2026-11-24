import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const KEY = "viently.openrouter.key";

// Na web não existe SecureStore: a chave vive no AsyncStorage (localStorage),
// e o sítio é servido só na máquina local, por isso não há exposição pública.
const plainWeb = Platform.OS === "web";

async function readStored(): Promise<string | null> {
  if (plainWeb) return AsyncStorage.getItem(KEY);
  return SecureStore.getItemAsync(KEY);
}

async function writeStored(value: string): Promise<void> {
  if (plainWeb) {
    await AsyncStorage.setItem(KEY, value);
    return;
  }
  await SecureStore.setItemAsync(KEY, value);
}

async function deleteStored(): Promise<void> {
  if (plainWeb) {
    await AsyncStorage.removeItem(KEY);
    return;
  }
  await SecureStore.deleteItemAsync(KEY);
}

// The BYOK key lives in the OS-backed secure store. The AsyncStorage read is
// only a one-time migration for keys saved by older app versions.
export async function loadKey(): Promise<string | null> {
  const embedded = defaultKey();
  try {
    const stored = await readStored();
    if (stored) return stored;

    const legacy = await AsyncStorage.getItem(KEY);
    if (!legacy) return embedded;

    if (!plainWeb) {
      await SecureStore.setItemAsync(KEY, legacy);
    }
    await AsyncStorage.removeItem(KEY);
    return legacy;
  } catch {
    // Without a secure store the build-time key is still usable.
    return embedded;
  }
}

export async function saveKey(key: string): Promise<void> {
  const value = key.trim();
  if (!value) {
    await clearKey();
    return;
  }
  await writeStored(value);
  await AsyncStorage.removeItem(KEY);
}

export async function clearKey(): Promise<void> {
  await deleteStored();
  await AsyncStorage.removeItem(KEY);
}

export function looksLikeKey(v: string): boolean {
  const t = v.trim();
  return t.startsWith("sk-or-") || t.startsWith("sk-");
}

// Chave fornecida no .env (EXPO_PUBLIC_OPENROUTER_KEY). Sem ela a app pede a
// chave ao utilizador; com ela arranca já ligada.
export function defaultKey(): string | null {
  const value = process.env.EXPO_PUBLIC_OPENROUTER_KEY;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
