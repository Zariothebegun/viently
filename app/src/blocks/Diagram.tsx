import { useState } from "react";
import type { Block } from "../schema";

export function DiagramBlockView({ block }: { block: Extract<Block, { type: "diagram" }> }) {
  const [open, setOpen] = useState<string | null>(null);
  const vertical = block.kind !== "compare";

  return (
    <section className="block">
      <h3 className="block-title">{block.title}</h3>
      <div className={vertical ? "flow" : "compare-grid"}>
        {block.nodes.map((n, i) => (
          <div key={n.id} className="node-wrap">
            <button
              className={"node " + (open === n.id ? "open" : "")}
              onClick={() => setOpen(open === n.id ? null : n.id)}
            >
              <span className="node-num">{i + 1}</span>
              <span className="node-label">{n.label}</span>
            </button>
            {open === n.id && n.detail && <p className="node-detail">{n.detail}</p>}
            {vertical && i < block.nodes.length - 1 && <div className="arrow" aria-hidden="true" />}
          </div>
        ))}
      </div>
      {block.kind === "cycle" && <div className="axis-note">ciclo: o último passo volta ao primeiro</div>}
    </section>
  );
}
