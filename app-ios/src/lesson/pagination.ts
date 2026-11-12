// Divide texto de ensino em páginas sem descartar frases nem cortar palavras.
const DEFAULT_PAGE_CHARS = 210;

export function paginateLessonText(value: string, maxChars = DEFAULT_PAGE_CHARS): string[] {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  const limit = Math.max(40, Math.floor(Number.isFinite(maxChars) ? maxChars : DEFAULT_PAGE_CHARS));
  if (!text) return [];

  const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [text];
  const pages: string[] = [];
  let current = "";

  const flush = () => {
    if (current.trim()) pages.push(current.trim());
    current = "";
  };

  for (const rawSentence of sentences) {
    const sentence = rawSentence.trim();
    if (!sentence) continue;
    if (sentence.length > limit) {
      flush();
      let fragment = "";
      for (const word of sentence.split(/\s+/)) {
        if (word.length > limit) {
          if (fragment) {
            pages.push(fragment);
            fragment = "";
          }
          for (let i = 0; i < word.length; i += limit) {
            pages.push(word.slice(i, i + limit));
          }
          continue;
        }
        const candidate = fragment ? `${fragment} ${word}` : word;
        if (candidate.length > limit) {
          if (fragment) pages.push(fragment);
          fragment = word;
        } else {
          fragment = candidate;
        }
      }
      current = fragment;
      continue;
    }

    const candidate = current ? `${current} ${sentence}` : sentence;
    if (candidate.length > limit) {
      flush();
      current = sentence;
    } else {
      current = candidate;
    }
  }
  flush();
  return pages;
}
