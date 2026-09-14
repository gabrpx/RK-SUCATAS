---
name: ux-user-audit
description: Audita componentes, abas, telas e fluxos de aplicações como um usuário real, usando evidências do código, da interface e da execução para produzir achados priorizados de UX, bugs, acessibilidade, estados, responsividade e riscos de dados.
---

# UX User Audit

Conduza uma auditoria de experiência do usuário sem inventar problemas. Observe o produto pela perspectiva de quem precisa concluir uma tarefa, mas sustente cada conclusão em evidência verificável no código, na interface ou na execução.

## Antes de auditar

1. Leia as instruções de governança e a documentação relevante do projeto.
2. Execute `git status --short --branch` e preserve alterações locais.
3. Confirme o escopo exato: componente, aba, tela ou fluxo.
4. Localize arquivos, rotas, estados, tipos, APIs, permissões e testes relacionados.
5. Reconstitua o caminho principal e os fluxos alternativos antes de concluir.

Se o escopo, a regra de negócio ou a autorização para alterar algo não estiverem definidos, audite o que for observável e marque a decisão humana necessária. Não invente comportamento esperado.

## Percurso do fluxo

Percorra o fluxo como usuário, usando browser, automação de tela ou ambiente executável quando disponível. Teste, quando aplicável:

- entrada na tela, navegação e retorno;
- carregamento, estado vazio, sucesso, erro de API/rede e dados incompletos;
- busca, filtros, ordenação, paginação e persistência dos critérios;
- criação, edição, exclusão, confirmação, cancelamento e recuperação;
- ações destrutivas, duplicidade de envio e dados obsoletos;
- permissões, falta de autorização e sessão expirada;
- desktop, tablet e mobile; mouse, toque, teclado, foco, labels e leitor de tela;
- feedback, validação, mensagens, progresso, consistência visual e número de cliques;
- desempenho percebido e possíveis condições de concorrência.

Se não houver ambiente executável, faça uma auditoria estática cuidadosa e declare essa limitação. Não apresente hipótese como comportamento observado.

## Evidência e classificação

Cada achado deve apontar a evidência concreta: arquivo e linha quando possível, componente, rota, estado, seletor, mensagem exibida ou passos reproduzíveis. Separe explicitamente:

- confirmado: observado no código ou reproduzido;
- risco provável: sinal técnico que precisa de reprodução ou validação;
- sugestão: oportunidade de melhoria, sem afirmar que existe defeito.

Use uma categoria e severidade por achado.

Categorias: `BUG`, `UX`, `A11Y`, `RESPONSIVIDADE`, `ESTADO`, `FEATURE`, `QUALIDADE`, `SEGURANÇA/DADOS`.

Severidades:

- `P0`: impede o uso ou pode causar perda grave de dados;
- `P1`: bloqueia tarefa importante ou gera erro recorrente;
- `P2`: causa atrito relevante, confusão ou inconsistência;
- `P3`: melhoria menor ou refinamento.

Não transforme toda observação em feature. Priorize impacto, frequência, risco e esforço estimado, nessa ordem de decisão; facilidade isolada não define prioridade.

## Limites de implementação

Investigue antes de editar. Reutilize padrões existentes e preserve contratos, dados e regras de negócio. Não adicione dependências sem autorização. Não altere banco, migrations, autenticação, infraestrutura ou APIs públicas sem aprovação. Não apague arquivos, faça mudanças irreversíveis, commit, push, merge ou deploy.

Se a tarefa autorizar correções, implemente diretamente apenas problemas locais, claros e de baixo risco, e registre o antes/depois. Ao encontrar decisão de produto, arquitetura, banco, segurança ou regra financeira não definida, pare nessa parte e solicite decisão humana.

## Relatório obrigatório

Entregue exatamente estas seções:

### 1. Resumo executivo

- fluxo auditado;
- objetivo do fluxo;
- resultado geral;
- principais bloqueios;
- nível de confiança.

### 2. Fluxo percorrido

Descreva o caminho real testado, estados visitados e variações relevantes.

### 3. Achados

Para cada item, informe:

- ID, categoria, severidade e título;
- status da evidência: confirmado, risco provável ou sugestão;
- comportamento observado e esperado;
- impacto para o usuário;
- evidência concreta e passo reproduzível;
- recomendação;
- se exige decisão humana;
- se é seguro implementar diretamente.

### 4. Backlog priorizado

Organize em:

1. correções imediatas;
2. melhorias importantes;
3. funcionalidades recomendadas;
4. refinamentos futuros.

Inclua impacto, frequência, risco e esforço estimado quando puder sustentá-los.

### 5. Alterações realizadas

Se houver autorização para corrigir, liste arquivos, problema, comportamento antes/depois e testes executados. Se não houve alteração, declare isso.

### 6. Pendências e riscos

Liste limitações, cenários não testados, decisões necessárias e impactos possíveis.

### 7. Próximos passos

Sugira a menor sequência segura para continuar sem expandir o escopo.

## Critério de conclusão

A auditoria só termina quando o fluxo principal e os estados alternativos relevantes foram analisados, os achados têm evidência, classificação e prioridade, as validações foram executadas ou marcadas como não executadas, e nenhuma mudança fora do escopo foi feita silenciosamente.

Após cada etapa relevante, informe uma atualização curta no formato:

`✅ Etapa concluída — evidência encontrada — arquivos envolvidos`
