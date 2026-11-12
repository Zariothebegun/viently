import {
  GochiHand_400Regular,
  useFonts,
} from "@expo-google-fonts/gochi-hand";
import {
  Quicksand_400Regular,
  Quicksand_500Medium,
  Quicksand_600SemiBold,
  Quicksand_700Bold,
} from "@expo-google-fonts/quicksand";
import { LinearGradient } from "expo-linear-gradient";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { Board } from "./src/board/Board";
import { applyOps, opBBox } from "./src/board/layout";
import type { Check, Item, Lesson, Op, Step } from "./src/board/ops";
import { generateLesson, DEFAULT_MODEL } from "./src/lesson/generate";
import { defaultKey, loadKey, looksLikeKey, saveKey } from "./src/lesson/key";
import { seedLesson } from "./src/lesson/seed";
import { Model3D } from "./src/three/Model3D";
import { LiveModel, type ModelOp, type ModelOpen } from "./src/three/LiveModel";
import { MODELS } from "./src/three/scene";

const INK = "#26334b";
const BODY = "#46536a";
const MUTED = "#858fa1";
const MINT = "#5878bd";
const HAIR = "rgba(47,62,88,0.12)";
const HAND = "GochiHand_400Regular";
const QUICK = "Quicksand_400Regular";
const HEAD_H = 116;
const TITLE_MS_PER_CHAR = 12;

type Msg = { role: "user" | "assistant"; content: string };

type BasePage = {
  id: string;
  kind: "hero" | "step" | "load";
  root: string;
  depth: number;
  history: Msg[];
  items: Item[];
  newIds: string[];
  suggestions: string[];
  state: "idle" | "loading" | "drawing" | "done" | "error";
  error?: string;
};

type HeroPage = BasePage & { kind: "hero" };

type LoadPage = BasePage & {
  kind: "load";
  question: string;
};

type StepPage = BasePage & {
  kind: "step";
  title: string;
  subtitle?: string;
  stepIndex: number;
  stepCount: number;
  say: string;
  line: string;
  recap?: { title: string; lines: string[] };
  numbers?: { label: string; value: string }[];
  example?: string;
  mistake?: { wrong: string; right: string };
  check?: Check;
  answered?: number;
  quizOnly?: boolean;
};

type Page = HeroPage | StepPage | LoadPage;

type Geom = {
  w: number;
  h: number;
  bw: number;
  bh: number;
  boardX: number;
  boardY: number;
};

type Live = {
  pageId: string;
  items: Item[];
  starts: number[];
  durs: number[];
} | null;

const HERO: HeroPage = {
  id: "hero",
  kind: "hero",
  root: "viently",
  depth: 0,
  history: [],
  items: [],
  newIds: [],
  suggestions: [],
  state: "done",
};

let pageSeq = 1;
function newPageId(): string {
  pageSeq += 1;
  return `p${Date.now().toString(36)}-${pageSeq}`;
}

function topicFrom(question: string): string {
  const t = question.replace(/\s+/g, " ").trim();
  return t.length > 42 ? `${t.slice(0, 40).trimEnd()}…` : t;
}

