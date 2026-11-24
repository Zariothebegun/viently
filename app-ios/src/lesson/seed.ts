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
        {
          op: "model3d",
          model: "shapes",
          at: [8, 3],
          w: 52,
          h: 39,
          title: "Célula animal",
          shapes: {
            camera: "iso",
            ground: false,
            caption: "O núcleo guarda o ADN que vai ser duplicado.",
            objects: [
              { id: "membrana", shape: "sphere", pos: [0,0,0], size: [2.6,2.6,2.6], rot: [0,0,0], color: "gray", opacity: 0.2, wire: false, label: "membrana", note: "Envolve a célula e controla o que entra e sai." },
              { id: "nucleo", shape: "sphere", pos: [0.2,0.15,0], size: [1.1,1.1,1.1], rot: [0,0,0], color: "purple", opacity: 1, wire: false, label: "núcleo", note: "Guarda o ADN e duplica-o antes da divisão." },
              { id: "nucleolo", shape: "sphere", pos: [0.5,0.38,0.2], size: [0.34,0.34,0.34], rot: [0,0,0], color: "red", opacity: 1, wire: false },
              { id: "adn", shape: "torus", pos: [0.2,0.15,0], size: [0.8,0.8,0.8], rot: [72,12,0], color: "ink", opacity: 1, wire: false, label: "ADN", note: "Cada cromossoma ganha uma cópia ligada antes da mitose." },
              { id: "mito1", shape: "capsule", pos: [-1.2,-0.55,0.55], size: [0.36,0.9,0.36], rot: [0,0,28], color: "orange", opacity: 1, wire: false, label: "mitocôndria", note: "Produz a energia que a divisão vai gastar." },
              { id: "mito2", shape: "capsule", pos: [-1.05,0.75,-0.5], size: [0.32,0.8,0.32], rot: [0,0,-22], color: "orange", opacity: 1, wire: false },
              { id: "mito3", shape: "capsule", pos: [1.15,-0.7,-0.55], size: [0.3,0.75,0.3], rot: [0,0,-14], color: "orange", opacity: 1, wire: false },
              { id: "vesic1", shape: "sphere", pos: [-0.9,0.95,0.7], size: [0.24,0.24,0.24], rot: [0,0,0], color: "green", opacity: 1, wire: false },
              { id: "vesic2", shape: "sphere", pos: [1.35,0.55,0.6], size: [0.2,0.2,0.2], rot: [0,0,0], color: "green", opacity: 1, wire: false },
              { id: "vesic3", shape: "sphere", pos: [0.95,1.05,-0.7], size: [0.22,0.22,0.22], rot: [0,0,0], color: "green", opacity: 1, wire: false },
            ],
            captions: [{ at_ms: 0, text: "O núcleo guarda o ADN" }, { at_ms: 1800, text: "As cópias separam-se" }] as any,
            anims: [
              { type: "pulse", target: "nucleo", amp: 0.06, speed: 0.35, at_ms: 0, duration_ms: 0, loop: true },
              { type: "spin", target: "adn", axis: "y", speed: 0.18, at_ms: 0, duration_ms: 0, loop: true },
            ] as any,
          },
        },
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
