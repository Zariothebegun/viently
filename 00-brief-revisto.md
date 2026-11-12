# 00 — Brief revisto

Versão limpa do pedido original (gerado por IA), com decisões tomadas onde o texto era vago, impossível ou caro demais.

## Objetivo

Um tutor que recebe uma pergunta ("explica-me a divisão celular"), responde por voz e texto **e constrói acompanhamento visual em tempo real** — cartões, gráficos, diagramas, fórmulas, modelo 3D interativo — com o qual o aluno pode interagir e continuar a perguntar.

Não é um chatbot com CSS bonito. O que se prova no protótipo é o **pipeline de geração estruturada + renderização validada**.

## O que foi cortado ou corrigido (e porquê)

| Item do texto original | Decisão | Motivo |
|---|---|---|
| iOS / React Native / Expo como base | **Adiado.** Protótipo em web (React + Vite) | Three.js em Expo exige `expo-gl` e trabalho de shaders; debug e hot-reload muito mais lentos. Em web o mesmo código corre no portátil do professor sem App Store nem conta de developer (99 €/ano). Portar para RN depois é trabalho mecânico. |
| "Modelos 3D gerados pela IA" | **Biblioteca de modelos paramétricos** | Um LLM não gera geometria 3D utilizável. A IA escolhe `assetId` + parâmetros de uma biblioteca curada (célula, átomo, sistema solar, sólidos). É honesto e funciona. |
| "Animações e simulações interativas" | **Fora da v1** | É o item mais caro e com maior risco. Fica como v2, e mesmo aí só por templates pré-feitos. |
| "Ilustrações científicas 2D" geradas | **Fora da v1** | Gerar imagens por IA custa dinheiro, é lento e não é interativo. Diagramas SVG paramétricos cobrem o caso pedagógico. |
| 8 requisitos no primeiro protótipo | **5 no protótipo** | Texto, cartões, gráfico, diagrama 2D, modelo 3D. Quiz entra assim que os 5 estiverem estáveis. |
| "Voz" como API paga | **Web Speech API** no protótipo | Grátis, sem chave, TTS em `pt-PT` razoável. Trocar por API paga só se a qualidade travar a demo. |
| "Não executar código arbitrário do modelo" | **Mantido, é central** | O modelo só pode devolver JSON que valida contra um schema Zod. Nada de `eval`, nada de componentes dinâmicos. |
| "Vários agentes sem coordenação" | **Mantido** | Ver `02-divisao-agentes.md`. |

## Requisitos do protótipo (v1)

1. Receber pergunta por texto ou voz.
2. Enviar para o modelo via OpenRouter com *structured output*.
3. Validar a resposta contra o schema; se falhar, uma tentativa de reparação e depois erro visível.
4. Renderizar texto, cartões, um gráfico e um diagrama 2D.
5. Renderizar um modelo 3D interativo (rodar, zoom, clicar em hotspot → explicação).
6. Manter conversa de seguida: "e porque é que a membrana desaparece?" usa o contexto da aula.

## Critério de sucesso da PAP

Uma pessoa que nunca viu o projeto pergunta algo, e em menos de 30 s vê a explicação a construir-se no ecrã com pelo menos um elemento visual interativo, e consegue fazer uma pergunta de seguimento coerente.

## Não-objetivos (dizer isto na apresentação)

- Não é uma app de iOS na v1.
- Não gera 3D nem imagens por IA.
- Não tem contas, turmas, notas nem backend multi-utilizador.

## Referência futura: agent-simulator
- https://github.com/jasonkneen/agent-simulator — simulador iOS no browser, inspecionável: stream MJPEG, árvore de acessibilidade, árvore de componentes React com código-fonte real, tap/swipe/type sem mexer no cursor.
- Bridge MCP (15 tools: sim_tree, sim_tap_by_label, sim_swipe, sim_type, sim_screenshot, …) para agentes conduzirem a app.
- Requisitos: macOS com Xcode + simulador iOS, Node ≥ 18, toolchain Rust (build único do sim-server) e `axe`.
- Utilização planeada: quando formos fazer/testar o app Viently, integrar o plugin metro do agent-simulator na app para inspecionar e conduzir o feed, quiz e 3D a partir do browser/MCP.