function writeOf(step: Step): string {
  const w = (step.write ?? "")
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .split("\n")
    .slice(0, 3)
    .map((line) => line.length > 74 ? `${line.slice(0, 70).trimEnd()}…` : line)
    .join("\n")
    .slice(0, 224);
  if (w) return w;
  const s = (step.say ?? "")
    .replace(/^(Olá|Boa tarde|Boa noite|Então|Vamos lá)[^.!?]*[.!?]\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
  return s.slice(0, 220);
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function titleMs(text?: string): number {
  return Math.min(560, 120 + (text ?? "").length * TITLE_MS_PER_CHAR);
}

function geometry(w: number, h: number, hasQuiz: boolean): Geom {
  const bw = Math.min(w - 32, 440);
  // a página é uma só: o quadro pode ocupar mais altura do que quando havia
  // vários passos, sem empurrar a pergunta para fora do ecrã
  const ratio = hasQuiz ? 0.82 : 0.9;
  // O quadro ocupa uma faixa previsível do ecrã; o resto fica para ensinar,
  // sem scroll interno nem conteúdo escondido por baixo do composer.
  const bh = Math.round(Math.min(bw * ratio, h * 0.31));
  const boardX = Math.round((w - bw) / 2);
  const boardY = 6 + HEAD_H;
  return { w, h, bw, bh, boardX, boardY };
}

function boardOps(page: StepPage): Item[] {
  return page.items.filter((it: any) => it.op.op !== "model3d" && it.op.op !== "title");
}

function isTextOp(op: Op): boolean {
  return ["title", "text", "note", "notes", "callout", "dot"].includes(op.op);
}

// ---------------------------------------------------------------------------
// peças visuais

function ChatIcon({ color = MINT, size = 15 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3.2c-4.9 0-8.8 3.3-8.8 7.4 0 2.3 1.3 4.4 3.3 5.8v3.4l3.2-1.7c.7.1 1.5.2 2.3.2 4.9 0 8.8-3.3 8.8-7.4S16.9 3.2 12 3.2Z"
        stroke={color}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      <Circle cx={8.4} cy={10.6} r={1} fill={color} />
      <Circle cx={12} cy={10.6} r={1} fill={color} />
      <Circle cx={15.6} cy={10.6} r={1} fill={color} />
    </Svg>
  );
}

// o texto da lição: cada ponto numerado com o termo em destaque
function NoteText({ text }: { text: string }) {
  const lines = String(text)
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  return (
    <View>
      {lines.map((l, i) => {
        const m = l.match(/^(\d+)\.\s*([^:]{1,40}):\s*(.*)$/);
        if (!m) {
          return (
            <Text key={i} style={s.lineText}>
              {l}
            </Text>
          );
        }
        return (
          <View key={i} style={s.noteRow}>
            <View style={s.noteNum}>
              <Text style={s.noteNumTxt}>{m[1]}</Text>
            </View>
            <Text style={s.noteBody}>
              <Text style={s.noteHead}>{m[2]}: </Text>
              {m[3]}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// números-chave, exemplo, erro comum e resumo: o que faz a página ensinar
function PageCards({ page, compact = false }: { page: StepPage; compact?: boolean }) {
  const hasAny = !!page.recap || !!page.example || !!page.mistake || !!page.numbers?.length;
  if (!hasAny) return null;
  return (
    <View style={s.cards}>
      {!!page.numbers?.length && (
        <View style={s.nums}>
          {page.numbers.slice(0, compact ? 1 : 2).map((n, i) => (
            <View key={i} style={s.numPill}>
              <Text style={s.numLabel}>{n.label}</Text>
              <Text style={s.numValue}>{n.value}</Text>
            </View>
          ))}
        </View>
      )}
      {!!page.example && (
        <Text style={s.cardLine}>
          <Text style={s.cardKey}>Exemplo. </Text>
          {page.example.slice(0, compact ? 90 : 120)}
        </Text>
      )}
      {!compact && !!page.mistake && (
        <Text style={s.cardLine}>
          <Text style={s.cardKey}>Erro comum. </Text>
          {page.mistake.wrong.slice(0, 55)} <Text style={s.cardKey}>Certo: </Text>
          {page.mistake.right.slice(0, 55)}
        </Text>
      )}
      {!!page.recap && (compact || !page.mistake) && (
        <View style={s.recapBox}>
          <Text style={s.recapTitle}>{page.recap.title}</Text>
          {page.recap.lines.slice(0, 1).map((l, i) => (
            <Text key={i} style={s.recapLine}>
              • {l}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

function SuggestionPill({ text, onPress }: { text: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [s.pill, pressed && { transform: [{ scale: 0.985 }] }]}
    >
      <LinearGradient
        colors={["#f5f7fd", "#e8eefb", "#d9e3f7"]}
        locations={[0, 0.5, 1]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.6, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={s.pillIcon}>
        <ChatIcon size={16} />
      </View>
      <Text style={s.pillText} numberOfLines={2}>
        {text}
      </Text>
    </Pressable>
  );
}

function HandHeading({
  title,
  subtitle,
  animate,
}: {
  title: string;
  subtitle?: string;
  animate: boolean;
}) {
  const [n, setN] = useState(animate ? 0 : title.length);

  useEffect(() => {
    if (!animate) {
      setN(title.length);
      return;
    }
    setN(0);
    let i = 0;
    const id = setInterval(() => {
      i = Math.min(title.length, i + 2);
      setN(i);
      if (i >= title.length) clearInterval(id);
    }, 24);
    return () => clearInterval(id);
  }, [title, animate]);

  const done = n >= title.length;
  return (
    <View style={s.headText}>
      <Text style={s.h1} numberOfLines={2}>
        {animate ? title.slice(0, n) : title}
      </Text>
      {!!subtitle && (
        <Text style={[s.sub, !done && { opacity: 0 }]} numberOfLines={2}>
          {subtitle}
        </Text>
      )}
    </View>
  );
}

const PagePaper = memo(function PagePaper() {
  return (
    <>
      <LinearGradient
        colors={["#faf8f1", "#faf9f6", "#f0f1f5"]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />
      <Image
        source={require("./assets/paper.png")}
        style={[StyleSheet.absoluteFill, { opacity: 0.48 }]}
        resizeMode="repeat"
        pointerEvents="none"
      />
    </>
  );
});

// Páginas que estão só à espera do gesto: desenho já completo, sem animação.
// Ficam memorizadas para o ticker da página activa não as redesenhar.
const StaticStep = memo(
  function StaticStep({ page, w, h }: { page: StepPage; w: number; h: number }) {
    const g = geometry(w, h, !!page.check);
    return (
      <View style={{ height: h }}>
        <PagePaper />
        <View style={[s.headBlock, { height: HEAD_H }]}>
          <Text style={s.h1} numberOfLines={2}>
            {page.title}
          </Text>
          {!!page.subtitle && (
            <Text style={s.sub} numberOfLines={2}>
              {page.subtitle}
            </Text>
          )}
        </View>
        {page.quizOnly ? (
          <View style={[s.quiz, { marginTop: 18 }]}>
            <Text style={s.quizKicker}>pergunta de revisão</Text>
            <Text style={s.quizPrompt}>{page.check?.prompt}</Text>
          </View>
        ) : (
          <>
            <View style={{ width: g.bw, height: g.bh, alignSelf: "center" }}>
              <Board
                ops={boardOps(page)}
                fracOf={() => 1}
                width={g.bw}
                height={g.bh}
                paper={false}
              />
            </View>
            <View style={s.lineBox}>
              {!!page.line && (
                <Text style={s.lineText} numberOfLines={12}>
                  <Text style={s.lineNum}>› </Text>
                  {page.line}
                </Text>
              )}
              <PageCards page={page} />
            </View>
          </>
        )}
      </View>
    );
  },
  (a, b) => a.page === b.page && a.w === b.w && a.h === b.h,
);

// ---------------------------------------------------------------------------

export default function App() {
  const [fontsLoaded] = useFonts({
    GochiHand_400Regular,
    Quicksand_400Regular,
    Quicksand_500Medium,
    Quicksand_600SemiBold,
    Quicksand_700Bold,
  });

  const [pages, setPages] = useState<Page[]>([HERO]);
  const [active, setActive] = useState(0);
  const [layout, setLayout] = useState({ w: 390, h: 700 });
  const [live, setLive] = useState<Live>(null);
  const [tick, setTick] = useState(0);
  const [lineN, setLineN] = useState(0);
  const [q, setQ] = useState("");
  const [key, setKey] = useState<string | null>(() => defaultKey());
  const [keyOpen, setKeyOpen] = useState(false);
  const [keyDraft, setKeyDraft] = useState("");
  const [askedOnce, setAskedOnce] = useState(false);
  const [modelOpen, setModelOpen] = useState<ModelOpen | null>(null);
  const [activeHotspot, setActiveHotspot] = useState<string | null>(null);

  const pagesRef = useRef<Page[]>(pages);
  const activeRef = useRef(0);
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  const cancelRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const playingIdRef = useRef<string | null>(null);
  const pagingRef = useRef(false);
  // a página pode ser mais alta do que o ecrã: rola-se dentro dela e só se
  // passa à seguinte quando o texto chega ao fim
  const loadingRef = useRef<Set<string>>(new Set());
  const cursorTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const dragY = useRef(new Animated.Value(0)).current;
  const blue = useRef(new Animated.ValueXY({ x: 100, y: 30 })).current;
  const pink = useRef(new Animated.ValueXY({ x: 280, y: 24 })).current;
  const blueOp = useRef(new Animated.Value(1)).current;
  const pinkOp = useRef(new Animated.Value(1)).current;

  const navRef = useRef({ active: 0, total: 1, h: layout.h });
  const navActionRef = useRef<(dir: -1 | 0 | 1) => void>(() => {});

  const nextSeed = useCallback(() => Math.floor(Math.random() * 1e9), []);

  const setPagesNow = (next: Page[]) => {
    pagesRef.current = next;
    setPages(next);
  };

  const patchPage = (id: string, patch: any) => {
    const next = pagesRef.current.map((p) => (p.id === id ? { ...p, ...patch } : p));
    pagesRef.current = next;
    setPages(next);
  };

  const goActive = (i: number) => {
    activeRef.current = i;
    setActive(i);
  };

  useEffect(() => {
    loadKey().then(setKey);
    return () => {
      cancelRef.current = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      cursorTimers.current.forEach(clearTimeout);
    };
  }, []);

  // -------------------------------------------------------------------------
  // voz

  // -------------------------------------------------------------------------
  // animação do desenho

  function animate(totalMs: number) {
    return new Promise<void>((resolve) => {
      cancelRef.current = false;
      const t0 = Date.now();
      const loop = () => {
        if (cancelRef.current) return resolve();
        const el = Date.now() - t0;
        setTick(el);
        if (el >= totalMs) return resolve();
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    });
  }

  function fastDur(item: Item): number {
    // as durações do caderno (timeline.ts) são de leitura calma; aqui o
    // desenho é comprimido para caber em menos de um segundo por passo
    if (item.op.op === "motion") {
      return Math.max(250, Math.min(5000, Number(item.op.duration_ms) || 1500));
    }
    if (item.op.op === "scene") {
      return Math.max(250, Math.min(10000, Number(item.op.duration_ms) || 900));
    }
    const base = item.op.op === "graph" || item.op.op === "notes" ? 1.4 : 1;
    return Math.round(Math.max(70, Math.min(300, 150 * base)));
  }

  function clearCursorTimers() {
    cursorTimers.current.forEach(clearTimeout);
    cursorTimers.current = [];
  }

  function later(fn: () => void, ms: number) {
    cursorTimers.current.push(setTimeout(fn, Math.max(0, ms)));
  }

  function moveBlue(to: { x: number; y: number }) {
    Animated.spring(blue, {
      toValue: to,
      useNativeDriver: true,
      stiffness: 320,
      damping: 27,
      mass: 0.55,
    }).start();
  }

  function movePink(to: { x: number; y: number }) {
    Animated.spring(pink, {
      toValue: to,
      useNativeDriver: true,
      stiffness: 320,
      damping: 27,
      mass: 0.55,
    }).start();
  }

  function anchorOf(op: Op, g: Geom): { x: number; y: number } {
    const b = opBBox(op) ?? [42, 34, 58, 42];
    const scale = Math.min(g.bw / 100, g.bh / 75);
    const offsetX = (g.bw - 100 * scale) / 2;
    const offsetY = (g.bh - 75 * scale) / 2;
    const x = g.boardX + offsetX + ((b[0] + b[2]) / 2) * scale;
    const y = g.boardY + offsetY + ((b[1] + b[3]) / 2) * scale;
    return {
      x: Math.max(16, Math.min(g.w - 16, x)),
      y: Math.max(16, Math.min(g.boardY + g.bh - 8, y)),
    };
  }

  function screenPointOf(point: [number, number], g: Geom): { x: number; y: number } {
    const scale = Math.min(g.bw / 100, g.bh / 75);
    const offsetX = (g.bw - 100 * scale) / 2;
    const offsetY = (g.bh - 75 * scale) / 2;
    return {
      x: g.boardX + offsetX + point[0] * scale,
      y: g.boardY + offsetY + point[1] * scale,
    };
  }

  // o cursor pousa acima e à esquerda do bloco de texto, como quem escreve
  // sem tapar o que já está escrito
  function textAnchorOf(op: Op, g: Geom): { x: number; y: number } {
    const b = opBBox(op) ?? [12, 12, 40, 20];
    const scale = Math.min(g.bw / 100, g.bh / 75);
    const offsetX = (g.bw - 100 * scale) / 2;
    const offsetY = (g.bh - 75 * scale) / 2;
    const x = g.boardX + offsetX + b[0] * scale + 6;
    const y = g.boardY + offsetY + b[1] * scale - 22;
    return {
      x: Math.max(14, Math.min(g.w - 14, x)),
      y: Math.max(18, Math.min(g.boardY + g.bh - 10, y)),
    };
  }

  // depois de escrever, o azul fica na margem da última linha escrita
  function lineAnchor(g: Geom, chars = 0): { x: number; y: number } {
    const lineTop = g.boardY + g.bh + 8;
    const perLine = Math.max(24, Math.floor((g.w - 56) / 8.2));
    const lines = Math.max(1, Math.min(3, Math.ceil(chars / perLine)));
    return {
      x: 10,
      y: Math.min(g.h - 150, lineTop + (lines - 1) * 21 - 6),
    };
  }

  function finishCursors(g: Geom, lineLen: number) {
    moveBlue(lineAnchor(g, lineLen));
    // os cursores são da geração: quando a página fica pronta, saem de cima
    // do conteúdo em vez de ficarem parados a tapar a pergunta
    later(() => {
      Animated.parallel([
        Animated.timing(blueOp, {
          toValue: 0,
          duration: 420,
          delay: 650,
          useNativeDriver: true,
        }),
        Animated.timing(pinkOp, {
          toValue: 0,
          duration: 380,
          useNativeDriver: true,
        }),
      ]).start();
    }, 0);
    Animated.timing(pink, {
      toValue: { x: g.w - 26, y: g.h - 46 },
      duration: 330,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }

  function stopPlayback() {
    cancelRef.current = true;
    blue.stopAnimation();
    pink.stopAnimation();
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setLive(null);
    clearCursorTimers();
    const id = playingIdRef.current;
    if (id) {
      const p = pagesRef.current.find((x) => x.id === id);
      if (p && p.kind === "step") {
        if (p.state === "drawing") patchPage(id, { state: "done" });
        setLineN(p.line.length);
      }
    }
    playingIdRef.current = null;
  }

  async function runStep(index: number) {
    const p = pagesRef.current[index];
    if (!p || p.kind !== "step" || p.state !== "idle") return;
    if (activeRef.current !== index) return;

    playingIdRef.current = p.id;
    patchPage(p.id, { state: "drawing" });
    setLineN(0);

    const g = geometry(layoutRef.current.w, layoutRef.current.h, !!p.check);
    // cursores começam na linha de escrita (fora do título), nunca sobre texto
    const restY = lineAnchor(g, 0).y;
    blue.setValue({ x: 10, y: restY });
    pink.setValue({ x: Math.min(g.w - 40, g.w * 0.76), y: restY - 8 });
    blueOp.setValue(1);
    pinkOp.setValue(1);

    later(() => moveBlue(lineAnchor(g, p.line.length)), titleMs(p.title) + 160);

    const fresh = p.items.filter((it) => p.newIds.includes(it.id));
    const starts: number[] = [];
    const durs: number[] = [];
    let acc = 70;
    fresh.forEach((item) => {
      const d = fastDur(item);
      // Explicit motion offsets are measured from the start of this page's board playback.
      const requestedStart = (item.op.op === "motion" || item.op.op === "scene") && item.op.start_ms != null
        ? Math.max(0, Math.min(6000, item.op.start_ms))
        : acc;
      starts.push(requestedStart);
      durs.push(d);
      acc = Math.max(acc, requestedStart + d + 28);
    });
    const total = Math.max(420, acc - 28);
    const hasOverlappingMotion = fresh.some((item, i) =>
      item.op.op === "motion" && fresh.some((other, j) =>
        i !== j &&
        starts[j] < starts[i] + durs[i] &&
        starts[j] + durs[j] > starts[i],
      ),
    );
    // A single cursor cannot faithfully track overlapping moving objects.
    if (hasOverlappingMotion) pinkOp.setValue(0);

    setLive({ pageId: p.id, items: fresh, starts, durs });
    setTick(0);
    fresh.forEach((item, i) => {
      later(
        () => {
          if (item.op.op === "model3d") {
            movePink(anchorOf(item.op, g));
            return;
          }
          if (item.op.op === "scene") {
            // A composed scene has multiple simultaneous focal points.
            blueOp.setValue(0);
            pinkOp.setValue(0);
            return;
          }
          // The guide cursor follows the same segment sequence as the particle.
          // stopPlayback() cancels both if the student leaves this page.
          if (item.op.op === "motion") {
            if (hasOverlappingMotion) return;
            const points = item.op.points;
            const distances = points.slice(1).map((point, index) =>
              Math.hypot(point[0] - points[index][0], point[1] - points[index][1]),
            );
            const totalDistance = distances.reduce((sum, distance) => sum + distance, 0) || 1;
            pink.setValue(screenPointOf(points[0], g));
            Animated.sequence(
              distances.map((distance, index) =>
                Animated.timing(pink, {
                  toValue: screenPointOf(points[index + 1], g),
                  duration: Math.max(30, Math.round(durs[i] * distance / totalDistance)),
                  easing: Easing.linear,
                  useNativeDriver: true,
                }),
              ),
            ).start();
            return;
          }
          if (isTextOp(item.op)) moveBlue(textAnchorOf(item.op, g));
          else movePink(anchorOf(item.op, g));
        },
        starts[i] + 20,
      );
    });

    await animate(total);
    if (playingIdRef.current !== p.id) return;
    setLive(null);

    // a linha escrita entra depois do desenho, depressa, de cima para baixo
    later(() => moveBlue(lineAnchor(g, p.line.length)), 20);
    const line = p.line ?? "";
    if (line) {
      for (let i = 1; i <= line.length; i += 5) {
        if (playingIdRef.current !== p.id) return;
        setLineN(i);
        await wait(14);
      }
    }
    if (playingIdRef.current !== p.id) return;
    setLineN(line.length);
    playingIdRef.current = null;
    patchPage(p.id, { state: "done" });
    finishCursors(g, p.line.length);
  }

  // -------------------------------------------------------------------------
  // geração

  function makeLoadPage(opts: {
    question: string;
    history: Msg[];
    root: string;
    depth: number;
  }): LoadPage {
    return {
      id: newPageId(),
      kind: "load",
      root: opts.root,
      depth: opts.depth,
      history: opts.history,
      items: [],
      newIds: [],
      suggestions: [],
      state: "idle",
      question: opts.question,
    };
  }

  function makeStepPages(
    lesson: Lesson,
    opts: { history: Msg[]; root: string; depth: number },
  ): StepPage[] {
    const title = (lesson.title?.trim() || opts.root || "Aula").slice(0, 48);
    const steps = lesson.steps;
    const totalCount = steps.length + (lesson.check ? 1 : 0);
    const out: StepPage[] = [];

    steps.forEach((step, i) => {
      // A página é autónoma. Não herda desenhos nem modelos 3D de páginas
      // anteriores; cada gesto vertical revela uma nova composição completa.
      const before: Item[] = [];
      const next = applyOps(before, step.board as Op[], nextSeed);
      const beforeIds = new Set(before.map((it) => it.id));

      out.push({
        id: newPageId(),
        kind: "step",
        root: opts.root,
        depth: opts.depth,
        history: opts.history,
        items: next,
        newIds: next.filter((it) => !beforeIds.has(it.id)).map((it) => it.id),
        suggestions: !lesson.check && i === steps.length - 1 ? lesson.suggestions ?? [] : [],
        state: "idle",
        title: step.title?.trim() || (i === 0 ? title : `${title} · ${i + 1}`),
        subtitle: step.subtitle?.trim() || (i === 0 ? lesson.subtitle : `continuação · passo ${i + 1} de ${steps.length}`),
        stepIndex: i,
        stepCount: totalCount,
        say: step.say,
        line: writeOf(step),
        recap: step.recap,
        numbers: step.numbers,
        example: step.example,
        mistake: step.mistake,
        check: undefined,
      });
    });

    // A avaliação tem uma página própria: a explicação nunca é comprimida
    // para encaixar também a pergunta e as opções no mesmo ecrã.
    if (lesson.check) {
      out.push({
        id: newPageId(),
        kind: "step",
        root: opts.root,
        depth: opts.depth,
        history: opts.history,
        items: [],
        newIds: [],
        suggestions: lesson.suggestions ?? [],
        state: "done",
        title: "Vamos testar?",
        subtitle: "Aplica a ideia que acabaste de aprender.",
        stepIndex: steps.length,
        stepCount: totalCount,
        say: "",
        line: "",
        check: lesson.check,
        quizOnly: true,
      });
    }
    return out;
  }

  function continueQuestion(lesson: Lesson, root: string, depth: number): string {
    const last = lesson.steps
      .slice(-2)
      .map((s) => writeOf(s))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(-300);
    return `Continua a aula sobre "${root}" (parte ${depth + 2}). Já ficou explicado: ${last}. Não repitas o que já foi dito: avança para o próximo conceito essencial, com um exemplo novo e um pormenor que só se compreende depois disto.`;
  }

  function expandLoad(id: string, steps: StepPage[], nextLoad: LoadPage) {
    const ps = pagesRef.current;
    const idx = ps.findIndex((p) => p.id === id);
    if (idx < 0) return;
    const next = [...ps.slice(0, idx), ...steps, nextLoad, ...ps.slice(idx + 1)];
    const before = activeRef.current;
    setPagesNow(next);
    if (before > idx) goActive(before + steps.length);
  }

  async function loadIntoPage(id: string) {
    if (loadingRef.current.has(id)) return;
    const p = pagesRef.current.find((x) => x.id === id);
    if (!p || p.kind !== "load" || p.state === "loading") return;

    if (!key) {
      patchPage(id, {
        state: "error",
        error: "Liga a chave OpenRouter para eu continuar a aula.",
      });
      return;
    }

    loadingRef.current.add(id);
    patchPage(id, { state: "loading", error: undefined });

    try {
      const lesson = await generateLesson({
        question: p.question,
        key,
        pace: 3,
        profile: "",
        boardNow: "",
        hasBoard: false,
        history: p.history,
        minutes: 2,
        model: DEFAULT_MODEL,
        // 1 = intuição, 2 = mecanismo, 3 números, 4 falhas, 5 compromissos,
        // 6+ aprofundamento livre: o scroll nunca acaba, muda de foco
        depth: p.depth + 1,
      });

      if (!pagesRef.current.some((x) => x.id === id)) return;

      const root = p.depth === 0 ? lesson.title?.trim() || p.root : p.root;
      const history: Msg[] = [
        ...p.history,
        { role: "user", content: p.question },
        { role: "assistant", content: lesson.steps.map((s) => s.say).join(" ") },
      ];
      const steps = makeStepPages(lesson, { history, root, depth: p.depth });
      const nextLoad = makeLoadPage({
        question: continueQuestion(lesson, root, p.depth),
        history,
        root,
        depth: p.depth + 1,
      });
      expandLoad(id, steps, nextLoad);
    } catch (e: any) {
      if (pagesRef.current.some((x) => x.id === id)) {
        patchPage(id, {
          state: "error",
          error: String(e?.message ?? e).slice(0, 200),
        });
      }
    } finally {
      loadingRef.current.delete(id);
    }
  }

  function prefetchAfter(id: string) {
    if (!key) return;
    const ps = pagesRef.current;
    const idx = ps.findIndex((p) => p.id === id);
    if (idx < 0) return;
    const load = ps.slice(idx + 1).find((p) => p.kind === "load") as LoadPage | undefined;
    if (load && load.state === "idle") void loadIntoPage(load.id);
  }

  // -------------------------------------------------------------------------
  // navegação vertical

  function springBack() {
    Animated.spring(dragY, {
      toValue: 0,
      useNativeDriver: true,
      stiffness: 260,
      damping: 30,
      mass: 0.7,
    }).start();
  }

  function slideTo(target: number) {
    if (pagingRef.current) return;
    const from = activeRef.current;
    if (target === from) return;
    pagingRef.current = true;
    const h = layoutRef.current.h;
    const g = geometry(layoutRef.current.w, h, false);
    Animated.parallel([
      Animated.timing(blue, {
        toValue: { x: g.w * 0.34, y: h * 0.8 },
        duration: 210,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(pink, {
        toValue: { x: g.w * 0.64, y: h * 0.84 },
        duration: 210,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    Animated.timing(dragY, {
      toValue: target > from ? -h : h,
      duration: 245,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      dragY.setValue(0);
      goActive(target);
      pagingRef.current = false;
    });
  }

  function commitBy(dir: -1 | 1) {
    const n = navRef.current;
    const target = n.active + dir;
    if (target < 0 || target >= n.total) {
      springBack();
      return;
    }
    stopPlayback();
    slideTo(target);
  }

  navActionRef.current = (dir) => {
    if (dir === 0) springBack();
    else commitBy(dir);
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_e, g) => {
        if (pagingRef.current || modelOpen) return false;
        if (Math.abs(g.dy) <= 8 || Math.abs(g.dy) <= Math.abs(g.dx) * 1.15) return false;
        // Um único gesto vertical controla o feed inteiro, como no TikTok.
        // Não existe scroll interno em cada página.
        return true;
      },
      onPanResponderGrant: () => {
        dragY.stopAnimation();
      },
      onPanResponderMove: (_e, g) => {
        const n = navRef.current;
        let dy = g.dy;
        if ((n.active === 0 && dy > 0) || (n.active >= n.total - 1 && dy < 0)) dy *= 0.26;
        dragY.setValue(dy);
      },
      onPanResponderRelease: (_e, g) => {
        const n = navRef.current;
        const next = g.dy < -26 || (g.vy < -0.5 && g.dy < -8);
        const prev = g.dy > 26 || (g.vy > 0.5 && g.dy > 8);
        if (next && n.active < n.total - 1) navActionRef.current(1);
        else if (prev && n.active > 0) navActionRef.current(-1);
        else navActionRef.current(0);
      },
      onPanResponderTerminate: () => navActionRef.current(0),
      onPanResponderTerminationRequest: () => false,
    }),
  ).current;

  // -------------------------------------------------------------------------
  // pedidos

  function ask(text: string) {
    const question = text.trim();
    if (!question) return;
    if (!key) {
      setAskedOnce(true);
      setKeyOpen(true);
      return;
    }

    stopPlayback();
    const ps = pagesRef.current;
    const cur = ps[activeRef.current] ?? ps[0] ?? HERO;
    const load = makeLoadPage({
      question,
      history: cur.history,
      root: topicFrom(question),
      depth: 0,
    });

    let next: Page[];
    let target = activeRef.current;
    if (cur.kind === "hero") {
      next = [load];
      target = 0;
    } else if (cur.kind === "load") {
      next = [...ps.slice(0, activeRef.current), load];
      target = activeRef.current;
    } else {
      next = [...ps.slice(0, activeRef.current + 1), load];
      target = activeRef.current + 1;
    }
    setPagesNow(next);
    setQ("");
    void loadIntoPage(load.id);
    if (target !== activeRef.current) slideTo(target);
  }

  function startSeed() {
    stopPlayback();
    const ps = pagesRef.current;
    const cur = ps[activeRef.current] ?? ps[0] ?? HERO;
    const root = seedLesson.title ?? "Mitose";
    const history: Msg[] = [
      { role: "assistant", content: seedLesson.steps.map((s) => s.say).join(" ") },
    ];
    const steps = makeStepPages(seedLesson, { history, root, depth: 0 });
    const nextLoad = makeLoadPage({
      question: continueQuestion(seedLesson, root, 0),
      history,
      root,
      depth: 1,
    });

    if (cur.kind === "hero") {
      setPagesNow([...steps, nextLoad]);
      goActive(0);
    } else if (cur.kind === "load") {
      setPagesNow([...ps.slice(0, activeRef.current), ...steps, nextLoad]);
      goActive(activeRef.current);
    } else {
      const at = activeRef.current + 1;
      setPagesNow([...ps.slice(0, at), ...steps, nextLoad]);
      slideTo(at);
    }
  }

  function retryLoad(id: string) {
    if (!key) {
      setAskedOnce(true);
      setKeyOpen(true);
      return;
    }
    patchPage(id, { state: "idle", error: undefined });
    void loadIntoPage(id);
  }

  // -------------------------------------------------------------------------
  // efeitos da página activa

  const page: Page = pages[active] ?? pages[0] ?? HERO;
  const activePageId = page.id;
  const activePageState = page.state;
  const activePageKind = page.kind;

  useEffect(() => {
    setActiveHotspot(null);
    navRef.current = { active, total: pages.length, h: layout.h };
  }, [active, pages.length, layout.h]);

  // repõe os cursores no topo de cada página nova; fora dos passos ficam
  // escondidos, para não parecerem decorativos numa página sem desenho
  useEffect(() => {
    const { w } = layoutRef.current;
    blue.setValue({ x: w * 0.27, y: 30 });
    pink.setValue({ x: w * 0.73, y: 24 });
    const p = pagesRef.current[active];
    const show = p?.kind === "step";
    blueOp.setValue(show ? 1 : 0);
    pinkOp.setValue(show ? 1 : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  useEffect(() => {
    if (activePageKind === "step") {
      const p = pagesRef.current[active];
      if (!p || p.kind !== "step") return;
      if (p.state === "idle") void runStep(active);
      else if (p.state === "done" && playingIdRef.current !== p.id) {
        setLineN(p.line.length);
      }
      // a página seguinte começa a gerar assim que esta aparece: quando o
      // aluno faz scroll, já está pronta ou quase
      prefetchAfter(p.id);
    } else if (activePageKind === "load" && activePageState === "idle") {
      void loadIntoPage(activePageId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, activePageId, activePageKind, activePageState, key]);

  useEffect(() => {
    return () => {
      cancelRef.current = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // -------------------------------------------------------------------------
  // geometria da página activa

  const g = geometry(layout.w, layout.h, page.kind === "step" && !!page.check);
  const fracOf = (item: Item): number => {
    if (live && live.pageId === page.id) {
      const idx = live.items.findIndex((i) => i.id === item.id);
      if (idx >= 0) {
        return clamp01((tick - live.starts[idx]) / Math.max(1, live.durs[idx]));
      }
    }
    return 1;
  };

  const stepPage = page.kind === "step" ? page : null;
  const modelItem = stepPage
    ? stepPage.items.find((it) => {
        const op: any = it.op;
        return op.op === "model3d" && (op.model in MODELS || op.model === "sandflow");
      })
    : undefined;
  const modelOp = modelItem?.op as ModelOp | undefined;
  const modelVisible = modelItem ? fracOf(modelItem) : 0;
  const modelBox = modelOp
    ? (() => {
        const b = opBBox(modelOp) ?? [10, 2, 88, 42];
        // react-native-svg uses xMidYMid meet by default. The logical
        // 100x75 board is letterboxed inside the wider phone rectangle;
        // map the 3D overlay using that same scale/offset or it floats over
        // neighbouring drawings.
        const scale = Math.min(g.bw / 100, g.bh / 75);
        const contentW = 100 * scale;
        const contentH = 75 * scale;
        const offsetX = (g.bw - contentW) / 2;
        const offsetY = (g.bh - contentH) / 2;
        return {
          left: offsetX + b[0] * scale,
          top: offsetY + b[1] * scale,
          width: Math.max(1, (b[2] - b[0]) * scale),
          height: Math.max(1, (b[3] - b[1]) * scale),
        };
      })()
    : null;

  const headerTopic = page.kind === "hero" ? "viently" : topicFrom(page.root);
  const working = page.kind === "step" && page.state === "drawing";

  if (!fontsLoaded) {
    return (
      <View style={[s.root, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator color={INK} />
      </View>
    );
  }

  const renderLoad = (pg: LoadPage) => (
    <View style={{ height: layout.h }}>
      <PagePaper />
      <View style={s.loadBox}>
        {pg.state === "error" ? (
          <>
            <Text style={s.loadKicker}>a aula parou aqui</Text>
            <Text style={s.loadTitle}>Não consegui continuar</Text>
            <Text style={s.loadText}>{pg.error}</Text>
            <Pressable style={s.loadBtn} onPress={() => retryLoad(pg.id)}>
              <Text style={s.loadBtnText}>
                {key ? "Tentar outra vez" : "Ligar a chave"}
              </Text>
            </Pressable>
          </>
        ) : (
          <>

          <ActivityIndicator color={MINT} />
            <Text style={s.loadKicker}>
              {pg.depth === 0 ? "a preparar a tua página" : "a seguir"}
            </Text>
            <Text style={s.loadTitle}>
              {pg.depth === 0 ? topicFrom(pg.question) : "Mais fundo na mesma ideia"}
            </Text>
            <Text style={s.loadText}>
              Estou a escolher o desenho e a escrever a próxima página.
            </Text>
            <View style={s.skeleton}>
              <View style={[s.skeletonLine, { width: "88%" }]} />
              <View style={[s.skeletonLine, { width: "72%" }]} />
              <View style={[s.skeletonLine, { width: "54%" }]} />
            </View>
          </>
        )}
      </View>
    </View>
  );

  const renderHero = () => (
    <View style={{ height: layout.h }}>
      <PagePaper />
      <View style={s.hero}>
        <Text style={s.heroKicker}>caderno que se mexe</Text>
        <Text style={s.heroTitle}>Sobre o que queres aprender?</Text>
        <Text style={s.heroSub}>
          Escreve o que não percebeste. Eu explico e desenho ao mesmo tempo.
        </Text>
        <View style={s.heroChips}>
          {["A mitose", "Pesquisa binária", "Porque é que o céu é azul?"].map((c) => (
            <Pressable key={c} style={s.heroChip} onPress={() => ask(c)}>
              <Text style={s.heroChipText}>{c}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable onPress={startSeed} style={{ marginTop: 20 }}>
          <Text style={s.heroLink}>Ver a aula de exemplo</Text>
        </Pressable>
        {!key && (
          <Pressable
            onPress={() => {
              setAskedOnce(true);
              setKeyOpen(true);
            }}
            style={{ marginTop: 14 }}
          >
            <Text style={s.heroNote}>Modo exemplo · ligar a chave OpenRouter</Text>
          </Pressable>
        )}
        {key && <Text style={s.heroNote}>motor ligado ✓</Text>}
      </View>
    </View>
  );

  const renderStep = (pg: StepPage) => {
    const gg = geometry(layout.w, layout.h, !!pg.check);
    const showSuggestions =
      pg.state === "done" &&
      pg.stepIndex === pg.stepCount - 1 &&
      (!pg.quizOnly || pg.answered !== undefined) &&
      pg.suggestions.length > 0;
    const showSwipeHint =
      pg.state === "done" &&
      (pg.quizOnly ? pg.answered !== undefined : (pg.stepCount === 1 || pg.stepIndex < pg.stepCount - 1));
    const visibleLine = pg.state === "done" && lineN === 0 ? pg.line : pg.line.slice(0, lineN);

    return (
      <View style={{ height: layout.h, overflow: "hidden" }}>
        <PagePaper />
        <View style={[s.headBlock, { height: HEAD_H }]}>
          <HandHeading
            title={pg.title}
            subtitle={pg.subtitle}
            animate={pg.stepIndex === 0 && pg.state === "idle"}
          />
          <Text style={s.stepBadge}>
            {pg.stepCount > 1 ? `${pg.stepIndex + 1}/${pg.stepCount}` : ""}
          </Text>
        </View>

        {!pg.quizOnly && <View style={{ width: gg.bw, height: gg.bh, alignSelf: "center" }}>
          <Board
            ops={boardOps(pg)}
            fracOf={fracOf}
            width={gg.bw}
            height={gg.bh}
            paper={false}
            onHotspotPress={setActiveHotspot}
            activeHotspot={activeHotspot}
          />
          {!!modelOp && !!modelBox && (
            <View
              style={{
                position: "absolute",
                left: modelBox.left,
                top: modelBox.top,
                width: modelBox.width,
                height: modelBox.height,
                overflow: "hidden",
              }}
            >
              <LiveModel op={modelOp} visible={modelVisible} onOpen={setModelOpen} />
            </View>
          )}
        </View>}

        {!pg.quizOnly && <View style={[s.lineBox, { maxHeight: 290 }]}>
          {!!activeHotspot && (() => {
            const hit = pg.items.find((item) => item.id === activeHotspot);
            if (!hit || hit.op.op !== "hotspot") return null;
            return (
              <View style={{ backgroundColor: "#edf1fa", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, marginBottom: 8 }}>
                <Text style={{ color: INK, fontFamily: "Quicksand_700Bold", fontSize: 13 }}>{hit.op.label}</Text>
                <Text style={{ color: BODY, fontFamily: "Quicksand_500Medium", fontSize: 12.5, lineHeight: 18, marginTop: 2 }}>{hit.op.detail}</Text>
              </View>
            );
          })()}
          {pg.state === "done" ? (
            <NoteText text={pg.line} />
          ) : visibleLine ? (
            <Text style={s.lineText}>{visibleLine}</Text>
          ) : (
            <View style={s.linePlaceholder} />
          )}
          {pg.state === "done" && <PageCards page={pg} />}
        </View>}

        {!!pg.check && (
          <View style={s.quiz}>
            <Text style={s.quizKicker}>confirma se percebeste</Text>
            <Text style={s.quizPrompt}>{pg.check.prompt}</Text>
            <View style={s.quizOpts}>
              {pg.check.options.map((option, index) => {
                const selected = pg.answered === index;
                const correct = index === pg.check!.answer_index;
                return (
                  <Pressable
                    key={index}
                    onPress={() => pg.answered === undefined && patchPage(pg.id, { answered: index })}
                    disabled={pg.answered !== undefined}
                    style={[
                      s.quizOpt,
                      selected && (correct ? s.quizRight : s.quizWrong),
                    ]}
                  >
                    <View style={[s.quizKey, selected && (correct ? s.quizKeyRight : s.quizKeyWrong)]}>
                      <Text style={s.quizKeyTxt}>{String.fromCharCode(65 + index)}</Text>
                    </View>
                    <Text style={s.quizOptTxt} numberOfLines={3}>{option}</Text>
                  </Pressable>
                );
              })}
            </View>
            {pg.answered !== undefined && (
              <Text style={s.quizWhy}>
                {pg.answered === pg.check.answer_index ? "Certo. " : "Ainda não. "}
                {pg.check.explanation ?? (pg.answered === pg.check.answer_index ? "Boa, segue para a próxima página." : "Revê a explicação e tenta noutra pergunta.")}
              </Text>
            )}
          </View>
        )}

        <View style={s.bottomArea}>


          {showSuggestions && (
            <View style={s.suggestRow}>
              {pg.suggestions.slice(0, 2).map((c) => (
                <SuggestionPill key={c} text={c} onPress={() => ask(c)} />
              ))}
            </View>
          )}

          {showSwipeHint && (
            <View style={s.swipeHint} pointerEvents="none">
              <Text style={s.swipeHintText}>desliza para continuar</Text>
              <Text style={s.swipeArrow}>↓</Text>
            </View>
          )}
        </View>

      </View>
    );
  };

  const renderPage = (pg: Page) => {
    if (pg.kind === "hero") return renderHero();
    if (pg.kind === "load") return renderLoad(pg);
    return renderStep(pg);
  };

  const windowIndexes = [active - 1, active, active + 1].filter(
    (i) => i >= 0 && i < pages.length,
  );

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={{ flex: 1, backgroundColor: "#faf9f6" }}>
        <View style={s.header}>
          <Text style={s.headerLabel} numberOfLines={1}>
            {headerTopic}{" "}
            <Text style={s.headerPage}>
              {page.kind === "step" && page.stepCount === 1
                ? "· aula interativa"
                : `· ${active + 1}`}
            </Text>
          </Text>
          <Pressable
            onPress={() => {
              setAskedOnce(false);
              setKeyOpen(true);
            }}
            hitSlop={10}
            style={s.headerBtn}
          >
            <Text style={[s.headerBtnText, !key && { color: MINT }]}>
              {key ? "chave ✓" : "ligar"}
            </Text>
          </Pressable>
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View
            style={s.feed}
            onLayout={(e) => {
              const { width, height } = e.nativeEvent.layout;
              if (!width || !height) return;
              if (
                Math.abs(width - layout.w) > 0.5 ||
                Math.abs(height - layout.h) > 0.5
              ) {
                setLayout({ w: width, h: height });
              }
            }}
            {...pan.panHandlers}
          >
            {windowIndexes.map((i) => {
              const pg = pages[i];
              if (!pg) return null;
              const isActive = i === active;
              return (
                <Animated.View
                  key={pg.id}
                  style={[
                    s.page,
                    {
                      height: layout.h,
                      top: (i - active) * layout.h,
                      transform: [{ translateY: dragY }],
                    },
                  ]}
                >
                  {isActive ? (
                    renderPage(pg)
                  ) : pg.kind === "step" ? (
                    <StaticStep page={pg} w={layout.w} h={layout.h} />
                  ) : (
                    <View style={{ height: layout.h }}>
                      <PagePaper />
                    </View>
                  )}
                </Animated.View>
              );
            })}

            {/* os dois cursores: azul para o texto, rosa para as imagens/3D */}
            <Animated.Image
              source={require("./assets/cursors/blue.png")}
              resizeMode="contain"
              pointerEvents="none"
              style={[
                s.cursor,
                {
                  opacity: blueOp,
                  transform: [...blue.getTranslateTransform(), { rotate: "-7deg" }],
                },
              ]}
            />
            <Animated.Image
              source={require("./assets/cursors/pink.png")}
              resizeMode="contain"
              pointerEvents="none"
              style={[
                s.cursor,
                {
                  opacity: pinkOp,
                  transform: [...pink.getTranslateTransform(), { rotate: "6deg" }],
                },
              ]}
            />
          </View>

          {/* mascote pousada sobre a barra de pergunta, canto direito */}
          <View pointerEvents="none" style={s.mascotDock}>
            <Image
              source={require("./assets/cursors/blue.png")}
              style={s.mascot}
            />
          </View>

          <View style={s.composer}>
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Pergunta o que quiseres…"
              placeholderTextColor="#a3aaa4"
              style={s.input}
              onSubmitEditing={() => ask(q)}
              returnKeyType="send"
            />
            {working ? (
              <Pressable style={s.send} onPress={stopPlayback}>
                <View style={s.stopIcon} />
              </Pressable>
            ) : (
              <Pressable style={s.send} onPress={() => ask(q)}>
                <Text style={s.sendIcon}>↑</Text>
              </Pressable>
            )}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <Modal
        visible={!!modelOpen}
        animationType="slide"
        onRequestClose={() => setModelOpen(null)}
        presentationStyle="fullScreen"
      >
        {modelOpen ? (
          <Model3D target={modelOpen} onClose={() => setModelOpen(null)} />
        ) : null}
      </Modal>

      <Modal
        visible={keyOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setKeyOpen(false)}
      >
        <View style={s.modalBack}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>Ligar o motor</Text>
            <Text style={s.modalText}>
              {askedOnce
                ? "Sem chave só consigo mostrar a aula de exemplo. Cola a chave OpenRouter para eu gerar aulas a partir do que escreveres."
                : "A chave fica guardada só neste iPhone. Não vai para o código nem para o servidor da escola."}
            </Text>
            <TextInput
              value={keyDraft}
              onChangeText={setKeyDraft}
              placeholder="sk-or-v1-…"
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              style={s.modalInput}
            />
            <Pressable
              style={[s.primary, !looksLikeKey(keyDraft) && { opacity: 0.4 }]}
              disabled={!looksLikeKey(keyDraft)}
              onPress={async () => {
                await saveKey(keyDraft);
                setKey(keyDraft.trim());
                setKeyDraft("");
                setKeyOpen(false);
              }}
            >
              <Text style={s.primaryText}>Guardar</Text>
            </Pressable>
            <Pressable style={s.secondary} onPress={() => setKeyOpen(false)}>
              <Text style={s.secondaryText}>Agora não</Text>
            </Pressable>
            <Text style={s.modalFoot}>Chave actual: {key ? "ligada ✓" : "nenhuma"}</Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ---------------------------------------------------------------------------

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#faf9f6" },

  header: {
    height: 38,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: HAIR,
    backgroundColor: "rgba(250,248,241,0.9)",
  },
  headerLabel: {
    flex: 1,
    color: "#7e857e",
    fontFamily: "Quicksand_500Medium",
    fontSize: 11.5,
    letterSpacing: 0.7,
    textTransform: "lowercase",
  },
  headerPage: { color: "#a8ada5" },
  headerBtn: { paddingHorizontal: 8, paddingVertical: 6 },
  headerBtnText: {
    color: "#8a9089",
    fontFamily: "Quicksand_600SemiBold",
    fontSize: 10.5,
    letterSpacing: 0.6,
    textTransform: "lowercase",
  },

  feed: { flex: 1, overflow: "hidden" },
  page: { position: "absolute", left: 0, right: 0 },

  headBlock: {
    paddingHorizontal: 24,
    paddingTop: 6,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  headText: { flex: 1 },
  h1: {
    fontFamily: HAND,
    fontSize: 30,
    lineHeight: 33,
    letterSpacing: 0.2,
    color: INK,
  },
  sub: {
    fontFamily: HAND,
    fontSize: 17,
    lineHeight: 21,
    color: "#7f857d",
    marginTop: 1,
  },
  stepBadge: {
    marginTop: 4,
    marginLeft: 8,
    color: "#a4aaa2",
    fontFamily: "Quicksand_600SemiBold",
    fontSize: 10,
    letterSpacing: 0.8,
  },

  lineBox: {
    paddingHorizontal: 22,
    paddingTop: 3,
    minHeight: 54,
    maxHeight: 250,
    flexShrink: 1,
    overflow: "hidden",
  },
  lineText: {
    fontFamily: HAND,
    fontSize: 17,
    lineHeight: 21,
    color: BODY,
  },
  lineNum: { color: "#8f978f" },
  noteRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 8 },
  noteNum: {
    width: 21,
    height: 21,
    borderRadius: 11,
    backgroundColor: "#e5ebf8",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 9,
    marginTop: 1,
  },
  noteNumTxt: { fontFamily: QUICK, fontSize: 12, color: "#4d68a5" },
  noteBody: { flex: 1, fontFamily: QUICK, fontSize: 13.5, lineHeight: 17, color: BODY },
  noteHead: { fontFamily: QUICK, color: "#2d3a54" },
  cards: { marginTop: 8 },
  nums: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 6 },
  numPill: {
    backgroundColor: "#edf1fa",
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  numLabel: { fontFamily: QUICK, fontSize: 10.5, color: "#7c88a0" },
  numValue: { fontFamily: QUICK, fontSize: 13, color: "#2d3a54" },
  cardLine: {
    fontFamily: QUICK,
    fontSize: 13,
    lineHeight: 18,
    color: "#46536a",
    marginTop: 2,
  },
  cardKey: { color: "#4d68a5" },
  recapBox: {
    marginTop: 8,
    backgroundColor: "#edf1fa",
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  recapTitle: {
    fontFamily: HAND,
    fontSize: 17,
    color: "#4d68a5",
    marginBottom: 4,
  },
  recapLine: {
    fontFamily: QUICK,
    fontSize: 12.5,
    lineHeight: 16,
    color: "#46536a",
    marginTop: 2,
  },
  linePlaceholder: { paddingTop: 7 },

  bottomArea: { flex: 1, justifyContent: "flex-end", paddingBottom: 6 },

  quiz: {
    marginHorizontal: 16,
    marginTop: 6,
    paddingHorizontal: 13,
    paddingTop: 10,
    paddingBottom: 11,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: HAIR,
    backgroundColor: "rgba(255,255,255,0.55)",
  },
  quizKicker: {
    color: MUTED,
    fontSize: 9.5,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    fontFamily: "Quicksand_600SemiBold",
  },
  quizPrompt: {
    color: INK,
    fontSize: 14.5,
    lineHeight: 19,
    marginTop: 3,
    fontFamily: "Quicksand_600SemiBold",
  },
  quizOpts: { marginTop: 8, flexDirection: "row", flexWrap: "wrap", gap: 6 },
  quizOpt: {
    width: "48%",
    flexGrow: 0,
    flexShrink: 1,
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 9,
    minHeight: 58,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "rgba(63,71,64,0.16)",
    backgroundColor: "#fbfaf4",
  },
  quizRight: { backgroundColor: "#e9effc", borderColor: "#8198ce" },
  quizWrong: { backgroundColor: "#f9ece8", borderColor: "#d3a096" },
  quizKey: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eceadf",
  },
  quizKeyRight: { backgroundColor: "#5878bd" },
  quizKeyWrong: { backgroundColor: "#b4514a" },
  quizKeyTxt: { color: "#59657a", fontSize: 11.5, fontFamily: "Quicksand_700Bold" },
  quizOptTxt: { color: INK, fontSize: 12, lineHeight: 15 },
  quizMark: { color: "#5878bd", fontSize: 14, fontFamily: "Quicksand_700Bold" },
  quizWhy: {
    marginTop: 8,
    color: "#5f6a60",
    fontSize: 12,
    lineHeight: 16,
    fontFamily: "Quicksand_500Medium",
  },

  suggestRow: {
    flexDirection: "row",
    gap: 9,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 2,
  },
  pill: {
    flex: 1,
    minHeight: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#c7d4ef",
    borderBottomWidth: 1.5,
    borderBottomColor: "#b5c5e8",
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 9,
    paddingRight: 10,
    paddingVertical: 6,
    gap: 6,
    shadowColor: "#667cae",
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
  pillGloss: {
    position: "absolute",
    left: 7,
    right: 7,
    top: 2,
    height: 18,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.55)",
  },
  pillIcon: { width: 20, alignItems: "center", justifyContent: "center" },
  pillText: {
    flex: 1,
    fontFamily: HAND,
    fontSize: 14.5,
    lineHeight: 16.5,
    color: "#4966a7",
  },

  hero: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingBottom: 46,
  },
  heroKicker: {
    color: "#9aa198",
    fontFamily: "Quicksand_600SemiBold",
    fontSize: 10.5,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    textAlign: "center",
    marginBottom: 8,
  },
  heroTitle: {
    fontFamily: HAND,
    fontSize: 37,
    lineHeight: 41,
    letterSpacing: 0.2,
    color: INK,
    textAlign: "center",
  },
  heroSub: {
    fontFamily: HAND,
    fontSize: 18.5,
    lineHeight: 24,
    color: MUTED,
    textAlign: "center",
    marginTop: 8,
    maxWidth: 320,
    alignSelf: "center",
  },
  heroChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
    marginTop: 22,
  },
  heroChip: {
    borderWidth: 1,
    borderColor: "#e0e4ee",
    backgroundColor: "#fffdf6",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: "#7d7560",
    shadowOpacity: 0.09,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  heroChipText: { color: INK, fontFamily: HAND, fontSize: 17 },
  heroLink: {
    color: MUTED,
    fontFamily: HAND,
    fontSize: 17,
    textDecorationLine: "underline",
    textAlign: "center",
  },
  heroNote: {
    color: "#9aa098",
    fontFamily: "Quicksand_500Medium",
    fontSize: 11.5,
    textAlign: "center",
    marginTop: 14,
  },

  loadBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingBottom: 40,
  },
  loadKicker: {
    marginTop: 16,
    color: "#9aa198",
    fontFamily: "Quicksand_600SemiBold",
    fontSize: 10.5,
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  loadTitle: {
    marginTop: 8,
    color: INK,
    fontFamily: HAND,
    fontSize: 29,
    lineHeight: 33,
    textAlign: "center",
  },
  loadText: {
    marginTop: 8,
    color: MUTED,
    fontFamily: "Quicksand_500Medium",
    fontSize: 13.5,
    lineHeight: 19,
    textAlign: "center",
    maxWidth: 300,
  },
  loadBtn: {
    marginTop: 18,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: INK,
  },
  loadBtnText: {
    color: "#faf8f1",
    fontFamily: "Quicksand_700Bold",
    fontSize: 13.5,
  },
  skeleton: {
    width: 240,
    marginTop: 24,
    gap: 8,
    opacity: 0.5,
  },
  skeletonLine: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "#e2ded0",
  },

  cursor: {
    position: "absolute",
    left: -14,
    top: -14,
    width: 34,
    height: 34,
    zIndex: 30,
    shadowColor: "#1c2a52",
    shadowOpacity: 0.22,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 3 },
  },

  swipeHint: {
    alignItems: "center",
    paddingBottom: 8,
    gap: 1,
  },
  swipeHintText: {
    color: "#a4aaa2",
    fontFamily: "Quicksand_500Medium",
    fontSize: 10.5,
    letterSpacing: 0.7,
    textTransform: "lowercase",
  },
  swipeArrow: {
    color: "#b3b8b0",
    fontFamily: "Quicksand_500Medium",
    fontSize: 15,
    lineHeight: 17,
    marginTop: -2,
  },

  mascotDock: {
    position: "absolute",
    right: 22,
    bottom: 66,
    zIndex: 5,
  },
  mascot: {
    width: 40,
    height: 40,
    resizeMode: "contain",
    opacity: 0.95,
  },
  composer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 14,
    marginTop: 4,
    marginBottom: 10,
    paddingLeft: 16,
    paddingRight: 5,
    paddingVertical: 4,
    backgroundColor: "#fffdf6",
    borderWidth: 1,
    borderColor: "#e0e4ee",
    borderRadius: 28,
    shadowColor: "#6d6a5a",
    shadowOpacity: 0.14,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  input: {
    flex: 1,
    minWidth: 0,
    fontSize: 18,
    color: INK,
    paddingVertical: 8,
    fontFamily: HAND,
  },
  send: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#35435f",
    alignItems: "center",
    justifyContent: "center",
  },
  sendIcon: { color: "#faf8f1", fontSize: 18, fontWeight: "700", marginTop: -2 },
  stopIcon: { width: 11, height: 11, backgroundColor: "#faf8f1", borderRadius: 2 },

  modalBack: {
    flex: 1,
    backgroundColor: "rgba(30,34,32,0.32)",
    justifyContent: "flex-end",
  },
  modal: {
    backgroundColor: "#f9f7ef",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: 22,
    paddingBottom: 34,
    gap: 10,
  },
  modalTitle: { fontFamily: HAND, fontSize: 30, color: INK },
  modalText: {
    color: MUTED,
    fontSize: 14.5,
    lineHeight: 20,
    fontFamily: "Quicksand_500Medium",
  },
  modalInput: {
    borderWidth: 1,
    borderColor: "#e0e4ee",
    backgroundColor: "#fffdf6",
    borderRadius: 13,
    paddingHorizontal: 13,
    paddingVertical: 12,
    fontSize: 14,
    color: INK,
    marginTop: 4,
    fontFamily: "Quicksand_500Medium",
  },
  primary: {
    backgroundColor: INK,
    borderRadius: 15,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  primaryText: { color: "#faf8f1", fontFamily: "Quicksand_700Bold", fontSize: 15 },
  secondary: { alignItems: "center", paddingVertical: 10 },
  secondaryText: { color: MUTED, fontFamily: "Quicksand_500Medium", fontSize: 14 },
  modalFoot: {
    color: "#a2a7b3",
    fontSize: 11.5,
    textAlign: "center",
    fontFamily: "Quicksand_500Medium",
  },
});
