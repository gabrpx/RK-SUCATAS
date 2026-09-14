# Claude Code — instruções operacionais

Leia primeiro `AGENTS.md` e `docs/AI_CONTEXT.md`. `AGENTS.md` prevalece para regras gerais; este arquivo define o modo de operação do Claude Code como executor principal.

## Papel do Claude Code

Claude Code é o principal desenvolvedor. Sua responsabilidade é transformar tarefas aprovadas em implementações funcionais. Pode criar features, abas, CRUDs, componentes, endpoints e integrações; corrigir bugs; refatorar; escrever testes; melhorar UX/UI; e continuar tarefas previamente iniciadas. Não limite o trabalho a alterações pequenas quando a tarefa solicitar uma feature completa.

## Sequência obrigatória

1. Leia a tarefa e confirme objetivo, escopo, critérios de aceitação, riscos e testes esperados.
2. Leia `AGENTS.md`, `docs/AI_CONTEXT.md` e instruções relevantes.
3. Rode `git status --short --branch`.
4. Investigue com `rg`: tipos, rotas, APIs, componentes, hooks, serviços e implementações semelhantes.
5. Leia consumidores antes de editar e identifique arquivos realmente envolvidos.
6. Para tarefas significativas, apresente plano curto.
7. Implemente o escopo aprovado, execute validações, revise o diff e entregue o relatório obrigatório.

## Continuidade após outro agente

Se a tarefa foi parcialmente implementada por Codex, não recomece automaticamente. Inspecione o estado atual, identifique o que funciona e está incompleto, preserve alterações válidas, corrija problemas necessários e continue. Não reverta alterações apenas por terem sido feitas por outro agente.

## Mapa rápido

- UI: `src/features/<dominio>/`; componentes: `src/components/`.
- Estado: `src/context/DataContext.tsx`; catálogos: `src/hooks/useCatalogos.ts` e `src/lib/catalogApi.ts`.
- HTTP: `src/utils/api.ts` e `src/lib/apiClient.ts`.
- API Express: `server.ts` e `src/server/routes/`.
- Supabase: somente backend; SQL: `supabase/schema.sql` e `supabase/migration_*.sql`.

## Regras específicas

- Mantenha UI responsiva, componentes, tokens e padrões existentes; não crie linguagem visual sem escopo aprovado.
- Mantenha tipos próximos do domínio e chamadas de domínio nos `api.ts` dos features quando esse padrão existir.
- Não coloque regras transacionais de estoque, vendas ou caixa na UI; preserve RPCs Supabase como fonte de atomicidade.
- Antes de alterar `App.tsx`, `DataContext.tsx`, `server.ts`, autenticação ou SQL, descreva impacto. Mudanças críticas devem ser revisadas por Codex.

## Autonomia e interrupção

Pode tomar decisões locais para concluir tarefa claramente especificada, sem solicitar aprovação por detalhe. Peça direção diante de requisito ambíguo, alteração arquitetural ampla, contrato público, banco não previsto, RLS, autenticação, dependência nova, deploy, credencial, conflito local ou decisão de produto.

## Comandos conhecidos

```powershell
npm run dev
npm run lint
npm run build
npm run cap-sync
```

`npm run lint` executa `tsc --noEmit`. Não há suíte de testes automatizada configurada atualmente. Caso um comando falhe por problema do ambiente, reporte o erro real.

Não interrompa por decisões locais normais quando objetivo e critérios já estiverem definidos.
