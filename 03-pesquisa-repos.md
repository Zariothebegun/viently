# 03 — Pesquisa de repositórios

Produzido por `studio-bentenceto` (agente Gemini), verificado por mim contra a API do GitHub em 2026-11-02.

## Verificação independente (API GitHub)

| Repositório | Licença (API) | Último push | Stars | Bate com o relatório? |
|---|---|---|---|---|
| `CopilotKit/OpenIntelligentUI` | MIT | 2026-10-13 | 4111 | ✓ (o antigo `OpenGenerativeUI` redireciona mesmo para este) |
| `SSHdotCodes/tutori` | Apache-2.0 | 2026-07-23 | 1 | ✓ |
| `doselwon11/VisionMentor` | **nenhuma detetada** | 2026-03-16 | 0 | ⚠ licença só no README, sem ficheiro `LICENSE` |
| `farzaa/clicky` | MIT | 2026-10-28 | 7906 | ✓ |

⚠ **VisionMentor: a API não reporta licença.** O README diz MIT mas não há `LICENSE` na raiz. Para a PAP, **não copiar código** — usar apenas a ideia e escrever o nosso. Citá-lo como inspiração, não como dependência.

## Resumo por repositório

### 1. CopilotKit / OpenIntelligentUI — MIT, ativo
Monorepo Turborepo, Next.js 16 + React 19 + backend Python (FastAPI + LangGraph). Gera UI em **iframe sandbox** com `@jetbrains/websandbox`.
- **Aproveitar:** o padrão de iframe isolado, e a ordem de streaming (height → placeholder → css → html → js).
- **Descartar:** o SDK CopilotKit (`-next`, preso ao cloud deles), o backend Python, o router proprietário "Jev".

### 2. SSHdotCodes/tutori — Apache-2.0, protótipo congelado
Gradio + Python + **Vanilla JS sobre Canvas**. É o mais parecido com o Viently em intenção.
- **Aproveitar:** o motor de desenho (`static/board.js`) — traço manual, curvas, setas, caixas, gráficos com eixos; a **sincronização voz↔desenho** (cada primitiva tem custo temporal e é interpolada ao longo da frase falada); o **`layout_pass`** anti-colisão que empurra caixas e reposiciona setas.
- **Descartar:** o wrapper Gradio e o áudio pago.
- **Risco:** tudo em Python/Vanilla — portar para TypeScript dá trabalho.

### 3. doselwon11/VisionMentor — sem licença, abandonado
Next.js + FastAPI + Gemini 2.5 Flash.
- **Aproveitar:** só a **ideia** do prompt que força o LLM a emitir SVG limpo com `viewBox` fixo e fallback.
- **Descartar:** o resto. Fluxo em duas chamadas = latência alta.

### 4. farzaa/clicky — MIT, congelado (código principal fechado)
App macOS em Swift + Cloudflare Worker. É a origem do HeyClicky.
- **Aproveitar:** o conceito de **tags inline no stream** (`[POINT:x,y:label]`) que o cliente interpreta sem quebrar o texto; e o worker mínimo como proxy de chave.
- **Descartar:** Swift, ElevenLabs, AssemblyAI.

### HeyClicky
`heyclicky.com` está online. É produto comercial ($20–100/mês), app de desktop Mac/Windows com avatar que **desenha sobre o ecrã** enquanto fala. Confirma a direção: o desenho é o produto, não um extra.

## Comparação das três arquiteturas de "UI gerada por IA"

| Critério | JSON de blocos (Viently) | Componentes React em stream (CopilotKit) | HTML/JS em sandbox |
|---|---|---|---|
| Segurança | Máxima | Média | Média/baixa |
| Simplicidade | Alta | Muito baixa | Baixa |
| Sincronizar com voz | Fácil (cada bloco tem `say`) | Difícil | Muito difícil |
| Falha do modelo | Zod apanha, fallback | Props inválidas partem a árvore | Página em branco |

## Decisão final

**Manter JSON de blocos.** Confirmado por três razões independentes: segurança, sincronização com voz e recuperação de erro.

Duas ideias a importar **como conceito**, sem copiar código:
1. **Sincronização temporal** do tutori: a narração de cada bloco controla quando o bloco aparece/anima. É o que faz parecer "a desenhar enquanto explica".
2. **Tags inline** do clicky: um marcador dentro do texto que aponta para um hotspot 3D ou nó de diagrama. Permite dizer "olha para *isto*" sem um campo extra no schema.

**Não portar** o motor Canvas do tutori. O nosso SVG + Recharts + three.js é mais simples de manter e não exige reescrever Python em TS.
