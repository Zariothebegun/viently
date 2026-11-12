import { Text, View } from "react-native";
import { theme } from "../theme";
import type { Block } from "../schema";

export function CardBlockView({ block }: { block: Extract<Block, { type: "card" }> }) {
  return (
    <View style={{ backgroundColor: theme.panel, borderColor: theme.line, borderWidth: 1, borderRadius: 18, padding: 16 }}>
      <Text style={{ color: theme.muted, fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 10 }}>
        {block.title}
      </Text>
      <View style={{ gap: 8 }}>
        {block.items.map((it, i) => (
          <View key={i} style={{ backgroundColor: theme.card, borderColor: theme.line, borderWidth: 1, borderRadius: 13, padding: 12 }}>
            <Text style={{ color: theme.accent, fontSize: 14, fontWeight: "700" }}>{it.term}</Text>
            <Text style={{ color: theme.muted, fontSize: 13, lineHeight: 19, marginTop: 3 }}>{it.definition}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
