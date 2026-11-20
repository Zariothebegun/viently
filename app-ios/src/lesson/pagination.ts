// Paginação estrutural: mantém listas e parágrafos; nunca divide números
// decimais ou abreviaturas por tratar cada ponto como fim de frase.
const DEFAULT_PAGE_CHARS = 165;

// Corta no fim da última frase que ainda caiba na página. Sem isto o texto
// era partido a meio de uma ideia e a página seguinte começava a meio.
function lastSentenceEnd(text: string, minimum: number): number {
  for (let i = text.length - 1; i >= minimum; i--) {
    const ch = text[i];
    if (ch !== "." && ch !== "!" && ch !== "?" && ch !== "…") continue;
    const next = text[i + 1];
    if (next !== undefined && next !== " ") continue;
    // "3.5" ou "3." (marcador de lista) não são fim de frase
    const prev = text[i - 1] ?? "";
    if (/\d/.test(prev) && /\d/.test(text[i + 2] ?? "")) continue;
    if (/^\d+$/.test(text.slice(0, i).split(/[\s\n]/).pop() ?? "")) continue;
    if (i === text.length - 1) return i + 1;
    return i + 1;
  }
  return -1;
}

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
        const cut = lastSentenceEnd(current, Math.floor(limit * 0.45));
        if (cut > 0 && cut < current.length) {
          pages.push(current.slice(0, cut).trim());
          current = `${current.slice(cut).trim()} ${word}`.trim();
        } else {
          flush();
          current = word;
        }
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
