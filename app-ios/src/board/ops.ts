// Gramática de ops do quadro — portada de tutori/engine.py + static/board.js.
// Espaço lógico: 100 (x) × 75 (y), y cresce para baixo.

import type { SandflowModel } from "../three/sandflow";

export type Pt = [number, number];

export type Ink =
  | "ink"
  | "blue"
  | "red"
  | "green"
  | "orange"
  | "purple"
  | "gray"
  | "yellow";

export type Size = "s" | "m" | "l" | "xl";

export type Series = {
  label?: string;
  color?: Ink;
  points: Pt[];
};

export type Marker = {
  at: Pt;
  label?: string;
  color?: Ink;
};

export type Op =
  | { op: "title"; text: string; color?: Ink }
  | {
      op: "text";
      text: string;
      at: Pt;
      size?: Size;
      color?: Ink;
      align?: "left" | "center";
      fit_w?: number;
    }
  | { op: "note"; text: string; at: Pt; color?: Ink; align?: "left" | "center" }
  | { op: "line"; from: Pt; to: Pt; color?: Ink; dash?: boolean }
  | { op: "arrow"; from: Pt; to: Pt; color?: Ink; label?: string; label_at?: Pt }
  | {
      op: "callout";
      around: Pt;
      to?: Pt;
      r?: number;
      label?: string;
      label_at?: Pt;
      color?: Ink;
      fit_w?: number;
    }
  | {
      op: "box";
      at: Pt;
      w?: number;
      h?: number;
      label?: string;
      size?: Size;
      color?: Ink;
    }
  | {
      op: "ellipse";
      at: Pt;
      w?: number;
      h?: number;
      label?: string;
      size?: Size;
      color?: Ink;
    }
  | { op: "curve"; points: Pt[]; color?: Ink }
  | {
      op: "polygon";
      points: Pt[];
      label?: string;
      side_labels?: string[];
      size?: Size;
      color?: Ink;
    }
  | {
      op: "notes";
      at?: Pt;
      title?: string;
      lines?: string[];
      compact?: boolean;
      color?: Ink;
    }
  | {
      op: "graph";
      at?: Pt;
      w?: number;
      h?: number;
      x_range?: Pt;
      y_range?: Pt;
      series?: Series[];
      markers?: Marker[];
      title?: string;
      xlabel?: string;
      ylabel?: string;
    }
  | {
      op: "axes";
      at?: Pt;
      w?: number;
      h?: number;
      xlabel?: string;
      ylabel?: string;
      color?: Ink;
    }
  | {
      // modelo 3D interactivo: o cartão no quadro abre um painel com three.js.
      // model é um preset local ("cell"…) ou "sandflow" (pesquisado no
      // catálogo Sand3D e desenhado a partir do GLB real).
      op: "model3d";
      model: string;
      query?: string;
      // referência já resolvida para um GLB do Sandflow
      ref?: SandflowModel;
      // nomes das partes que ficam colados ao modelo 3D
      labels?: string[];
      at?: Pt;
      w?: number;
      h?: number;
      title?: string;
      color?: Ink;
    }
  | {
      op: "motion";
      points: Pt[];
      label?: string;
      color?: Ink;
      radius?: number;
      trail?: boolean;
      start_ms?: number;
      duration_ms?: number;
    }
  | {
      // Composite scene: each element has an independent start and duration.
      op: "scene";
      elements: { at_ms: number; duration_ms: number; op: Op }[];
      start_ms?: number;
      duration_ms: number;
    }
  | {
      op: "code";
      lines: string[];
      focus?: number[];
      lang?: string;
      title?: string;
      at?: Pt;
      w?: number;
      h?: number;
    }
  | {
      op: "plot3d";
      kind: "surface" | "ridgeline";
      fn?: "gaussian" | "saddle" | "bowl" | "wave" | "ripple";
      path?: Pt[];
      marker?: { at: Pt; label?: string };
      groups?: { label?: string; mean: number; spread: number; skew?: number; color?: Ink }[];
      title?: string;
      xlabel?: string;
      ylabel?: string;
      zlabel?: string;
      at?: Pt;
      w?: number;
      h?: number;
    }
  | { op: "underline"; at: Pt; w?: number; color?: Ink }
  | { op: "highlight"; at: Pt; w?: number; color?: Ink }
  | { op: "dot"; at: Pt; label?: string; label_at?: Pt; color?: Ink }
  | { op: "hotspot"; at: Pt; label: string; detail: string; color?: Ink }
  | { op: "erase"; id?: string }
  | { op: "clear" };

export type Item = {
  id: string;
  op: Op;
  seed: number;
};

// pergunta de verificação no fim da página
export type Check = {
  prompt: string;
  options: string[];
  answer_index: number;
  explanation?: string;
};

export type Step = {
  // Cada passo é uma página autónoma do feed vertical.
  title?: string;
  subtitle?: string;
  say: string;
  // versão escrita do passo, para a página (texto de ensino completo)
  write?: string;
  // resumo final "Para lembrar" da página, quando o modelo o devolve
  recap?: { title: string; lines: string[] };
  // números-chave, exemplo com contas e erro comum
  numbers?: { label: string; value: string }[];
  example?: string;
  mistake?: { wrong: string; right: string };
  board: Op[];
};

export type Lesson = {
  title?: string;
  // linha por baixo do título, à maneira das páginas do Clicky
  subtitle?: string;
  // continuações recomendadas para a página seguinte (2, curtas)
  suggestions?: string[];
  // pergunta rápida de escolha múltipla, respondida no fim da página
  check?: Check;
  // Página única: o quadro completo e o texto escrito por baixo.
  board?: Op[];
  note?: string;
  say?: string;
  // legado: aulas antigas em passos (e a aula de exemplo)
  steps: Step[];
};
