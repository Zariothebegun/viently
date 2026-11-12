# 02 — Divisão de agentes

Três agentes, três saídas separadas. Nenhum escreve no ficheiro de outro.

## Agente A — `Novo agente` (este, orquestrador)

**Papel:** dono da arquitetura e do código.

- Fixar o schema dos blocos e o prompt do sistema.
- Implementar o protótipo: cliente LLM, validação, renderer, 5 blocos da v1, voz.
- Integrar os resultados dos agentes B e C.
- Único autor de `estado.md` e do código em `viently/`.

**Entrega:** protótipo a correr.

## Agente B — `studio-bentenceto` (Gemini / AI Studio)

**Papel:** investigação e licenças. Não escreve código no projeto.

- Analisar os 4 repositórios: `CopilotKit/OpenGenerativeUI`, `SSHdotCodes/tutori`, `doselwon11/VisionMentor`, `farzaa/clicky`.
- Para cada um: licença exata, última atualização, stars, stack, o que é reutilizável, o que **não** é, e riscos de dependência.
- Comparar as arquiteturas de geração de UI e dizer qual imitar.
- Verificar se `heyclicky.com` é acessível e o que mostra.

**Entrega:** `03-pesquisa-repos.md` (devolve na resposta; o orquestrador grava).

**Proibido:** instalar, clonar para o projeto, ou copiar código para `viently/`.

## Agente C — `studio-aniceto1manuel` (Gemini / AI Studio)

**Papel:** conteúdo pedagógico e qualidade do tutor.

- Escrever o **prompt do sistema** em português de Portugal, com regras de quando usar cada tipo de bloco.
- Definir 3 aulas-piloto: mitose, equações do 2.º grau, sistema solar — cada uma com os blocos esperados.
- Criar 10 perguntas de teste e o que seria uma boa resposta para cada.
- Guião de 3 minutos para a demonstração na PAP.

**Entrega:** `04-conteudo-piloto.md` (devolve na resposta; o orquestrador grava).

**Proibido:** definir stack, schema ou escrever código.

## Regras de coordenação

1. **Um ficheiro, um dono.** B e C não tocam em `viently/src/`.
2. **Sem edições simultâneas.** Se precisas de mudar um ficheiro de outro, pede; não escrevas.
3. **Estado no `estado.md`.** Só o Agente A o atualiza.
4. **Contexto por mensagem.** Cada agente recebe o que precisa; não vê as conversas dos outros.
5. **Entrega com fonte.** Toda a afirmação sobre um repositório leva link e data.
6. **Nada de commits sem revisão** quando o projeto for para git.

## Ordem

```
A: schema + prompt base          ─┐
B: pesquisa repos + licenças     ─┼─► A integra ─► protótipo ─► demo
C: prompt final + aulas-piloto   ─┘
```

B e C correm em paralelo com A. A não espera por eles para começar o esqueleto.
