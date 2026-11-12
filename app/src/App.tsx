import { useEffect, useRef, useState } from "react";
import { BlockRenderer } from "./blocks/Registry";
import { mitose } from "./data/mitose";
import { askTutor, getKey, setKey, type Msg } from "./llm";
import type { Lesson } from "./schema";
import { narrate, stopNarration } from "./voice";

export default function App() {
  const [lesson, setLesson] = useState<Lesson>(mitose);
  const [revealed, setRevealed] = useState(() =>
    new URLSearchParams(location.search).has("full") ? mitose.blocks.length : 1,
  );
  const [playing, setPlaying] = useState(false);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [hasKey, setHasKey] = useState(!!getKey());
  const [showKey, setShowKey] = useState(false);
  const [history, setHistory] = useState<Msg[]>([]);
  const stopRef = useRef<(() => void) | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => () => stopRef.current?.(), []);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [revealed]);

  function play() {
    stopNarration();
    setRevealed(0);
    setPlaying(true);
    const n = narrate(lesson.blocks, (k) => setRevealed(k));
    stopRef.current = () => {
      n.stop();
      setPlaying(false);
    };
  }

  function stop() {
    stopRef.current?.();
    stopNarration();
    setPlaying(false);
    setRevealed(lesson.blocks.length);
  }

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    const text = q.trim();
    if (!text || busy) return;
    setQ("");
    setErr(null);

    if (!hasKey) {
      // modo demonstração: sem chave, mostra a aula de exemplo
      stop();
      setLesson(mitose);
      setRevealed(1);
      setErr("Sem chave OpenRouter: a mostrar a aula de demonstração. Adiciona a chave em ⚙︎.");
      return;
    }

    setBusy(true);
    stopNarration();
    try {
      const next = await askTutor(text, history);
      setLesson(next);
      setHistory((h) => [...h, { role: "user", content: text }, { role: "assistant", content: JSON.stringify(next) }]);
      setRevealed(0);
      const n = narrate(next.blocks, (k) => setRevealed(k));
      stopRef.current = () => n.stop();
      setPlaying(true);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function saveKey(v: string) {
    setKey(v);
    setHasKey(true);
    setShowKey(false);
    setErr(null);
  }

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <span className="dot" />
          <strong>Viently</strong>
        </div>
        <div className="top-actions">
          <button className="ghost" onClick={() => setShowKey((s) => !s)} aria-label="Definições">
            ⚙︎
          </button>
        </div>
      </header>

      {showKey && (
        <form
          className="keybar"
          onSubmit={(e) => {
            e.preventDefault();
            const v = new FormData(e.currentTarget).get("k");
            if (typeof v === "string" && v.trim()) saveKey(v);
          }}
        >
          <input name="k" type="password" placeholder="chave OpenRouter (sk-or-…)" autoComplete="off" />
          <button type="submit">Guardar</button>
          <span className="tiny">guardada só neste navegador</span>
        </form>
      )}

      <main className="lesson">
        <div className="lesson-head">
          <span className="chip">{lesson.level}</span>
          <h1>{lesson.lessonTitle}</h1>
        </div>

        {lesson.blocks.slice(0, Math.max(revealed, 0)).map((b) => (
          <div className="block-in" key={b.id}>
            <BlockRenderer block={b} />
          </div>
        ))}
        <div ref={endRef} />
      </main>

      {err && <div className="err">{err}</div>}

      <div className="controls">
        <button className="play" onClick={playing ? stop : play}>
          {playing ? "■ Parar" : revealed >= lesson.blocks.length ? "↻ Repetir" : "▶ Ouvir a aula"}
        </button>
        <button
          className="subtle"
          onClick={() => setRevealed(lesson.blocks.length)}
          disabled={revealed >= lesson.blocks.length}
        >
          Mostrar tudo
        </button>
        <span className="counter">
          {Math.min(revealed, lesson.blocks.length)}/{lesson.blocks.length}
        </span>
      </div>

      <form className="composer" onSubmit={submit}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={busy ? "A pensar…" : "Pergunta ao Viently…"}
          disabled={busy}
          enterKeyHint="send"
        />
        <button type="submit" disabled={busy || !q.trim()} aria-label="Enviar">
          {busy ? "…" : "↑"}
        </button>
      </form>
    </div>
  );
}
