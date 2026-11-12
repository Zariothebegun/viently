import type { Lesson } from "../schema";

export const mitose: Lesson = {
  lessonTitle: "Divisão celular: a mitose",
  level: "medio",
  blocks: [
    {
      id: "b1",
      type: "text",
      title: "O que é a mitose",
      say: "A mitose é o processo pelo qual uma célula-mãe duplica o material genético e origina duas células-filhas geneticamente idênticas.",
      markdown:
        "A **mitose** é o processo pelo qual uma célula-mãe diploide duplica o material genético e origina **duas células-filhas geneticamente idênticas**.\n\nNos seres pluricelulares garante o crescimento dos tecidos e a substituição contínua de células envelhecidas ou danificadas.",
    },
    {
      id: "b2",
      type: "model3d",
      title: "Célula animal — toca nos pontos",
      assetId: "cell-animal",
      say: "Roda a célula com o dedo e toca nos pontos para saberes o que faz cada estrutura.",
      hotspots: [
        { id: "nucleo", label: "Núcleo e ADN", description: "Invólucro nuclear que se desorganiza na prófase para permitir a migração dos cromossomas.", position: [0, 0.35, 0] },
        { id: "centro", label: "Centrossomas", description: "Pares de centríolos que migram para os polos opostos e organizam o fuso mitótico.", position: [-0.75, 0.55, 0.2] },
        { id: "membrana", label: "Membrana celular", description: "Zona onde ocorre o estrangulamento final da citocinese.", position: [0.9, -0.5, 0.3] },
      ],
    },
    {
      id: "b3",
      type: "diagram",
      title: "As fases, por ordem",
      kind: "cycle",
      say: "Prófase, metáfase, anáfase, telófase e por fim a citocinese.",
      nodes: [
        { id: "p", label: "Prófase", detail: "Condensação da cromatina e formação do fuso" },
        { id: "m", label: "Metáfase", detail: "Cromossomas alinhados na placa equatorial" },
        { id: "a", label: "Anáfase", detail: "Separação dos cromatídeos para polos opostos" },
        { id: "t", label: "Telófase", detail: "Descondensação e reconstituição dos núcleos" },
        { id: "c", label: "Citocinese", detail: "Divisão física do citoplasma" },
      ],
      edges: [
        { from: "p", to: "m" },
        { from: "m", to: "a" },
        { from: "a", to: "t" },
        { from: "t", to: "c" },
        { from: "c", to: "p" },
      ],
    },
    {
      id: "b4",
      type: "card",
      title: "Vocabulário essencial",
      say: "Guarda estes três termos: cromatídeos-irmãos, fuso acromático e placa equatorial.",
      items: [
        { term: "Cromatídeos-irmãos", definition: "Duas réplicas idênticas de ADN unidas pelo centrómero, após a fase S." },
        { term: "Fuso acromático", definition: "Rede de microtúbulos que orienta e puxa os cromossomas na anáfase." },
        { term: "Placa equatorial", definition: "Alinhamento dos centrómeros no centro da célula, na metáfase." },
      ],
    },
    {
      id: "b5",
      type: "chart",
      title: "Duração típica de cada fase",
      chart: "bar",
      yLabel: "minutos",
      say: "Repara que a anáfase é a fase mais rápida de todas.",
      series: [
        {
          label: "min",
          data: [
            { x: "Prófase", y: 45 },
            { x: "Metáfase", y: 25 },
            { x: "Anáfase", y: 8 },
            { x: "Telófase", y: 20 },
          ],
        },
      ],
    },
    {
      id: "b6",
      type: "quiz",
      title: "Verifica",
      question: "Em que fase se separam os cromatídeos-irmãos para lados opostos da célula?",
      options: ["Prófase", "Metáfase", "Anáfase", "Telófase"],
      answerIndex: 2,
      explanation: "Na anáfase os centrómeros rompem-se e cada cromatídeo migra para um dos polos.",
    },
  ],
  suggestedNext: ["O que é a meiose?", "Porque é que as células se dividem?", "O que acontece se a mitose correr mal?"],
};
