// Paginação estrutural: mantém listas e parágrafos; nunca divide números
// decimais ou abreviaturas por tratar cada ponto como fim de frase.
const DEFAULT_PAGE_CHARS = 210;

export function paginateLessonText(value: string, maxChars = DEFAULT_PAGE_CHARS): string[] {
  const source = String(value ?? "").replace(/\r\n?/g, "\n").trim();
  const limit = Math.max(40, Math.floor(Number.isFinite(maxChars) ? maxChars : DEFAULT_PAGE_CHARS));
  if (!source) return [];

  const pages: string[] = [];
  let current = "";
  let blankBeforeNextLine = false;

  const flush = () => {
    if (current.trim()) pages.push(current.trim());
    current = "";
  };

  for (const rawLine of source.split("\n")) {
    const words = rawLine.trim().split(/\s+/).filter(Boolean);
    if (!words.length) {
      if (current) blankBeforeNextLine = true;
      continue;
    }

    let firstWord = true;
    for (const word of words) {
      const chars = Array.from(word);
      if (chars.length > limit) {
        flush();
        for (let i = 0; i < chars.length; i += limit) {
          pages.push(chars.slice(i, i + limit).join(""));
        }
        firstWord = false;
        blankBeforeNextLine = false;
        continue;
      }

      const separator = !current
        ? ""
        : firstWord
          ? (blankBeforeNextLine ? "\n\n" : "\n")
          : " ";
      const candidate = current ? `${current}${separator}${word}` : word;
      if (candidate.length > limit) {
        flush();
        current = word;
      } else {
        current = candidate;
      }
      firstWord = false;
      blankBeforeNextLine = false;
    }
  }

  flush();
  return pages;
}
