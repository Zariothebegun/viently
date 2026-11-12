# 04 — Conteúdo piloto (prompt, aulas, testes, guião)

Produzido por `studio-aniceto1manuel` (agente Gemini). Revisto e **corrigido contra o schema** por mim.

## Correções aplicadas à entrega original

A entrega vinha pedagogicamente boa mas com campos que não existem no schema. Corrigido:

| Vinha | Passa a ser | Onde |
|---|---|---|
| `{ blocks: [...] }` como raiz | `{ lessonTitle, level, blocks, suggestedNext }` | envelope |
| `correctIndex` | `answerIndex` | quiz |
| `description` no quiz | `explanation` | quiz |
| `description` na formula | `explanation` | formula |
| `data: {planeta: valor}` no chart | `series: [{ label, data: [{x,y}] }]` | chart |
| `connections:` em prosa | `edges: [{from,to}]` | diagram |
| `type: "bar"` no chart | `chart: "bar"` | chart |
| `Delta` escrito à mão | `\Delta` em LaTeX | aulas 2 |

Também acrescentei ao prompt: cada bloco **tem** de ter `id` único, e o campo `say` é o texto narrado (a entrega não o mencionava — sem ele não há sincronização voz/visual).

---

## 1. Prompt do sistema (corrigido, pronto a colar)

```text
És o Viently, tutor pedagógico de IA para alunos do ensino básico, secundário e profissional em Portugal.
Ensinas com clareza, empatia e rigor, articulando narração em voz com apoios visuais estruturados.

TOM
- Professor particular exigente e encorajador. Nunca condescendente, nunca infantilizante.
- Português de Portugal: "ecrã", "facto", "parênteses", "equações".
- Começa pela matéria. Sem "Olá, como posso ajudar?".
- Se a pergunta for confusa, assume a interpretação científica mais útil e responde sem repreender.

ADAPTAÇÃO AO NÍVEL
- Básico (7.º–9.º): analogias concretas, etapas curtas, diagramas de sequência, modelos 3D simples.
- Secundário/profissional: nomenclatura formal, ligação à prática oficinal, laboratorial ou profissional.

FORMATO
Devolves APENAS um objeto JSON válido, sem markdown à volta, com esta forma:
{
  "lessonTitle": string,
  "level": "basico" | "medio" | "avancado",
  "blocks": Block[],
  "suggestedNext": string[]   // 2 a 3 perguntas de seguimento
}

Cada bloco tem "id" (string curta e única, ex.: "b1") e "type". Opcionalmente "say": a frase que será lida em voz alta. Se não deres "say", o sistema lê o título e o conteúdo principal.

BLOCOS
- text    { title?, markdown }            Frases curtas, ritmo de fala.
- card    { title, items:[{term, definition}] }  2 a 4 conceitos, nunca repetir o texto corrido.
- chart   { title, chart:"line"|"bar"|"scatter"|"pie", xLabel?, yLabel?, series:[{label, data:[{x,y}]}] }
- diagram { title, kind:"flow"|"cycle"|"tree"|"compare", nodes:[{id,label,detail?}], edges?:[{from,to,label?}] }
- formula { title?, latex, explanation }
- model3d { title, assetId, hotspots:[{id,label,description}] }
- quiz    { title?, question, options:[3 a 4], answerIndex, explanation }

LIMITES
- MÁXIMO 12 blocos. O ideal são 4 a 7. Clarifica antes de encher.
- Máximo 2500 caracteres por bloco de texto.

REGRA DO model3d
Usa só quando o tema for espacial e encaixar num destes assetId:
  cell-animal, cell-plant, atom, solar-system, cube, sphere, molecule-water
Fora destes, é proibido incluir model3d.
Os hotspots são pontos fixos do modelo: escreve só o label e a description, não inventes geometria.

QUANDO NÃO USAR VISUAIS
- Pergunta de confirmação simples ("o mercúrio é líquido à temperatura ambiente?") → só um bloco text.
- Não empilhes gráficos que não acrescentem intuição.

RIGOR
- Não inventes números, datas nem factos. Se não tiveres a certeza, di-lo no bloco.
- Se houver simplificação curricular, menciona-a em meia frase.
```

---

## 2. Aulas-piloto

### Aula 1 — Mitose (secundário / técnico de saúde)
Objetivo: finalidade biológica da mitose, as quatro fases nucleares, cromossomas na placa equatorial e na anáfase.

1. `text` — "A mitose é o processo pelo qual uma célula-mãe diploide duplica o material genético e origina duas células-filhas geneticamente idênticas. Nos seres pluricelulares garante o crescimento dos tecidos e a substituição de células envelhecidas ou danificadas."
2. `model3d` — `cell-animal`. Hotspots: núcleo/ADN (invólucro que se desorganiza na prófase), centrossomas (migram para os polos e organizam o fuso), membrana (estrangulamento final da citocinese).
3. `diagram` `cycle` — Prófase → Metáfase → Anáfase → Telófase → Citocinese → nova interfase.
4. `card` — Cromatídeos-irmãos; Fuso acromático; Placa equatorial.
5. `quiz` — "Em que fase se separam os cromatídeos-irmãos?" → Anáfase (`answerIndex` 2).

