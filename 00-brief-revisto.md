# Viently — brief actual

## Produto

Viently é uma aplicação educativa mobile-first, construída com Expo e React Native. O aluno escreve uma pergunta e recebe uma sequência de páginas de ensino num feed vertical. Não é um chatbot tradicional, nem um sistema de flashcards.

Cada página combina, quando isso ajuda a ensinar:
- texto de explicação com revelação progressiva;
- diagramas e ilustrações 2D;
- gráficos, fórmulas e cartões curtos;
- modelos 3D interactivos provenientes de bibliotecas externas ou presets locais;
- hotspots para explorar partes de um desenho;
- uma pergunta de verificação quando acrescenta valor.

O modelo devolve dados estruturados. O código valida esses dados e o renderer fixo constrói a interface. O modelo nunca escreve componentes nem executa código.

## Decisões de produto

- A entrada é por texto. Voz e microfone estão fora do âmbito actual.
- Não há leitura, captura ou sobreposição do ecrã do utilizador.
- Não se gera geometria 3D com IA. A aplicação escolhe modelos existentes e usa diagramas 2D quando não há um modelo adequado.
- Não se força um gráfico, quiz, cartão ou modelo 3D em todas as páginas.
- O feed é vertical e cada página deve caber no ecrã sem cortar conteúdo essencial.
- A escrita é revelada progressivamente depois de a resposta estruturada chegar. Isto é uma animação de escrita, não streaming de tokens do servidor.
- A continuidade deve usar o histórico completo e o perfil de aprendizagem como evidência, sem declarar domínio com base numa única resposta.

## Stack actual

- Expo SDK 58, React 19, React Native 0.88 e TypeScript.
- Uma aplicação principal em app-ios/App.tsx; não usar Expo Router sem uma decisão explícita de arquitectura.
- SVG para diagramas 2D e WebView/Three.js para os modelos 3D.
- OpenRouter para geração estruturada; chave BYOK guardada no dispositivo.
- AsyncStorage para cache e progresso local.
- Testes Node integrados com tsx, executados por npm test.
- GitHub Actions valida TypeScript, testes, alinhamento Expo e exportação Metro para iOS.

## Regras de implementação

1. Preservar texto, listas, fórmulas e quebras de linha na paginação.
2. Usar o mesmo renderer para texto em animação, página concluída e pré-visualização.
3. Validar e limitar operações visuais antes de as renderizar.
4. Não aceitar modelos 3D duplicados nem hotspots ilimitados.
5. A cache tem de incluir profundidade, perfil de aprendizagem e histórico relevante.
6. Não inventar autores ou licenças de modelos externos. Se os metadados não existirem, indicar que não estão disponíveis.
7. Evitar ciclos de animação activos quando o modelo 3D está parado ou fora de vista.
8. Não declarar a aplicação pronta para produção sem testes num iPhone real, incluindo rotação, teclado, WebViews, memória e comportamento térmico.
