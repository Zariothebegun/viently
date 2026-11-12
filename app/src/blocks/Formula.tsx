import katex from "katex";
import "katex/dist/katex.min.css";
import type { Block } from "../schema";

export function FormulaBlockView({ block }: { block: Extract<Block, { type: "formula" }> }) {
  const html = katex.renderToString(block.latex, { throwOnError: false, displayMode: true });
  return (
    <section className="block">
      {block.title && <h3 className="block-title">{block.title}</h3>}
      <div className="formula" dangerouslySetInnerHTML={{ __html: html }} />
      {block.explanation && <p className="formula-note">{block.explanation}</p>}
    </section>
  );
}
