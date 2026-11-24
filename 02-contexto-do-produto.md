# Viently — contexto do produto para agentes

Este documento explica o que o Viently é, que experiência deve oferecer e quais decisões pedagógicas e técnicas não podem ser contrariadas durante o desenvolvimento. Lê-o antes de alterar a experiência, o prompt de ensino, o gerador de aulas ou o feed.

## 1. O que é o Viently

O Viently é uma aplicação de ensino assistida por IA. O aluno escreve uma pergunta ou um tema e recebe uma explicação construída como uma sequência de páginas visuais e interactivas, num feed vertical.

Não é um chatbot tradicional, não é uma aplicação de flashcards e não é principalmente uma aplicação de testes. A unidade central da experiência é uma **página de ensino**: uma composição legível que explica uma ideia através de texto e, quando isso melhora a compreensão, elementos visuais ou interacções.

A aplicação deve dar a sensação de que um tutor está a construir a explicação à frente do aluno: o texto aparece progressivamente e os desenhos/diagramas são apresentados como parte da explicação. A animação de escrita actual começa depois de a resposta estruturada da IA chegar; não deve ser descrita como streaming real de tokens.

## 2. Como funciona a experiência do aluno

1. O aluno escreve uma pergunta, por exemplo: «Como funciona uma turbina?» ou «O que é a inflação?».
2. A IA interpreta a intenção e prepara uma explicação estruturada.
3. O Viently apresenta uma primeira página que responde directamente à pergunta e introduz a ideia principal.
4. O aluno pode fazer scroll vertical para continuar a sequência. As páginas seguintes aprofundam o mesmo tema, explicam mecanismos, exemplos, consequências, aplicações ou limites.
5. O aluno também pode usar sugestões de continuação ou escrever uma nova pergunta. Uma continuação deve preservar o contexto da aula e avançar a explicação, sem recomeçar do zero nem repetir conteúdo sem motivo.
6. Ao longo da sequência, a IA pode incluir uma verificação de compreensão, um exemplo, um erro comum, uma recapitulação ou uma interacção visual, se isso for útil.

O scroll não deve ser apenas uma forma de dividir um texto comprido em ecrãs. Cada página deve acrescentar uma ideia ou camada de compreensão. A sequência deve ter continuidade, mas cada página também deve fazer sentido por si.

## 3. O que pode aparecer numa página

A IA escolhe a composição conforme o assunto e o objectivo pedagógico. A página pode combinar:

- **Texto explicado:** definição, raciocínio, passos, comparação ou explicação causal. O texto deve ser claro, concreto e adequado ao espaço.
- **Desenhos e diagramas 2D:** formas, setas, etiquetas, esquemas, linhas temporais, relações entre componentes ou processos.
- **Gráficos:** quando existem dados, funções, tendências ou relações quantitativas que beneficiem de representação gráfica.
- **Modelos 3D:** modelos existentes em bibliotecas/presets, quando um objecto ou estrutura espacial for importante para compreender o tema. Não fingir que um modelo aproximado é exacto.
- **Hotspots:** pontos tocáveis num desenho para revelar informação sobre partes específicas.
- **Exemplos e analogias:** para ligar a teoria a situações concretas.
- **Erros comuns:** mostrar uma confusão plausível e corrigir o raciocínio.
- **Recapitulação:** síntese curta quando ajuda a consolidar a ideia.
- **Perguntas de revisão:** ver secção 4.

Nem todas as páginas precisam de todos estes elementos. Uma página pode ser sobretudo texto; outra pode ser um diagrama; outra pode usar um gráfico ou um modelo 3D. A composição deve ser escolhida pelo valor pedagógico, não para demonstrar funcionalidades.

## 4. Perguntas e quizzes: política exacta

O Viently **tem suporte para uma pergunta interactiva de revisão de escolha múltipla**, mas não deve obrigar a IA a criar perguntas em todas as aulas nem a intervalos fixos.

Comportamento actual:
- O modelo pode devolver um campo `check` com enunciado, opções, índice da resposta correcta e explicação.
- O gerador valida esse campo. Se estiver ausente ou inválido, a aula segue sem pergunta.
- Se existir, a aplicação cria uma página própria para a pergunta, depois das páginas explicativas.
- A resposta do aluno é avaliada e a aplicação mostra feedback/explicação.
- O prompt instrui a IA a usar a pergunta apenas quando verificar a compreensão acrescentar valor.

