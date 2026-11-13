# Viently

Tutor educativo mobile-first que explica e desenha através de páginas interactivas num feed vertical. O aluno escreve uma pergunta; a app constrói uma explicação visual com texto progressivo, diagramas 2D, gráficos, cartões e, quando adequado, modelos 3D existentes.

## Aplicação actual

- app-ios/: produto activo, Expo / React Native.
- app/: protótipo web antigo, apenas referência.
- _stage/ e _ref/: código histórico de referência; não fazem parte da app activa.
- 00-brief-revisto.md: âmbito actual do produto.
- 02-contexto-do-produto.md: contexto canónico da experiência, pedagogia e política de perguntas para agentes.
- 01-arquitetura.md: fluxo e stack actuais.
- app-ios/AGENTS.md: regras de desenvolvimento para agentes.

## Desenvolvimento

Na pasta app-ios/:

```bash
npm install
npm test
npx tsc --noEmit
npx expo start
```

O GitHub Actions também valida o alinhamento das dependências Expo e faz uma exportação Metro para iOS.

## Estado de validação

Os testes automatizados não substituem um teste num iPhone real. Antes de lançamento é necessário validar o teclado, paginação e clipping, gestos do feed, WebViews 3D, memória, desempenho e aquecimento.
