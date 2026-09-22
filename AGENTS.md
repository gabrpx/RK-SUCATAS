# Governança para agentes de IA — RK Sucatas

Este é o contrato comum para qualquer IA que trabalhe neste repositório.

Leia este arquivo junto de `docs/AI_CONTEXT.md` antes de alterar arquivos. Regras específicas do Claude Code ficam em `CLAUDE.md`. O processo entre agentes, incluindo handoff e trabalho em turnos, fica em `docs/AI_WORKFLOW.md`.

## Contexto confirmado

O RK Sucatas é um sistema interno para operação de peças de moto: estoque, vendas, caixa, frete, orçamentos e catálogos. O frontend é React/Vite/TypeScript/Tailwind; o backend é Express no mesmo projeto; o banco e storage são Supabase. O frontend acessa somente a API Express. O backend usa a service role do Supabase; essa chave nunca pode ser exposta ao navegador.

Principais áreas:

- `src/features/` — telas por domínio
- `src/components/` — UI compartilhada
- `src/context/DataContext.tsx` — estado global
- `src/server/routes/` — rotas de domínio
- `services/supabaseClient.ts` — cliente Supabase
- `supabase/` — schema e migrations SQL
- `middleware/auth.ts` — JWT

### Regra visual obrigatória

- Nunca use o projeto/tela antiga com identidade visual preta e laranja e barra lateral como referência, base de comparação, alvo de navegação ou fonte de componentes para novas telas e auditorias.
- A referência visual aprovada é a nova aba **Tarefas**, em modo claro, sem a barra lateral do projeto antigo, incluindo sua linguagem de cards, superfícies, espaçamento, tipografia, ações e interações.
- Ao auditar ou implementar uma tela nova, confirme visualmente e no código que a comparação está sendo feita contra a nova experiência clara de Tarefas; se houver ambiguidade entre rotas/projetos, pare e registre a dúvida em vez de usar o projeto antigo como fallback.

### Regra de aprendizado das auditorias

- Todo achado confirmado em uma auditoria deve ser registrado antes do encerramento nos arquivos da skill local de auditoria, convertido em um critério curto, generalizável e verificável. Não basta relatar o problema apenas na resposta; aplique o novo critério à tarefa atual quando ele for pertinente e informe o registro realizado.

## Papéis e decisões

### Usuário

É a autoridade final sobre produto, prioridades, requisitos, risco, dados reais, deploy, decisões arquiteturais amplas e mudanças irreversíveis ou de alto impacto.

### ChatGPT

Atua como arquiteto, planejador e revisor estratégico: entende o problema, estrutura requisitos, define escopo, propõe arquitetura, identifica riscos, prepara planos, revisa decisões transversais e ajuda a resolver conflitos entre alternativas técnicas. Não deve inventar requisitos nem aprovar decisões de produto em nome do usuário.

### Claude Code

É o executor principal. Pode criar features, páginas, abas, CRUDs, componentes, APIs e integrações; refatorar; corrigir bugs; escrever testes; validar; melhorar UX/UI; e continuar tarefas iniciadas. Deve trabalhar dentro do escopo aprovado e seguir este documento.

### Codex

É o segundo desenvolvedor, além de auditor independente. Pode continuar tarefas parciais, assumir trabalho quando Claude Code estiver indisponível, implementar features especificadas, criar UI/CRUDs/APIs/integrações, corrigir bugs, refatorar, escrever testes, melhorar acessibilidade, responsividade e qualidade, auditar, revisar Claude Code e corrigir problemas ligados à própria revisão.

Codex não é limitado a revisão. Com escopo e critérios claros, pode executar integralmente a tarefa. Se encontrar decisão arquitetural, de segurança, banco, contrato ou produto não definida, deve parar nessa parte e solicitar decisão, em vez de inventar solução.

## Regra fundamental de continuidade

Claude Code e Codex são desenvolvedores complementares. Uma tarefa iniciada por um pode ser continuada pelo outro. O agente que assumir uma tarefa deve:

1. Investigar o estado real do repositório.
2. Identificar o que já foi implementado.
3. Preservar o trabalho funcional existente.
4. Identificar pendências.
5. Continuar a partir do estado atual.
6. Não recomeçar a feature sem necessidade.
7. Validar antes de concluir.

O estado do código é a fonte de verdade para determinar progresso. Relatórios são contexto auxiliar, não substituem investigação do código.

## Antes de modificar qualquer coisa

1. Leia `AGENTS.md`, `docs/AI_CONTEXT.md`, `docs/AI_WORKFLOW.md` e instruções próximas do diretório alvo; como Claude Code, leia também `CLAUDE.md`.
2. Execute `git status --short --branch` e identifique branch e alterações locais.
3. Localize os arquivos relevantes e dependências; pesquise implementações semelhantes e componentes reutilizáveis com `rg`.
4. Leia testes, tipos, rotas, contratos e migrations relacionados.
5. Defina ou confirme objetivo, escopo, critérios de aceitação, arquivos envolvidos, validações e riscos.

