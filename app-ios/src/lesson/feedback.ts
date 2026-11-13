import type { Check } from "../board/ops";

export type LessonMessage = {
  role: "user" | "assistant";
  content: string;
};

/**
 * Adds the learner's selected answer and the tutor's feedback to lesson history.
 * Returns null for an invalid or incomplete answer so callers cannot record
 * impossible quiz states.
 */
export function recordCheckAnswer(
  history: LessonMessage[],
  check: Check,
  selectedIndex: number,
): LessonMessage[] | null {
  if (
    !Number.isInteger(selectedIndex) ||
    selectedIndex < 0 ||
    selectedIndex >= check.options.length ||
    !check.options[selectedIndex]
  ) {
    return null;
  }

  const correct = selectedIndex === check.answer_index;
  const selected = check.options[selectedIndex];
  const explanation = String(check.explanation ?? "").replace(/\s+/g, " ").trim();

  return [
    ...history,
    {
      role: "user",
      content: `No teste "${check.prompt}", escolhi "${selected}".`,
    },
    {
      role: "assistant",
      content: `A resposta estava ${correct ? "correcta" : "incorrecta"}.${explanation ? " " + explanation : ""}`,
    },
  ];
}
