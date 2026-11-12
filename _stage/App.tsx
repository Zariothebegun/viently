import * as Speech from "expo-speech";
import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  View,
} from "react-native";
import { BlockRenderer } from "./src/blocks/Registry";
import { mitose } from "./src/data/mitose";
import type { Lesson } from "./src/schema";
import { theme } from "./src/theme";

export default function App() {
  const [lesson] = useState<Lesson>(mitose);
  const [revealed, setRevealed] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [q, setQ] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView | null>(null);
  const cancelled = useRef(false);

  useEffect(() => () => void Speech.stop(), []);

  async function play() {
    await Speech.stop();
    cancelled.current = false;
    setRevealed(0);
    setPlaying(true);

    for (let i = 0; i < lesson.blocks.length; i++) {
      if (cancelled.current) break;
      const b = lesson.blocks[i];
      const text = (b as any).say ?? (b as any).title ?? "";
      setRevealed(i + 1);
      await new Promise<void>((resolve) => {
        if (!text) return resolve();
        Speech.speak(text, {
          language: "pt-PT",
          rate: 0.95,
          onDone: () => resolve(),
          onStopped: () => resolve(),
          onError: () => resolve(),
        });
      });
    }
    if (!cancelled.current) setPlaying(false);
  }

  async function stop() {
    cancelled.current = true;
    await Speech.stop();
    setPlaying(false);
    setRevealed(lesson.blocks.length);
  }

  function submit() {
    setQ("");
    setNote("Modo demonstração: liga a chave OpenRouter no próximo passo para perguntas reais.");
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <StatusBar barStyle="light-content" />

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 16,
          paddingBottom: 10,
          borderBottomWidth: 1,
          borderBottomColor: theme.line,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: theme.accent }} />
          <Text style={{ color: theme.text, fontWeight: "700", fontSize: 15 }}>Viently</Text>
        </View>
        <Text style={{ color: theme.muted, fontSize: 11 }}>iOS · Expo</Text>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 24 }}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          <View>
            <Text
              style={{
                color: theme.accent,
                fontSize: 10,
                letterSpacing: 1,
                textTransform: "uppercase",
                marginBottom: 6,
              }}
            >
              {lesson.level}
            </Text>
            <Text style={{ color: theme.text, fontSize: 23, fontWeight: "700" }}>{lesson.lessonTitle}</Text>
          </View>

          {lesson.blocks.slice(0, revealed).map((b) => (
            <BlockRenderer key={b.id} block={b} />
          ))}
        </ScrollView>

        {note && (
          <Text style={{ color: "#ffd0a8", fontSize: 12, paddingHorizontal: 16, paddingBottom: 6 }}>{note}</Text>
        )}

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderTopWidth: 1,
            borderTopColor: theme.line,
          }}
        >
          <Pressable
            onPress={playing ? stop : play}
            style={{
              flex: 1,
              backgroundColor: theme.accent,
              borderRadius: 12,
              paddingVertical: 13,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#04231d", fontWeight: "800", fontSize: 14 }}>
              {playing ? "■ Parar" : revealed >= lesson.blocks.length ? "↻ Repetir" : "▶ Ouvir a aula"}
            </Text>
          </Pressable>
          <Text style={{ color: theme.muted, fontSize: 12, minWidth: 34, textAlign: "right" }}>
            {revealed}/{lesson.blocks.length}
          </Text>
        </View>

        <View
          style={{
            flexDirection: "row",
            gap: 8,
            paddingHorizontal: 16,
            paddingBottom: 10,
            paddingTop: 2,
          }}
        >
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Pergunta ao Viently…"
            placeholderTextColor="#5f6d8f"
            style={{
              flex: 1,
              backgroundColor: theme.card,
              borderColor: theme.line,
              borderWidth: 1,
              borderRadius: 13,
              paddingHorizontal: 14,
              paddingVertical: 12,
              color: theme.text,
              fontSize: 15,
            }}
            onSubmitEditing={submit}
            returnKeyType="send"
          />
          <Pressable
            onPress={submit}
            style={{ width: 48, borderRadius: 13, backgroundColor: theme.accent2, alignItems: "center", justifyContent: "center" }}
          >
            <Text style={{ color: "#050b1c", fontSize: 18, fontWeight: "800" }}>↑</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
