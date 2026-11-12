import { Text, View } from "react-native";
import { theme } from "../theme";
import type { Block } from "../schema";

function Rich({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return (
    <Text style={{ color: "#dbe3f7", fontSize: 15, lineHeight: 24 }}>
      {parts.map((p, i) =>
        p.startsWith("**") ? (
          <Text key={i} style={{ fontWeight: "700", color: "#fff" }}>
            {p.slice(2, -2)}
          </Text>
        ) : (
          <Text key={i}>{p}</Text>
        ),
      )}
    </Text>
  );
}

export function TextBlockView({ block }: { block: Extract<Block, { type: "text" }> }) {
  return (
    <View style={{ backgroundColor: theme.panel, borderColor: theme.line, borderWidth: 1, borderRadius: 18, padding: 16 }}>
      {block.title && (
        <Text style={{ color: theme.text, fontSize: 17, fontWeight: "700", marginBottom: 8 }}>{block.title}</Text>
      )}
      <Rich text={block.markdown} />
    </View>
  );
}
