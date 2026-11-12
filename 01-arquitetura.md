# 01 — Arquitetura

## Princípio

O modelo **nunca escreve UI**. Escreve dados. Um renderer fixo transforma dados em componentes. Isto permite: validar, versionar o schema, trocar de modelo, trocar de UI, e nunca executar código gerado.

```
pergunta (+ histórico)
        │
        ▼
  LLM (OpenRouter)  ──►  JSON bruto
        │
        ▼
  validação Zod  ──falha──► reparação (1 tentativa) ──falha──► erro visível
        │ ok
        ▼
  store da aula  ──►  renderer (registry de blocos)  ──►  UI
        │
        └──►  fila de narração  ──►  TTS (Web Speech API)
```

## Stack v1

| Camada | Escolha | Porquê |
|---|---|---|
| Build | Vite + React 18 + TypeScript | Arranque em segundos, zero configuração |
| Estilo | CSS Modules ou Tailwind | Rapidez; sem design system pesado |
| Estado | Zustand | Uma store para a aula; menos cerimónia que Redux |
| Validação | Zod | Schema = fonte de verdade + tipos TS derivados |
| Gráficos | Recharts | Componentes declarativos, sem WebGL |
| Diagramas 2D | SVG próprio (`flow`, `cycle`, `tree`, `compare`) | Controlo total, leve, animável por CSS |
| Fórmulas | KaTeX | Rápido, sem MathJax |
| 3D | `@react-three/fiber` + `drei` | Three.js idiomático em React |
| LLM | OpenRouter | Um endpoint, muitos modelos, troca sem reescrever |
| Voz | Web Speech API (`SpeechSynthesis` + `SpeechRecognition`) | Grátis, sem chave |
| Chave API | Proxy mínimo Node/Express **ou** `.env` local | Nunca no cliente em produção; em dev local é aceitável |

## Schema dos blocos (v1)

```ts
type Block =
  | { id: string; type: "text";    title?: string; markdown: string; say?: string }
  | { id: string; type: "card";    title: string; items: { term: string; definition: string }[]; say?: string }
  | { id: string; type: "chart";   title: string; chart: "line"|"bar"|"scatter"|"pie";
                                   xLabel?: string; yLabel?: string;
                                   series: { label: string; data: { x: number|string; y: number }[] }[];
                                   say?: string }
  | { id: string; type: "diagram"; title: string; kind: "flow"|"cycle"|"tree"|"compare";
                                   nodes: { id: string; label: string; detail?: string }[];
                                   edges?: { from: string; to: string; label?: string }[];
                                   say?: string }
  | { id: string; type: "formula"; title?: string; latex: string; explanation?: string; say?: string }
  | { id: string; type: "model3d"; title: string; assetId: string;
                                   params?: Record<string, number|string>;
                                   hotspots?: { id: string; label: string; description: string }[];
                                   say?: string }
  | { id: string; type: "quiz";    title?: string; question: string; options: string[];
                                   answerIndex: number; explanation?: string };
```

Envelope da resposta:

```json
{
  "lessonTitle": "Divisão celular",
  "level": "basico",
  "blocks": [ ... ],
  "suggestedNext": ["O que é a meiose?", "Porque é que as células se dividem?"]
}
```

### Regras do schema

- `type` é uma união discriminada — Zod garante que cada bloco só tem os campos que lhe pertencem.
- `id` é obrigatório e único; permite atualizar um bloco sem re-renderizar a aula toda.
- `say` é opcional: é o texto que o TTS lê. Se faltar, lê-se o `title` + conteúdo principal.
- Limites duros: máx. 12 blocos por resposta, máx. 2500 caracteres de `markdown`. Impede respostas-monstro.

## Biblioteca 3D (v1)

`cell-animal`, `cell-plant`, `atom`, `solar-system`, `cube`, `sphere`, `molecule-water`

Cada asset expõe `hotspots` com ids fixos. A IA escolhe o asset e escreve as descrições; não inventa geometria. Ao clicar num hotspot, o app envia ao modelo: `assetId + hotspotId` e recebe uma explicação curta.

## Estrutura de pastas

```
viently/
├── src/
│   ├── app/            App, layout, rotas
│   ├── llm/            cliente OpenRouter, prompt do sistema, reparação
│   ├── schema/         blocos.ts (Zod) + tipos derivados
│   ├── renderer/       registry.tsx + um ficheiro por bloco
│   ├── assets3d/       modelos e hotspots
│   ├── voice/          TTS + STT
│   └── store/          aula (zustand)
├── server/             proxy da chave (opcional em dev)
└── docs/               cópia dos ficheiros deste dossier
```

## Riscos

| Risco | Mitigação |
|---|---|
| Modelo devolve JSON inválido | Schema estrito + 1 tentativa de reparação + erro legível |
| Bloco visual fica feio com dados reais | Cada renderer tem estado vazio e limite de itens |
| 3D pesa no portátil da escola | Modelos de baixo polígono, `Suspense`, carregar só quando o bloco aparece |
| Custo de tokens | Modelo barato por omissão; máx. 12 blocos; cache da aula |
| Depência de um repositório externo | Só se reutiliza código com licença compatível e manutenção ativa |
