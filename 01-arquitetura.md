# Viently — arquitectura actual

## Fluxo principal

```
pergunta do aluno + histórico + perfil
              |
              v
       generateLesson()
              |
              v
    OpenRouter / modelo escolhido
              |
              v
         JSON estruturado
              |
              v
      parseLesson + sanitizeOps
              |
              v
    paginação + páginas do feed
              |
              v
      renderer React Native
       /       |        \
      2D      texto      3D
     SVG    progressivo  WebView
```

O modelo devolve conteúdo e operações visuais como dados. Nunca devolve JSX, HTML executável ou código a avaliar. sanitizeOps é a fronteira que aceita apenas operações conhecidas e aplica limites.

## Stack

| Camada | Implementação |
|---|---|
| App | Expo SDK 58, React 19, React Native 0.88, TypeScript |
| Entrada | Campo de texto multi-linha |
| Geração | OpenRouter, resposta JSON/schema com fallbacks |
| Validação | parseLesson e sanitizeOps em src/lesson/generate.ts |
| Feed | App.tsx, páginas verticais, páginas de avaliação separadas |
| Paginação | src/lesson/pagination.ts, preserva linhas e divide por palavras |
| Quadro 2D | SVG em src/board/Board.tsx |
| Layout 2D | src/board/layout.ts, estimativa geométrica e prevenção de colisões |
| Modelos 3D | presets locais e catálogo Polyfork, renderizados em WebView/Three.js |
| Continuidade | histórico por página, sugestões de continuação e profundidade |
| Aprendizagem | src/lesson/mastery.ts, evidência local em AsyncStorage |
| Cache | AsyncStorage, chave inclui perfil, profundidade e histórico recente |
| Testes | app-ios/tests/*.test.mjs, executados com npm test |

## Regras de apresentação

- O texto activo, concluído e pré-visualizado usa o mesmo componente.
- A animação de escrita começa depois de o JSON completo ser recebido. Não é streaming de tokens HTTP.
- A paginação preserva listas e parágrafos e não divide decimais em falsos finais de frase.
- A página não deve esconder texto essencial. O limite de caracteres é uma protecção aproximada, não uma medição real de layout.
- A página de quiz tem índice próprio, depois das páginas explicativas.
- O quadro pode usar 2D sem 3D. Um modelo aproximado ou sem metadados fiáveis não deve ser apresentado como exacto.

## Limites e riscos conhecidos

- O layout 2D continua a ser heurístico, não um solver matemático. Tem de ser validado com exemplos visuais variados.
- A exportação Metro e o TypeScript não provam que a interface fica correcta num iPhone.
- WebViews, GPU, aquecimento, memória e teclado exigem teste no dispositivo real.
- O streaming real do fornecedor não está implementado; existe revelação progressiva do texto após a resposta.
- O progresso do aluno é local ao dispositivo, não sincronizado entre dispositivos.
