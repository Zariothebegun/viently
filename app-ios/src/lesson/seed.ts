import type { Lesson } from "../board/ops";

// Aula-semente escrita à mão em ops de quadro. Serve para a página ter
// conteúdo real antes de existir chave de API. Não é gerada por modelo.
// É UMA página inteira, como as que o modelo passa a devolver.
export const seedLesson: Lesson = {
  title: "Mitose",
  subtitle: "Uma célula divide-se em duas iguais",
  suggestions: ["Ver as fases", "Mitose ou meiose?"],
  check: {
    prompt: "O que acontece ao ADN antes de a célula se dividir?",
    options: ["Duplica-se", "Desaparece", "Divide-se ao meio"],
    answer_index: 0,
    explanation:
      "O ADN duplica antes da mitose para que cada célula-filha receba uma cópia completa.",
  },
  steps: [
    {
      say: "A mitose é o processo pelo qual uma célula se divide em duas células iguais. Antes de começar, o ADN duplica-se, para que cada célula-filha receba uma cópia completa. Toca na célula para a rodares e veres as partes por dentro.",
      write:
        "1. A mitose divide uma célula em duas iguais.\n2. O ADN duplica-se antes de a célula se dividir.\n3. Cada célula-filha recebe 46 cromossomas.",
      board: [
        { op: "model3d", model: "cell", at: [2, 1], w: 58, h: 44, title: "Célula animal" },
        {
          op: "notes",
          at: [67, 5],
          title: "Fases",
          lines: ["prófase", "metáfase", "anáfase", "telófase"],
        },
        { op: "text", text: "1 célula-mãe", at: [4, 54], size: "m", color: "ink" },
        { op: "arrow", from: [30, 56], to: [47, 56], label: "divide-se" },
        { op: "text", text: "2 células-filhas", at: [50, 54], size: "m", color: "green" },
        {
          op: "text",
          text: "46 cromossomas em cada uma",
          at: [4, 66],
          size: "m",
          color: "gray",
        },
      ],
    },
  ],
};
