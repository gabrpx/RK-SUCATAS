# Workflow de IA — RK Sucatas

Este processo permite que Claude Code e Codex atuem como desenvolvedores complementares em turnos diferentes. A decisão humana permanece como autoridade final para produto, risco e mudanças críticas. Regras universais estão em `AGENTS.md`; contexto técnico em `AI_CONTEXT.md`.

## Fluxo principal

```text
Ideia / problema
  ↓ ChatGPT / Usuário
Escopo + critérios + arquitetura
  ↓ Claude Code
Implementação principal
  ↓ Validação inicial
Handoff ou conclusão
  ↓ Codex
Continuação / novas features / auditoria / correções
  ↓ Validação e relatório
Claude Code ou usuário retoma
```

Claude Code e Codex podem executar desenvolvimento: Claude Code é executor principal; Codex é segundo desenvolvedor, continuidade e auditoria.

## Quando usar cada agente

| Papel | Use para | Pode implementar? |
| --- | --- | --- |
| ChatGPT | entendimento, arquitetura, planejamento, trade-offs e revisão estratégica | Não como executor principal |
| Claude Code | features grandes, implementação principal, refatorações e integração | Sim |
| Codex | continuidade, features novas, bugs, testes, refatoração e auditoria | Sim |
| Usuário | produto, prioridade, decisões críticas e aprovação | — |

## Contrato de tarefa

```markdown
## Tarefa: <título>
**Objetivo:** resultado observável.
**Contexto:** fatos relevantes.
**Escopo:** o que entra.
**Fora do escopo:** o que não entra.
**Arquivos possivelmente envolvidos:** lista inicial.
**Critérios de aceitação:** comportamentos verificáveis.
**Testes esperados:** comandos e/ou roteiro manual.
**Riscos:** dados, segurança, compatibilidade e concorrência.
**Decisão necessária:** somente quando existir escolha aberta.
```

O executor investiga o repositório antes de implementar.

## Handoff e continuidade

Quando Claude Code atingir limite, encerrar expediente ou deixar uma tarefa incompleta, Codex pode assumir diretamente; Claude Code pode fazer o mesmo com tarefa de Codex. Quando disponível, o handoff inclui objetivo, critérios, arquivos, concluído, pendente, testes, limitações e decisões. Caso falte contexto, o agente reconstrói pelo repositório.

Se o objetivo estiver claro, o agente que assume investiga estado e progresso, determina pendências, continua, valida e conclui; não deve esperar prompt descrevendo cada etapa. Não apague implementação existente sem motivo, recrie arquivos sem necessidade, mude arquitetura por preferência ou suponha erro anterior sem evidência.

## Quando Codex pode criar features novas

Codex pode criar feature nova suficientemente especificada: abas, CRUDs, formulários, tabelas, filtros, busca, dashboard, componente, endpoint, integração frontend/backend, UX, responsividade ou testes. Não é necessário que Claude Code a tenha iniciado.

O Codex não inventa feature de produto. Próxima tarefa só pode começar se for solicitada, fizer parte do plano atual, estiver pendente e previamente especificada, ou for correção diretamente necessária e autorizada.

## Autonomia controlada

Dentro de tarefa autorizada, agentes podem implementar componentes, telas, CRUDs, endpoints, formulários, filtros, buscas, testes, correções, type-check/lint, refatoração local, responsividade, acessibilidade, erros e remoção de duplicação diretamente relacionada.

Exigem decisão explícita: arquitetura global, autenticação, contrato público, RLS, banco real, migration com impacto de dados, RPC crítica, dependência relevante, infraestrutura, deploy e alteração financeira/contábil de regra de negócio.

## Revisão do Codex

Após Claude Code concluir feature, Codex pode auditar escopo, regressões, contratos, estado global, duplicação, tipos, erros, UX, acessibilidade, responsividade, segurança, service role, estoque, vendas, caixa, orçamentos, banco, testes e build.

Se problema for local e diretamente relacionado, Codex pode corrigi-lo. Se exigir decisão arquitetural, solicita direção antes da mudança ampla.

## Proteção contra conflito e trabalho paralelo

Antes de editar, rode `git status --short --branch`; identifique arquivos modificados, confirme escopo e não apague nem sobrescreva trabalho local. Para paralelo, prefira branches/worktrees, separe domínios/arquivos e evite dois agentes no mesmo arquivo simultaneamente.

## Migrations, banco e deploy

Não modifique migration aplicada. Nova migration requer alteração definida, impacto compreendido, compatibilidade avaliada, validação planejada e rollback/mitigação. Codex pode implementar migration previamente especificada, mas não inventar mudança estrutural de banco para facilitar implementação.

Deploy é separado: confirme ambiente, configuração, migrations, build, smoke test e destino. Resolva a divergência Cloud Run/Render/URL do cliente antes de mudar infraestrutura.

## Testes e aceite

Tarefa não está concluída até critérios verificados, type-check/lint e testes pertinentes executados, build quando relevante, fluxo de maior risco validado, diff revisado e limitações declaradas. Ausência de testes automatizados não aprova automaticamente feature.

## Relatório de handoff

```markdown
## Handoff
### Tarefa
<nome>
### Objetivo
<objetivo>
### Status
<descrição do progresso>
### Concluído
- ...
### Pendente
- ...
### Arquivos relevantes
- ...
### Decisões já tomadas
- ...
### Testes executados
- ...
### Problemas conhecidos
- ...
### Próximo passo recomendado
- ...
```

## Relatório final

```markdown
## Resultado da tarefa
**Objetivo:**
**Status:** concluída / parcialmente concluída / bloqueada
### Origem do trabalho
- Iniciada por:
- Assumida por:
- Estado encontrado:
### Alterações
- Modificados:
- Criados:
### Implementação
- O que já existia:
- O que foi implementado:
- O que foi corrigido:
### Validação
- `<comando>` — `<resultado real>`
### Decisões
- ...
### Problemas e limitações
- ...
### Revisão humana necessária
- ...
### Próximos passos
- ...
```

Não faça commit, merge, push ou deploy por padrão. Essas ações exigem autorização explícita.
