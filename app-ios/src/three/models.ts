// Registo dos modelos 3D que existem de facto na cena.
// O modelo de linguagem só pode pedir estes; o resto é descartado.
export type ModelId = "cell" | "motor" | "atom" | "ram" | "bit";

export const MODELS: Record<ModelId, { title: string; hint: string; when: string }> = {
  cell: {
    title: "Célula animal",
    hint: "toca numa parte para saber o que faz",
    when: "célula, organelos, membrana, núcleo, mitocôndria",
  },
  motor: {
    title: "Motor eléctrico",
    hint: "arrasta para rodar, explode para ver por dentro",
    when: "motor, estator, rotor, electroíman, corrente, máquinas",
  },
  atom: {
    title: "Átomo",
    hint: "camadas electrónicas à volta do núcleo",
    when: "átomo, electrões, camadas, núcleo atómico, química",
  },
  ram: {
    title: "Memória RAM",
    hint: "chips, contactos e o entalhe que a orienta",
    when: "RAM, memória, chips, DDR, placa-mãe, computador, SSD, dados",
  },
  bit: {
    title: "1 bit de DRAM",
    hint: "um transístor e um condensador a guardar 0 ou 1",
    when: "bit, DRAM, transístor, condensador, carga, refresh, memória",
  },
};

export const MODEL_IDS = Object.keys(MODELS) as ModelId[];

export function isModelId(v: unknown): v is ModelId {
  return typeof v === "string" && (MODEL_IDS as string[]).includes(v);
}
