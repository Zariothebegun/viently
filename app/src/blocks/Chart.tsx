import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Block } from "../schema";

const COLORS = ["#3ee0c0", "#7aa2ff", "#ffb86b", "#ff7a90", "#b98bff"];

export function ChartBlockView({ block }: { block: Extract<Block, { type: "chart" }> }) {
  const s = block.series[0];
  const data = s.data.map((d) => ({ name: String(d.x), value: d.y }));

  return (
    <section className="block">
      <h3 className="block-title">{block.title}</h3>
      <div className="chart">
        <ResponsiveContainer width="100%" height={220}>
          {block.chart === "bar" ? (
            <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff14" />
              <XAxis dataKey="name" tick={{ fill: "#9aa7c7", fontSize: 11 }} stroke="#ffffff20" />
              <YAxis tick={{ fill: "#9aa7c7", fontSize: 11 }} stroke="#ffffff20" />
              <Tooltip contentStyle={{ background: "#131a2e", border: "1px solid #ffffff20", borderRadius: 10 }} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          ) : block.chart === "line" ? (
            <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff14" />
              <XAxis dataKey="name" tick={{ fill: "#9aa7c7", fontSize: 11 }} stroke="#ffffff20" />
              <YAxis tick={{ fill: "#9aa7c7", fontSize: 11 }} stroke="#ffffff20" />
              <Tooltip contentStyle={{ background: "#131a2e", border: "1px solid #ffffff20", borderRadius: 10 }} />
              <Line type="monotone" dataKey="value" stroke="#3ee0c0" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          ) : block.chart === "pie" ? (
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" outerRadius={80}>
                {data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: "#131a2e", border: "1px solid #ffffff20", borderRadius: 10 }} />
            </PieChart>
          ) : (
            <ScatterChart margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff14" />
              <XAxis dataKey="value" tick={{ fill: "#9aa7c7", fontSize: 11 }} stroke="#ffffff20" />
              <YAxis tick={{ fill: "#9aa7c7", fontSize: 11 }} stroke="#ffffff20" />
              <Tooltip contentStyle={{ background: "#131a2e", border: "1px solid #ffffff20", borderRadius: 10 }} />
              <Scatter data={data} fill="#7aa2ff" />
            </ScatterChart>
          )}
        </ResponsiveContainer>
      </div>
      {block.yLabel && <div className="axis-note">unidade: {block.yLabel}</div>}
    </section>
  );
}