Nunca crie implementação, componente, API, tabela ou regra de negócio sem verificar se já existe equivalente. Nunca afirme que algo existe sem confirmação no repositório.

## Regra para assumir trabalho de outro agente

Ao assumir tarefa parcial, não confie apenas no relatório anterior: inspecione código e diff; determine o que está concluído, parcial, quebrado e pendente; preserve o que estiver correto; corrija problemas diretamente relacionados; continue a implementação; não reverta decisões funcionais sem justificativa; e registre no relatório o que foi herdado e o que foi implementado pelo agente atual.

Se intenção registrada e código atual divergirem, não descarte automaticamente o código: investigue e registre a divergência.

## Regras de alteração

- Trabalhe apenas no escopo aprovado. Registre problemas fora dele; não os corrija automaticamente, exceto falha crítica causada diretamente pela própria alteração.
- Preserve comportamento, contratos públicos e dados existentes salvo autorização explícita.
- Reutilize componentes, helpers e endpoints existentes. Evite duplicação e não espalhe regras de negócio entre UI, API e banco.
- Não instale, remova ou atualize dependências sem justificativa e análise de impacto.
- Não altere `.env`, credenciais, chaves, tokens ou segredos. Nunca imprima ou versione segredos.
- Não modifique `dist/`, `node_modules/`, cobertura ou outputs Android salvo pedido explícito.
- Documentação deve refletir o código real.

## Autonomia de implementação

Quando a tarefa tiver objetivo claro, escopo definido, critérios de aceitação e arquitetura suficientemente definida, Claude Code ou Codex podem implementá-la sem pedir aprovação para cada pequena decisão. Podem tomar decisões locais que não alterem contratos públicos, arquitetura global, regras de negócio críticas, banco real não autorizado, dependências, autenticação ou segurança estrutural — por exemplo componentes, helpers, formulários, estados de UI, mensagens de erro, responsividade, testes locais e refatorações necessárias para concluir a tarefa.

## Arquivos e fluxos críticos

Coordenação explícita é obrigatória antes de tocar em `server.ts`, `middleware/auth.ts`, `services/supabaseClient.ts`, `src/context/DataContext.tsx`, `src/App.tsx`, `src/utils/api.ts`, `src/server/routes/`, `supabase/`, `render.yaml`, `android/`, `.claude/` e `.codex/`.

Antes de modificar arquivo crítico: identifique o autor das alterações locais; leia consumidores e testes; explique impacto e plano; confirme que outro agente não está editando simultaneamente; revise o diff final e procure regressões. Para autenticação, RPCs de vendas, estoque, caixa e dados financeiros, revisão do Codex é obrigatória antes de concluir.

## Banco de dados e Supabase

- `supabase/schema.sql` é o bootstrap; `supabase/migration_*.sql` registra evoluções manuais. Confirme a sequência aplicada no ambiente alvo antes de propor alteração.
- Não edite migration já aplicada. Schema, RLS, índices, constraints, triggers, functions/RPCs ou Storage exigem migration nova.
- Mudanças que possam afetar dados reais ou produção exigem aprovação explícita.
- Não execute SQL em Supabase, altere RLS, apague ou masque dados reais como teste sem autorização explícita.
- Vendas, baixa de estoque e caixa dependem das RPCs `registrar_venda` e `cancelar_venda`; não substitua sua atomicidade por múltiplas operações na UI ou API.
- O frontend não acessa Supabase diretamente. A service role pertence somente ao backend.

## Git, alterações locais e trabalho paralelo

- Nunca presuma que arquivo modificado é erro: identifique intenção e preserve trabalho válido.
- Nunca execute `git reset --hard`, `git clean -fd`, checkout restaurador ou rebase destrutivo sem autorização explícita.
- Não sobrescreva ou descarte trabalho de outro agente e não edite simultaneamente o mesmo arquivo.
- Para paralelo, prefira branches ou worktrees.
- Não faça commit, push, merge ou deploy sem pedido explícito.

## Teste, qualidade e conclusão

Após cada alteração, execute a menor validação relevante disponível. Quando aplicável:

```powershell
npm run lint
npm run build
```

Execute também testes automatizados existentes e validação manual quando necessário. Não declare sucesso se um comando não foi executado ou falhou.

Uma tarefa está concluída quando critérios de aceitação foram atendidos, escopo foi respeitado, implementação foi integrada corretamente, validações relevantes foram executadas, diff foi revisado, riscos foram identificados e limitações foram declaradas.

## Relatório final obrigatório

1. Objetivo e resultado.
2. Arquivos modificados e criados.
3. O que já existia quando a tarefa foi assumida.
4. O que foi implementado pelo agente atual.
5. Testes/comandos executados e resultados reais.
6. Problemas, limitações ou validações não executadas.
7. Decisões tomadas e razões.
8. Riscos, follow-ups e pontos que exigem revisão humana.
