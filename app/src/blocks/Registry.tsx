import type { Block } from "../schema";
import { TextBlockView } from "./Text";
import { CardBlockView } from "./Cards";
import { ChartBlockView } from "./Chart";
import { DiagramBlockView } from "./Diagram";
import { FormulaBlockView } from "./Formula";
import { Model3DBlockView } from "./Model3D";
import { QuizBlockView } from "./Quiz";

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
      return <Model3DBlockView block={block} />;
    case "quiz":
      return <QuizBlockView block={block} />;
    default:
      return null;
  }
}
