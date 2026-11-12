import { Text, View } from "react-native";
import { WebView } from "react-native-webview";
import { theme } from "../theme";
import type { Block } from "../schema";

export function FormulaBlockView({ block }: { block: Extract<Block, { type: "formula" }> }) {
  const latex = block.latex.replace(/\\/g, "\\\\");
  const html = `<!doctype html><html><head>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
  <script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
  <style>html,body{margin:0;background:transparent;display:flex;align-items:center;justify-content:center;height:100%}
  .k{font-size:22px;color:#eaf6ff}</style></head>
  <body><div class="k" id="k"></div>
  <script>katex.render("${latex}", document.getElementById("k"), {throwOnError:false,displayMode:true});</script>
  </body></html>`;

  return (
    <View style={{ backgroundColor: theme.panel, borderColor: theme.line, borderWidth: 1, borderRadius: 18, padding: 16 }}>
      {block.title && (
        <Text style={{ color: theme.muted, fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 10 }}>
          {block.title}
        </Text>
      )}
      <View style={{ height: 90, borderRadius: 12, overflow: "hidden", backgroundColor: "#05080f" }}>
        <WebView
          originWhitelist={["*"]}
          source={{ html }}
          scrollEnabled={false}
          style={{ backgroundColor: "transparent" }}
        />
      </View>
      {block.explanation && (
        <Text style={{ color: theme.muted, fontSize: 13, lineHeight: 19, marginTop: 8 }}>{block.explanation}</Text>
      )}
    </View>
  );
}
