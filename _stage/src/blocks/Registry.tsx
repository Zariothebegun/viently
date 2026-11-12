import { Text, View } from "react-native";
import { theme } from "../theme";
import type { Block } from "../schema";
import { TextBlockView } from "./Text";
import { CardBlockView } from "./Cards";
import { ChartBlockView } from "./Chart";
import { DiagramBlockView } from "./Diagram";
import { FormulaBlockView } from "./Formula";
import { QuizBlockView } from "./Quiz";

function Soon3D({ block }: { block: Extract<Block, { type: "model3d" }> }) {
  return (
    <View style={{ backgroundColor: theme.panel, borderColor: theme.line, borderWidth: 1, borderRadius: 18, padding: 16 }}>
      <Text style={{ color: theme.muted, fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase" }}>
        {block.title}
      </Text>
      <View
        style={{
          height: 150,
          borderRadius: 14,
          marginTop: 10,
          backgroundColor: "#101a33",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ color: theme.muted, fontSize: 13 }}>modelo 3D — {block.assetId}</Text>
        <Text style={{ color: "#5f6d8f", fontSize: 11, marginTop: 6 }}>entra no próximo passo</Text>
      </View>
    </View>
  );
}

export function BlockRenderer({ block }: { block: Block }) {
  switch (block.type) {
    case "text":
      return <TextBlockView block={block} />;
    case "card":
      return <CardBlockView block={block} />;
    case "chart":
      return <ChartBlockView block={block} />;
    case "diagram":
      return <DiagramBlockView block={block} />;
    case "formula":
      return <FormulaBlockView block={block} />;
    case "model3d":
      return <Soon3D block={block} />;
    case "quiz":
      return <QuizBlockView block={block} />;
    default:
      return null;
  }
}
