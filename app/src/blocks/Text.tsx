import type { Block } from "../schema";

function md(s: string) {
  const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br/>");
}

export function TextBlockView({ block }: { block: Extract<Block, { type: "text" }> }) {
  return (
    <article className="block text-block">
      {block.title && <h2>{block.title}</h2>}
      <p dangerouslySetInnerHTML={{ __html: md(block.markdown) }} />
    </article>
  );
}
