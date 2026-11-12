import type { Block } from "../schema";

export function CardBlockView({ block }: { block: Extract<Block, { type: "card" }> }) {
  return (
    <section className="block">
      <h3 className="block-title">{block.title}</h3>
      <div className="cards">
        {block.items.map((it, i) => (
          <div className="card" key={i}>
            <div className="term">{it.term}</div>
            <div className="def">{it.definition}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
