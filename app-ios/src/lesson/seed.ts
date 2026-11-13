import type { Lesson } from "../board/ops";

// Aula-semente escrita à mão em ops de quadro. Serve para a página ter
// conteúdo real antes de existir chave de API. Não é gerada por modelo.
// É UMA página inteira, como as que o modelo passa a devolver.
export const seedLesson: Lesson = {
  title: "Mitose humana",
  subtitle: "Uma célula do corpo origina duas células com o mesmo ADN.",
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
      say: "Numa célula do corpo humano, o ADN duplica-se antes da divisão. Durante a mitose, as cópias são separadas e distribuídas. No fim, formam-se duas células com 46 cromossomas cada.",
      write:
        "1. ADN duplicado: antes da mitose, cada cromossoma fica com duas cópias ligadas.\n2. Separação: as cópias são puxadas para lados opostos da célula.\n3. Resultado: cada célula-filha recebe 46 cromossomas, como a célula humana inicial.",
      board: [
        { op: "model3d", model: "cell", at: [8, 3], w: 52, h: 39, title: "Célula animal" },
        {
          op: "notes",
          at: [67, 5],
          title: "Fases",
          lines: ["ADN condensa", "cromossomas alinham", "cópias separam", "célula divide"],
        },
        { op: "text", text: "1 célula-mãe", at: [4, 54], size: "m", color: "ink" },
        { op: "arrow", from: [30, 56], to: [47, 56], label: "divide-se" },
        { op: "text", text: "2 células-filhas", at: [50, 54], size: "m", color: "green" },
        {
          op: "text",
          text: "46 em cada (célula humana)",
          at: [4, 66],
          size: "m",
          color: "gray",
        },
      ],
    },
  ],
};
