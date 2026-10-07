# Playbook de Geração, UI/UX e Qualidade — RK Sucatas

Este documento transforma pesquisa de engenharia, design e uso de agentes em regras práticas para o sistema. Ele é complementar ao `AGENTS.md`, `CLAUDE.md`, `docs/AI_CONTEXT.md` e `docs/AI_WORKFLOW.md`.

## 1. Fluxo permanente: Prompt → refinar → executar

Todo prompt de trabalho recebido do usuário passa por este fluxo:

1. **Prompt:** capturar objetivo, contexto, restrições, arquivos envolvidos e resultado esperado.
2. **Refinar no `prompt-master`:** converter o pedido em uma instrução curta, específica para Codex/Claude Code, com estado inicial, estado final, escopo permitido, ações proibidas, critérios de aceite, validações e condição de parada.
3. **Executar:** investigar o repositório, selecionar skills, implementar ou pesquisar dentro do escopo refinado.
4. **Verificar:** executar evidências proporcionais ao risco; nunca substituir teste por confiança na geração.
5. **Entregar:** resumir resultado, arquivos, validações, riscos, limitações e próximos passos.

### Contrato de prompt refinado

```md
## Contexto
- Projeto e caminho canônicos
- Stack e regras de negócio relevantes
- Estado atual confirmado no código

## Objetivo
<resultado observável, em uma frase>

## Escopo
- Arquivos/domínios permitidos
- O que já existe e deve ser preservado
- O que fica explicitamente fora do escopo

## Critérios de aceite
- <comportamento verificável>
- <estado de erro, vazio, loading e sucesso>
- <responsividade/acessibilidade quando aplicável>

## Restrições
- Não inventar contratos, migrations, dependências ou regras de produto
- Não tocar em dados reais, segredos ou arquivos críticos sem autorização
- Parar diante de decisão de produto, banco, segurança ou contrato não definida

## Validação
- Comandos automatizados pertinentes
- Roteiro visual/navegador quando houver UI
- Revisão de diff e registro das limitações
```

Não incluir instruções de raciocínio oculto, pedir “pense passo a passo” ou inflar o prompt. O objetivo é dar contexto suficiente e verificável, não controlar cada movimento do agente.

## 2. UI/UX para operação de peças, vendas e caixa

### Hierarquia e orientação

- Uma tela deve responder rapidamente: **onde estou, o que mudou, o que posso fazer e qual é o próximo passo**.
- Use uma ação primária por contexto; ações destrutivas devem ser visualmente e semanticamente distintas.
- Mostre números operacionais com hierarquia forte: valor, unidade, status e explicação.
- Preserve contexto durante filtros, paginação, edição e retorno de dialogs.
- Prefira revelação progressiva: mostre primeiro o necessário para decidir; detalhe sob demanda.
- Não esconda informação operacional crítica em tooltip, hover ou cor isolada.

### Estados obrigatórios

Todo módulo visual deve tratar explicitamente:

- carregando/skeleton;
- vazio inicial;
- vazio após busca/filtro;
- erro recuperável;
- erro de permissão;
- offline ou falha de rede, quando aplicável;
- sucesso e confirmação;
- salvamento pendente;
- conflito ou dado desatualizado;
- conteúdo longo, truncado e responsivo.

### Acessibilidade mínima

- Todo controle precisa de nome acessível, foco visível e operação por teclado.
- O foco não pode ficar escondido por sticky headers, sheets, modais ou banners.
- Não depender apenas de cor; combine texto, ícone, forma ou posição.
- Alvos interativos devem respeitar pelo menos 24×24 CSS px no mínimo WCAG 2.2 e preferencialmente uma área confortável para toque.
- Toda operação de arrastar precisa de alternativa por clique, teclado ou seleção explícita.
- Respeite `prefers-reduced-motion`; movimento nunca pode ser o único canal de informação.
- Para formulários, associe label, hint, erro e resumo ao controle correto.

