import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { theme } from "../theme";
import type { Block } from "../schema";

export function DiagramBlockView({ block }: { block: Extract<Block, { type: "diagram" }> }) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <View style={{ backgroundColor: theme.panel, borderColor: theme.line, borderWidth: 1, borderRadius: 18, padding: 16 }}>
      <Text style={{ color: theme.muted, fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 10 }}>
        {block.title}
      </Text>

      {block.nodes.map((n, i) => {
        const isOpen = open === n.id;
        return (
          <View key={n.id}>
            <Pressable
              onPress={() => setOpen(isOpen ? null : n.id)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                backgroundColor: isOpen ? "#3ee0c00f" : theme.card,
                borderColor: isOpen ? "#3ee0c066" : theme.line,
                borderWidth: 1,
                borderRadius: 13,
                paddingVertical: 12,
                paddingHorizontal: 12,
              }}
            >
              <View
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: "#3ee0c01f",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ color: theme.accent, fontSize: 11, fontWeight: "700" }}>{i + 1}</Text>
              </View>
              <Text style={{ color: theme.text, fontSize: 14, flex: 1 }}>{n.label}</Text>
            </Pressable>
            {isOpen && n.detail && (
              <Text style={{ color: theme.muted, fontSize: 12.5, lineHeight: 19, marginTop: 6, marginLeft: 34 }}>
                {n.detail}
              </Text>
            )}
            {i < block.nodes.length - 1 && (
              <View style={{ width: 2, height: 14, backgroundColor: "#3ee0c055", alignSelf: "center", marginVertical: 2 }} />
            )}
          </View>
        );
      })}
      {block.kind === "cycle" && (
        <Text style={{ color: theme.muted, fontSize: 11, marginTop: 8 }}>ciclo: o último passo volta ao primeiro</Text>
      )}
    </View>
  );
}
