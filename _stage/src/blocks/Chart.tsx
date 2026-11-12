import { Text, View } from "react-native";
import Svg, { G, Rect, Text as SvgText } from "react-native-svg";
import { theme } from "../theme";
import type { Block } from "../schema";

const COLORS = ["#3ee0c0", "#7aa2ff", "#ffb86b", "#ff7a90", "#b98bff"];

export function ChartBlockView({ block }: { block: Extract<Block, { type: "chart" }> }) {
  const data = block.series[0].data.map((d) => ({ name: String(d.x), value: d.y }));
  const max = Math.max(...data.map((d) => d.value), 1);
  const W = 300;
  const H = 180;
  const padB = 34;
  const padT = 10;
  const slot = W / data.length;
  const barW = Math.min(slot * 0.6, 46);

  return (
    <View style={{ backgroundColor: theme.panel, borderColor: theme.line, borderWidth: 1, borderRadius: 18, padding: 16 }}>
      <Text style={{ color: theme.muted, fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 10 }}>
        {block.title}
      </Text>

      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        <Rect x={0} y={H - padB} width={W} height={1} fill="#ffffff20" />
        {data.map((d, i) => {
          const h = Math.max(((d.value / max) * (H - padB - padT)) | 0, 2);
          const x = i * slot + (slot - barW) / 2;
          return (
            <G key={i}>
              <Rect x={x} y={H - padB - h} width={barW} height={h} rx={6} fill={COLORS[i % COLORS.length]} />
              <SvgText x={i * slot + slot / 2} y={H - 12} fontSize="9" fill={theme.muted} textAnchor="middle">
                {d.name.slice(0, 9)}
              </SvgText>
            </G>
          );
        })}
      </Svg>
      {block.yLabel && <Text style={{ color: theme.muted, fontSize: 11, marginTop: 4 }}>unidade: {block.yLabel}</Text>}
    </View>
  );
}