Princípios:
- Não criar uma pergunta só para preencher uma página.
- Não transformar a aplicação num quiz app.
- Não impor «uma pergunta a cada X páginas».
- A pergunta deve testar o raciocínio que acabou de ser ensinado, não um detalhe aleatório.
- As opções erradas devem representar confusões plausíveis.
- A explicação da resposta deve ensinar mesmo quando o aluno erra.
- Uma pergunta respondida correctamente não prova, por si só, domínio duradouro do tema.

As sugestões de continuação são diferentes de quizzes: são atalhos opcionais para aprofundar ou explorar outro ângulo. Não devem ser tratadas como avaliação.

## 5. Como a IA deve decidir a sequência

A IA deve começar por responder ao pedido real do aluno. Depois, quando o aluno continua a fazer scroll ou pede aprofundamento, deve avançar por camadas úteis, por exemplo:

- intuição e definição;
- como funciona, passo a passo;
- componentes e relações;
- exemplo concreto;
- aplicação prática;
- consequências e implicações;
- limites, excepções e casos-limite;
- contrapontos, investigação ou transferência para outras áreas.

Isto é uma orientação, não uma sequência rígida. O tema e a pergunta do aluno determinam o caminho. Se o aluno pedir explicitamente outro aspecto, a IA deve responder a esse pedido em vez de seguir mecanicamente a lista.

Evitar:
- repetir a mesma definição em páginas consecutivas;
- criar páginas de enchimento;
- acrescentar gráficos sem dados ou razão;
- usar 3D quando um desenho 2D explica melhor;
- terminar sempre com resumo e quiz por rotina;
- confundir mais páginas com mais aprendizagem.

## 6. Regras de interface e legibilidade

- O feed é vertical e a navegação entre páginas deve ser previsível.
- Cada página deve caber no ecrã disponível sem esconder conteúdo essencial atrás do composer ou fora da área visível.
- Não reduzir texto até ficar ilegível para fazer caber uma página. Dividir em páginas com sentido.
- Preservar parágrafos, listas numeradas, fórmulas, decimais e notação técnica.
- A animação não pode mudar fonte, tamanho ou geometria do texto quando termina.
- O aluno deve conseguir escrever perguntas com mais do que uma linha.
- Desenhos e etiquetas não podem sobrepor texto ou ficar fora dos limites.
- Se o layout tiver de simplificar um desenho, a simplificação não pode alterar o significado. Se faltar informação essencial, deve ser pedido ao modelo que gere uma composição mais simples em vez de ocultar silenciosamente partes importantes.

## 7. Regras técnicas e de segurança

- A IA devolve dados estruturados; a aplicação valida-os e o renderer nativo constrói a interface.
- Nunca executar código, HTML ou JavaScript produzido pelo modelo.
- Validar limites, coordenadas, URLs, índices de respostas e operações antes de renderizar.
- No máximo um modelo 3D e quatro hotspots por página.
- Usar assets 3D existentes. Não afirmar autoria ou licença sem metadados fiáveis.
- Optimizar para telemóveis: pausar animações e WebViews que não estão visíveis, evitar renders desnecessários e limitar o custo de gráficos 3D.
- Voz, microfone, captura de ecrã, sobreposições e observação do ecrã estão fora do âmbito actual.
- Não introduzir funcionalidades só porque são tecnicamente possíveis. A pergunta principal é sempre: «Isto ajuda o aluno a compreender melhor?».

## 8. Estado actual vs. visão do produto

O código activo está em `app-ios/` (Expo / React Native). O modelo já pode produzir texto estruturado, operações visuais 2D, gráficos suportados pelo renderer, hotspots, metadados de modelo 3D, exemplos, erros comuns, recapitulações, sugestões e uma pergunta opcional de revisão.

A aplicação já apresenta páginas num feed vertical e pode acrescentar uma página de pergunta no fim quando a IA devolve um `check` válido. O prompt orienta a escolha pedagógica dos elementos.

Não assumir que todas as capacidades estão perfeitas só por existirem no esquema. A qualidade real depende da validação dos dados, do layout, do renderer e de testes no dispositivo. A animação de escrita actual é uma revelação progressiva local após a resposta completa, não streaming de tokens. O layout 2D continua a precisar de testes visuais reais em diferentes tamanhos de ecrã.

## 9. Regra de decisão para qualquer alteração

Antes de implementar uma funcionalidade, responde a estas perguntas:

1. Ajuda a explicar ou explorar melhor o tema?
2. É mais clara do que uma alternativa mais simples?
3. Mantém a página legível e utilizável num iPhone?
4. A IA pode escolher quando é útil, em vez de ser forçada em todas as páginas?
5. Existe validação e um fallback se a IA devolver dados incompletos ou inválidos?

Se a resposta for não, não acrescentar a funcionalidade por rotina.
