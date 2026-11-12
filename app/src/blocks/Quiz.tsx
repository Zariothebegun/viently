import { useState } from "react";
import type { Block } from "../schema";

export function QuizBlockView({ block }: { block: Extract<Block, { type: "quiz" }> }) {
  const [picked, setPicked] = useState<number | null>(null);
  const done = picked !== null;
  const right = picked === block.answerIndex;

  return (
    <section className="block quiz">
      <h3 className="block-title">{block.title ?? "Verifica"}</h3>
      <p className="q">{block.question}</p>
      <div className="options">
        {block.options.map((o, i) => {
          const cls =
            done && i === block.answerIndex ? "opt right" : done && i === picked ? "opt wrong" : "opt";
          return (
            <button key={i} className={cls} disabled={done} onClick={() => setPicked(i)}>
              {o}
            </button>
          );
        })}
      </div>
      {done && (
        <div className={"feedback " + (right ? "ok" : "bad")}>
          {right ? "Certo. " : "Não é essa. "}
          {block.explanation}
        </div>
      )}
    </section>
  );
}
