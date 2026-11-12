import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { theme } from "../theme";
import type { Block } from "../schema";

export function QuizBlockView({ block }: { block: Extract<Block, { type: "quiz" }> }) {
  const [picked, setPicked] = useState<number | null>(null);
  const done = picked !== null;
  const right = picked === block.answerIndex;

  return (
    <View style={{ backgroundColor: theme.panel, borderColor: theme.line, borderWidth: 1, borderRadius: 18, padding: 16 }}>
      <Text style={{ color: theme.muted, fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 10 }}>
        {block.title ?? "Verifica"}
      </Text>
      <Text style={{ color: theme.text, fontSize: 15, lineHeight: 22, marginBottom: 12 }}>{block.question}</Text>

      <View style={{ gap: 7 }}>
        {block.options.map((o, i) => {
          const isRight = done && i === block.answerIndex;
          const isWrong = done && i === picked && !isRight;
          return (
            <Pressable
              key={i}
              disabled={done}
              onPress={() => setPicked(i)}
              style={{
                backgroundColor: isRight ? "#3ee0c018" : isWrong ? "#ff7a9014" : theme.card,
                borderColor: isRight ? theme.accent : isWrong ? "#ff7a90" : theme.line,
                borderWidth: 1,
                borderRadius: 12,
                paddingVertical: 12,
                paddingHorizontal: 13,
              }}
            >
              <Text style={{ color: isRight ? "#b6ffee" : isWrong ? "#ffd0d8" : theme.text, fontSize: 14 }}>{o}</Text>
            </Pressable>
          );
        })}
      </View>

      {done && (
        <View
          style={{
            marginTop: 10,
            backgroundColor: right ? "#3ee0c00f" : "#ff7a900f",
            borderRadius: 11,
            padding: 10,
          }}
        >
          <Text style={{ color: right ? "#a9f7e6" : "#ffc6cf", fontSize: 13, lineHeight: 19 }}>
            {(right ? "Certo. " : "Não é essa. ") + (block.explanation ?? "")}
          </Text>
        </View>
      )}
    </View>
  );
}
