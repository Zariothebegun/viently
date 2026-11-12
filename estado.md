# Estado — Viently

Atualizado: 2026-11-04 · Dono deste ficheiro: Agente A

## Fase

**Fase 1 — Protótipo iOS.** Stack revista para Expo (React Native). O protótipo web fica como referência visual, não como produto.

## Tarefas

| # | Tarefa | Dono | Estado |
|---|---|---|---|
| 1 | Brief revisto + cortes de âmbito | A | ✅ feito |
| 2 | Arquitetura + schema dos blocos | A | ✅ feito |
| 3 | Divisão de agentes | A | ✅ feito |
| 4 | Pesquisa dos 4 repositórios + licenças | B | ✅ feito e verificado → `03-pesquisa-repos.md` |
| 5 | Prompt do tutor + 3 aulas-piloto | C | ✅ entregue, revisto e corrigido → `04-conteudo-piloto.md` |
| 6 | Protótipo web (referência visual) | A | ✅ feito → `app/` |
| 7 | Projeto Expo (iOS) | A | 🔄 em curso → `app-ios/` |
| 8 | Renderer iOS: texto, cartões, diagrama, quiz, gráfico | A | ✅ portado |
| 9 | Renderer iOS: 3D interactivo (three.js em WebView, vista explodida) | A | ✅ feito |
| 10 | Voz no iOS (`expo-speech`) | A | ✅ feito · microfone fora do Expo Go |
| 11 | Abrir no iPhone via Expo Go | A + utilizador | 🔄 túnel pronto |
| 12 | Chave OpenRouter + ligação real ao modelo | A + utilizador | ✅ chave no dispositivo · modelo gratuito com fallback |
| 13 | Guião de 3 minutos para a PAP | C escreve, A executa | ✅ escrito · ⏸ ensaiar |
| 14 | Desenho progressivo (traço a traço, letra a letra, 0,07 s/letra, 0,18 s entre elementos) | A | ✅ feito |
| 15 | Páginas com transição horizontal, voltar/avançar e histórico por página | A | ✅ feito |
| 16 | Continuações recomendadas no fim da página | A | ✅ feito |

## Modelos 3D disponíveis

| id | modelo | partes |
|---|---|---|
| `cell` | célula animal | membrana, núcleo, mitocôndria, Golgi, retículo |
| `motor` | motor eléctrico | carcaça, estator, rotor, veio, ventoinha, terminais |
| `atom` | átomo | núcleo, três camadas electrónicas |

O cartão `model3d` desenha-se no quadro e abre o painel ao toque (arrastar para rodar,
beliscar para aproximar, barra de explosão, raios X).

## Bloqueios

Nenhum.

## Decisões fechadas

- O produto é **app iOS**. O site em Safari foi descartado como produto.
- Pré-visualização via **Expo Go** com `--tunnel`: sem Mac, sem Xcode, sem conta de developer.
- 3D vem de **geometria paramétrica escrita à mão** dentro de uma **WebView** com three.js
  (o `expo-gl`/`expo-three` está parado e quebra na New Architecture). Sem GLB, sem dev build.
- Animações e ilustrações geradas ficam **fora da v1**.
- O modelo devolve **JSON validado** (Zod), nunca código nem UI.