### Aula 2 — Equações do 2.º grau (secundário / profissional)
Objetivo: coeficientes na forma canónica, discriminante, fórmula resolvente sem erros de sinal.

1. `text` — forma canónica, `a ≠ 0`, o que decide as soluções.
2. `formula` — `x = \frac{-b \pm \sqrt{b^2-4ac}}{2a}`, com explicação do discriminante `\Delta = b^2-4ac`.
3. `diagram` `tree` — `\Delta > 0`: duas raízes reais distintas · `\Delta = 0`: raiz dupla `-b/2a` · `\Delta < 0`: nenhuma raiz real.
4. `card` — Forma canónica; Atenção ao sinal de `b` (`b=-5` → `-b=+5`); Vértice `x_v = -b/2a`.
5. `text` — exemplo resolvido `x^2-6x+8=0`, `\Delta=4`, `x=4` e `x=2`.
6. `quiz` — "Quantas soluções reais tem `2x^2+3x+5=0`?" → nenhuma (`\Delta=-31`).

### Aula 3 — Sistema Solar (básico, 7.º ano)
Objetivo: organização do sistema, rochosos vs. gasosos, ordem a partir do Sol.

1. `text` — oito planetas, quatro rochosos interiores, quatro gigantes exteriores.
2. `model3d` — `solar-system`. Hotspots: Sol (99,86% da massa), telúricos, gigantes gasosos.
3. `diagram` `compare` — rochosos (pequenos, densos, superfície sólida, poucos satélites) vs. gasosos (gigantes, baixa densidade, muitos satélites, anéis).
4. `chart` `bar` — diâmetro equatorial em milhares de km: Mercúrio 4,88 · Vénus 12,10 · Terra 12,74 · Marte 6,78 · Júpiter 139,82 · Saturno 116,46 · Úrano 50,72 · Neptuno 49,24.
5. `card` — Cintura de asteroides; Unidade astronómica (~150 milhões de km).
6. `quiz` — "Qual destes é telúrico?" → Vénus.

---

## 3. Dez perguntas de teste

| # | Pergunta | Blocos esperados |
|---|---|---|
| 1 | Porque é que o céu é azul e o pôr do sol vermelho? | text, diagram (compare), card, quiz |
| 2 | Diferença entre ligação iónica e covalente na água | text, model3d (molecule-water), diagram (compare), card, quiz |
| 3 | Como calculo a hipotenusa? | text, formula, card, quiz |
| 4 | Como é que a célula vegetal produz alimento? | text, model3d (cell-plant), diagram (flow), card, quiz |
| 5 | Como se calcula a densidade de um cubo de metal? | text, model3d (cube), formula, card, quiz |
| 6 | O que são isótopos? | text, model3d (atom), diagram (compare), quiz |
| 7 | Lei de Ohm e corrente a 230 V | text, formula, card, quiz |
| 8 | Ordem dos planetas | text, model3d (solar-system), diagram (flow), quiz |
| 9 | *"porque é que o x dá negativo?"* (ambígua) | text a validar o negativo, diagram (reta real), card, quiz |
| 10 | *"a cena das células que se dividem é igual nas plantas?"* (coloquial) | text a traduzir a gíria, model3d (cell-plant), diagram (compare), quiz |

As duas ambíguas são as mais importantes: testam se o tutor interpreta em vez de falhar.

---

## 4. Guião de demonstração — 3 minutos

**0:00–0:45 — Problema e proposta**
Dizer: o estudo individual assenta em manuais estáticos e vídeos passivos. O Viently é um explicador que fala e constrói o painel visual ao mesmo tempo.
Apontar: interface — conversa à esquerda, ecrã visual à direita.

**0:45–1:45 — Demonstração ao vivo**
Perguntar: *"Explica-me como funciona a divisão de uma célula animal e quais são as partes principais."*
Apontar: os blocos a aparecer enquanto a voz fala; o modelo 3D da célula; o ciclo da mitose.

**1:45–2:30 — Interação**
Dizer: o aluno não é espetador.
Fazer: rodar a célula 360°, clicar no hotspot do núcleo, descer até ao quiz, responder e mostrar o feedback.

**2:30–3:00 — Fecho**
Dizer: em dois minutos ouviu, viu em 3D, compreendeu o ciclo e testou a retenção. Adapta-se ao ritmo de cada aluno.
Apontar: ecrã final com o histórico de blocos.

**Risco a controlar:** se a rede falhar ao vivo, ter a aula 1 já em cache e um botão de "replay". Nunca mostrar o erro do modelo ao júri.
