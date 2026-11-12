import type { Block } from "./schema";

export type Narration = { stop: () => void };

function pickVoice(): SpeechSynthesisVoice | undefined {
  const vs = window.speechSynthesis?.getVoices?.() ?? [];
  return (
    vs.find((v) => v.lang === "pt-PT") ??
    vs.find((v) => v.lang === "pt-BR") ??
    vs.find((v) => v.lang.startsWith("pt"))
  );
}

/** Narra a aula e revela cada bloco quando a sua fala começa. */
export function narrate(blocks: Block[], onReveal: (n: number) => void): Narration {
  const synth = window.speechSynthesis;
  if (!synth) {
    blocks.forEach((_, i) => setTimeout(() => onReveal(i + 1), i * 1800));
    return { stop: () => {} };
  }

  synth.cancel();
  const voice = pickVoice();
  let stopped = false;

  blocks.forEach((b, i) => {
    const text = b.say ?? ("title" in b && b.title ? b.title : "");
    const u = new SpeechSynthesisUtterance(text || "…");
    u.lang = voice?.lang ?? "pt-PT";
    if (voice) u.voice = voice;
    u.rate = 1;
    u.pitch = 1;
    u.onstart = () => {
      if (!stopped) onReveal(i + 1);
    };
    synth.speak(u);
  });

  return {
    stop: () => {
      stopped = true;
      synth.cancel();
    },
  };
}

export function stopNarration() {
  window.speechSynthesis?.cancel();
}