Referência normativa: [WCAG 2.2](https://www.w3.org/TR/wcag/) e [novos critérios do WCAG 2.2](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/).

## 3. Microinterações

Microinteração é uma resposta curta a uma ação ou mudança de estado. Ela deve responder a pelo menos uma destas perguntas:

| Necessidade | Aplicação no RK Sucatas |
| --- | --- |
| Sistema recebeu a ação? | botão muda para salvando; foco permanece; ação não duplica |
| A ação terminou? | confirmação de venda, cliente salvo ou tarefa concluída |
| O que mudou? | linha atualizada, badge de status, total recalculado |
| O que o usuário pode fazer agora? | ação de desfazer, tentar novamente ou corrigir campo |
| Há risco ou bloqueio? | confirmação contextual antes de cancelar venda ou apagar |

Regras:

- Use feedback imediato para ações frequentes, mas mantenha-o breve e discreto.
- Nunca anime por decoração, atraso ou surpresa.
- Não bloqueie a tarefa até a animação terminar; permita cancelar/interromper quando possível.
- Use movimento espacial coerente: elementos que entram e saem devem respeitar a direção da interação.
- Combine movimento com texto, ícone, estado semântico ou foco; movimento sozinho não é comunicação suficiente.
- Evite toasts efêmeros para erros que exigem correção; mostre o erro junto ao campo ou à região afetada.
- Respeite `prefers-reduced-motion` e mantenha a informação completa sem animação.
- Para mudanças de layout, prefira transform/opacity e preserve estabilidade visual.

Referências: [NN/G — Microinteractions](https://www.nngroup.com/articles/microinteractions/), [Apple HIG — Motion](https://developer.apple.com/design/human-interface-guidelines/motion) e [Material — duration/easing](https://m1.material.io/motion/duration-easing.html).

## 4. Componentes e arquitetura de interface

Um componente bom oferece uma interface pequena, previsível e profunda. A complexidade de estados, acessibilidade e integração deve ficar encapsulada; consumidores não devem conhecer detalhes internos desnecessários.

### Checklist de componente

- Qual é a responsabilidade única?
- Quais estados ele possui e como cada um aparece?
- Qual é o nome acessível e a ordem de foco?
- O componente funciona sem mouse, cor ou animação?
- O uso mobile e desktop é definido?
- A API evita dezenas de booleanos e props que se contradizem?
- O componente reutiliza tokens e primitives existentes?
- O teste atravessa a mesma interface usada pelo usuário?
- Há uma variante real antes de criar abstração?

### Padrões preferenciais

- Componha comportamento complexo atrás de uma interface simples.
- Prefira variantes explícitas a combinações implícitas de flags.
- Mantenha regras de negócio fora da apresentação.
- Centralize formatação de moeda, datas, status e mensagens.
- Não criar um componente genérico só porque dois arquivos têm markup parecido; primeiro confirme uma variação real.
- Ao criar uma nova primitive, documente estados, acessibilidade e exemplos de uso.

## 5. Bugs e erros de interface

### Classificação

1. **Descoberta:** usuário não percebe que existe uma ação ou status.
2. **Compreensão:** usuário não entende o rótulo, resultado ou regra.
3. **Execução:** clique, toque, teclado ou gesto não funciona como esperado.
4. **Feedback:** sistema executa, mas não comunica estado, sucesso ou falha.
5. **Recuperação:** erro acontece e não há caminho claro para corrigir.
6. **Persistência:** dados, filtros, foco ou rascunho são perdidos.
7. **Responsividade:** layout quebra em 375px, zoom, teclado virtual ou desktop largo.
8. **Acessibilidade:** semântica, foco, contraste, leitor de tela ou reduced motion falham.

### Contrato de erro

Todo erro visível deve responder:

- o que aconteceu;
- onde aconteceu;
- como corrigir;
- se os dados foram preservados;
- qual ação está disponível agora.

Erros de formulário devem ser específicos, próximos ao campo, associados semanticamente e acompanhados de resumo quando houver vários. Preserve os valores digitados e não culpe o usuário. Erros de serviço devem ser separados de erros de entrada e oferecer retry, suporte ou estado alternativo.

Referências: [GOV.UK — Error message](https://design-system.service.gov.uk/components/error-message/), [GOV.UK — Validation](https://design-system.service.gov.uk/patterns/validation/), [NN/G — Error messages](https://www.nngroup.com/articles/error-message-guidelines/) e [USWDS — Alert](https://designsystem.digital.gov/components/alert/).

### Depuração de bug de UI

1. Reproduza com dados e viewport definidos.
2. Registre ação, estado esperado, estado observado, console e requests.
3. Reduza para o menor fluxo reproduzível.
4. Investigue primeiro contrato, estado, renderização e CSS; não aplique remendos aleatórios.
5. Escreva um teste ou roteiro que falhe antes da correção quando possível.
6. Corrija a causa, não apenas o sintoma visual.
7. Teste o caminho feliz, o erro e a regressão relacionada.

## 6. Como usar Codex e agentes com eficiência

### Prompt de alta qualidade

Um bom pedido informa objetivo, contexto, arquivos, restrições, aceite e validação. Evite “melhore tudo”, “faça igual ao exemplo” ou “corrija os bugs” sem delimitar superfície e evidência.

Use linguagem de resultado:

- fraco: “deixe a tela melhor”;
- forte: “na rota `/tarefas`, reduza a ambiguidade do estado vazio, preserve a busca, adicione foco visível e valide em 375px e 1440px; não altere API nem tokens”.

### Ciclo recomendado

1. **Reconhecer:** agente confirma caminho, branch, estado e arquivos relevantes.
2. **Planejar:** para tarefas grandes, criar plano com unidades testáveis.
3. **Executar:** uma mudança coesa por vez.
4. **Observar:** rodar testes, inspeção visual, console e requests.
5. **Corrigir:** resolver a causa evidenciada.
6. **Revisar:** diff, contrato, segurança, acessibilidade e regressão.

Não empilhe cinco features em um prompt. Separe descoberta, design, implementação e auditoria quando elas exigirem decisões diferentes.

### Subagents

Use subagents para investigação isolada, revisão independente ou frentes realmente paralelas. Não use subagent para uma alteração curta, para substituir `rg`, ou quando dois agentes precisariam editar o mesmo arquivo.

Despacho mínimo:

```md
Você é o subagent <papel>. Trabalhe em modo <read-only|implementação limitada>.
Objetivo: <resultado verificável>.
Leia apenas: <arquivos>.
Não toque em: <arquivos críticos/domínios>.
Entregue: achados com caminhos/linhas, riscos, testes e recomendação.
Pare se encontrar decisão de produto, banco, segurança ou contrato não definida.
```

O agente principal permanece responsável por escopo, integração, conflitos e aceite final.

## 7. Vibecoding eficiente e seguro

Vibecoding é útil para explorar e acelerar implementação, mas não substitui especificação, entendimento mínimo e verificação. A pesquisa da Microsoft descreve confiança em código gerado como algo construído por verificação iterativa, não por aceitação automática.

### Loop operacional

```text
Intenção → hipótese mínima → mudança pequena → teste/preview → evidência → revisão → próxima mudança
```

Práticas:

- Comece por um fluxo observável, não por uma arquitetura imaginada.
- Gere o menor incremento funcional e execute-o imediatamente.
- Mantenha o agente ancorado no código existente e nos contratos reais.
- Revise nomes, estados, efeitos colaterais, autorização e persistência antes de expandir.
- Nunca instale dependência, copie pacote sugerido ou aceite migration inventada sem verificar fonte, versão e impacto.
- Use screenshots, snapshots, console e requests para UI; use testes e diff para código.
- Faça uma pausa de revisão após cada unidade que altera dados, autenticação ou comportamento financeiro.
- Trate velocidade como redução do tempo até evidência, não como redução do tempo até código.

Referências: [Microsoft Research — Vibe coding](https://www.microsoft.com/en-us/research/publication/vibe-coding-programming-through-conversation-with-artificial-intelligence/), [OpenAI — prompt engineering](https://developers.openai.com/api/docs/guides/prompt-engineering), [OpenAI — AGENTS.md](https://developers.openai.com/api/docs/guides/latest-model#using-agents-md) e [OpenAI — ExecPlans](https://developers.openai.com/cookbook/articles/codex_exec_plans).

## 8. Definition of Done para UI e agentes

Uma entrega de interface só está pronta quando:

- o fluxo principal funciona com dados realistas;
- loading, vazio, erro, permissão e sucesso foram considerados;
- teclado, foco, contraste, semântica e reduced motion foram verificados;
- mobile 375px e desktop foram considerados;
- console e requests não mostram falhas introduzidas;
- testes automatizados pertinentes passam;
- o diff não contém abstração, dependência ou refatoração fora do escopo;
- limitações e decisões pendentes estão registradas.

Uma entrega de agente só está pronta quando o resultado pode ser explicado por evidências do repositório, testes ou preview — nunca apenas por uma narrativa plausível.
