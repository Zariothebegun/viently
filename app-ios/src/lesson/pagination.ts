// Paginação estrutural: preserva linhas, listas e parágrafos; só divide texto
// corrido quando é demasiado longo para uma página.
const DEFAULT_PAGE_CHARS = 210;

function splitLongLine(value: string, limit: number): string[] {
  const line = value.trim();
  if (!line) return [];
  if (line.length <= limit) return [line];

  const sentences = line.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [line];
  const chunks: string[] = [];
  let current = "";

  const flush = () => {
    if (current.trim()) chunks.push(current.trim());
    current = "";
  };

  for (const raw of sentences) {
    const sentence = raw.trim();
    if (!sentence) continue;
    const candidate = current ? `${current} ${sentence}` : sentence;
    if (candidate.length <= limit) {
      current = candidate;
      continue;
    }
    flush();
    if (sentence.length <= limit) {
      current = sentence;
      continue;
    }

    let fragment = "";
    for (const word of sentence.split(/\s+/)) {
      if (word.length > limit) {
        flush();
        if (fragment) chunks.push(fragment);
        fragment = "";
        for (let i = 0; i < word.length; i += limit) {
          chunks.push(word.slice(i, i + limit));
        }
        continue;
      }
      const next = fragment ? `${fragment} ${word}` : word;
      if (next.length > limit) {
        if (fragment) chunks.push(fragment);
        fragment = word;
      } else {
        fragment = next;
      }
    }
    current = fragment;
  }
  flush();
  return chunks;
}

export function paginateLessonText(value: string, maxChars = DEFAULT_PAGE_CHARS): string[] {
  const source = String(value ?? "").replace(/\r\n?/g, "\n").trim();
  const limit = Math.max(40, Math.floor(Number.isFinite(maxChars) ? maxChars : DEFAULT_PAGE_CHARS));
  if (!source) return [];

  const pages: string[] = [];
  let current = "";

  const flush = () => {
    if (current.trim()) pages.push(current.trim());
    current = "";
  };

  for (const rawLine of source.split("\n")) {
    const line = rawLine.trim();
    if (!line) {
      if (current && !current.endsWith("\n")) current += "\n";
      continue;
    }

    const pieces = splitLongLine(line, limit);
    for (const piece of pieces) {
      const candidate = current ? `${current.replace(/\n+$/, "")}\n${piece}` : piece;
      if (candidate.length > limit) {
        flush();
        current = piece;
      } else {
        current = candidate;
      }
    }
  }
  flush();
  return pages;
}
