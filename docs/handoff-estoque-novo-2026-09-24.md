# Handoff — Novo Estoque em /estoque (24/09/2026)

## Handoff

### Tarefa
Colocar o novo módulo de estoque no lugar da aba `/estoque`, no **projeto novo**
(`D:\NOVO SISTEMA ATUALIZADO\SISTEMA CLAUDE`), com a identidade visual da tela
Tarefas (cabeçalho claro, abas segmentadas, cartões, fonte e a nova dock) e
fechar os achados da auditoria do Codex.

### Objetivo
Estoque pronto para uso diário: busca por peça, unidades físicas com preço,
foto, condição e endereço, mapa físico, reservas com sinal, histórico, e
consistência entre vendas e unidades físicas.

### Status (atualizado pelo Codex em 24/09/2026)
Implementação e correções locais concluídas neste checkout; ainda sem commit.
No único projeto Supabase conectado (`dfabkkffesulrmmtjzbx`, nome genérico
"gabrpx's Project"), os objetos das migrations 065–069 estão presentes e os
roteiros transacionais passaram (069: 34/34; 067/068: 47/47). A API de vendas
e conversão de orçamento agora envia `p_valor_recebido: null` nas vendas
comuns, selecionando a assinatura atual de 13 argumentos entre overloads
legados. O projeto não tem histórico formal de migrations disponível no
Supabase; a confirmação é por estrutura/assinaturas efetivamente encontradas.

Falta integrar esta branch divergente com `main`, publicar/deployar e fazer o
smoke test no app implantado. O projeto Supabase é o único conectado e foi o
alvo da validação autorizada em produção, mas o nome genérico não permite
provar sozinho a identidade do banco configurado no Render.

**Atenção à origem:** o módulo foi desenvolvido até 24/09 no checkout legado
`D:\SISTEMA CLAUDE` (branch `wip/estoque-reservas-cliente`) por engano de
contexto. Ele foi **portado** para este projeto. Não use o legado: ele tem uma
cópia mais antiga e divergente (sem a 069 e sem o visual de Tarefas).

### Concluído
- `/estoque` abre `features/estoque-preview/EstoquePreview` em modo `embutido`,
  em tela imersiva igual a Tarefas (sem o cabeçalho escuro e sem os botões
  flutuantes do app; a dock continua). A tela antiga foi para a aba
  `estoque-antigo` (botão "Tela antiga"), fora da dock; a dock destaca Estoque.
- Visual igual ao de Tarefas: cabeçalho `RK Sucatas` + subtítulo mono,
  "Buscar ⌘K", botão azul primário, título `text-3xl/4xl`, `SurfaceLabel`
  mono, abas segmentadas de `tarefas-preview/PreviewTabs`, faixa de indicadores
  igual à `TurnMetricStrip`, paleta slate/blue e raios 8/6 px (tokens em
  `InventoryDrawer.tsx > lightInventoryTokens`).
- Migration 069: baixa automática da unidade livre mais antiga em venda sem
  unidade (pula reservadas e as vinculadas a variação do ML), conferência
  (`conferir_baixa_automatica`), baixa de ficha sobrando de venda antiga
  (`baixar_ficha_excedente`), cancelamento devolve as unidades, edição atômica
  (`editar_unidade_estoque` com autoria), registro de fotos enviadas e
  `foto_estoque_em_uso`.
- API (`src/server/routes/estoqueOrganizacao.ts`, montada em
  `estoque.ts` como `/api/estoque/organizacao`): `baixasPendentes` em
  `GET /locais`, `POST /baixas/:id/conferir`, `POST /unidades/:id/baixar-excedente`,
  `POST /pecas/:id/unidades` (cadastro atômico, permissão `estoque.criar`),
  `POST /unidades/:id/editar` (atômico; quem só tem `estoque.criar` edita apenas
  a ficha criada há até 15 min), registro/limpeza de fotos (24 h).
- UI: conferência (`InventoryConferencia.tsx`), fichas sobrando fora das
  métricas, filtro "Estoque baixo (1–2)" + atalho do Dashboard, edição envia só
  o que mudou, sem dados fictícios quando a API falha dentro do app, rolagem do
  catálogo preservada entre abas, rádio de prioridade com setas (roving tabindex),
  portais acima do cabeçalho do app.
- Revisão adversarial (subagente) feita; achados corrigidos: unidade ligada ao
  ML escolhida por último, `fotoEmUso` com operador JSON correto (via RPC),
  cancelamento devolve ficha apontada como saída, corrida conferir × cancelar,
  permissões e 404.

### Pendente
1. **Concluído:** revisar a integração de `src/App.tsx`, `src/server/routes/estoque.ts`
   e a migration 069, incluindo o fluxo dos triggers em `vendas`.
2. **Concluído:** conferir no banco conectado os objetos de 065–069 e executar
   com `ROLLBACK` os dois roteiros. 069: 34 PASS, 0 FAIL; 067/068: 47 PASS,
   0 FAIL. O banco não expõe histórico formal de migrations; objetos e
   assinaturas confirmam o estado funcional.
3. **Concluído:** preço opcional no cadastro; fotos aceitam `estoque.criar` ou
   `estoque.editar`; vendas e orçamentos passam `p_valor_recebido: null` para
   selecionar a RPC atual e manter o preço cheio.
4. **Concluído:** `npm test` — 119 arquivos, 731 testes aprovados; builds
   frontend e API aprovados em diretório temporário. `npm run lint` continua
   com 18 erros de TypeScript existentes fora dos arquivos novos do módulo.
5. **Pendente:** concluir e publicar o merge local de `main` (já resolvido e
   testado), abrir/mesclar PR e aguardar o deploy. Depois, confirmar a ligação
   do Render ao Supabase e validar a tela no ambiente implantado.

### Arquivos relevantes
- `src/features/estoque-preview/*` (módulo, testes incluídos)
- `src/server/routes/estoqueOrganizacao.ts` e `.test.ts`
- `src/server/routes/estoque.ts` (montagem `/organizacao`)
- `src/App.tsx`, `src/main.tsx` (rota `/estoque-preview`), `src/constants/navigation.ts`
- `src/features/estoque/api.ts`, `src/features/estoque/types.ts` (funções e tipos de organização)
- `src/features/clientes/SeletorCliente.tsx` (props opcionais `clientes`, `ariaLabel`)
- `src/components/ui/Combobox.tsx` e `.test.tsx` (teclado completo, Escape em camadas, `size="lg"`)
- `supabase/migration_065_estoque_organizacao.sql` … `migration_069_estoque_baixa_automatica_edicao_fotos.sql`
- `docs/validacao-estoque-069.sql`, `docs/validacao-estoque-reservas-067-068.sql`, `docs/GUIA-NOVO-ESTOQUE.md`
- `src/features/patchnotes/data.ts` (1.7.9)

### Decisões já tomadas (usuário)
- Sinal obrigatório: mínimo 20% do preço, formas cadastradas (sem fiado), sem
  preço não reserva, até 30 dias; autoria registrada.
- Local com peças não pode ser desativado.
- Tela antiga em `/estoque-antigo`, aberta pelo botão do novo Estoque.
- Venda sem unidade: baixa automática + conferência.
- 069 inclui edição atômica e registro de fotos (limpeza em 24 h).
- Validação em produção com rollback.
- Identidade visual = tela Tarefas em modo claro, nunca preto com laranja.

### Testes executados (cópia do projeto novo, 24/09)
- `npm test` após integrar `main`: 120 arquivos, 732 testes, 0 falhas.
- `tsc --noEmit`: 18 erros, **todos pré-existentes** neste checkout (sparkles,
  Accordion, Reveal, button, tremor, ClientesView, EstoqueBuscaSugestoes,
  EstoqueView). Nenhum erro novo.
- Build Vite do frontend e bundle esbuild do backend: ok, ambos em diretório
  temporário fora do checkout.
- Banco Supabase conectado: roteiro 069 = 34 PASS; roteiro 067/068 = 47 PASS;
  ambos com `ROLLBACK`. Este banco não fornece histórico formal de migrations.
- Capturas Playwright (1440 e 390 px) de `/estoque` e `/tarefas` lado a lado.

### Problemas conhecidos
- Colisão de número: `migration_065_tarefas_pausa.sql` e
  `migration_065_estoque_organizacao.sql` (mesma situação documentada em
  `docs/migrations-colisao-060-061.md`; não renomear o que já rodou).
- Na dock do celular, Estoque fica no painel "Mais" (a dock de Tarefas mostra
  Início, Tarefas, Vendas e Caixa). Mudar `MOBILE_MAIN_IDS` é decisão de produto.
- Venda de componente que esgota uma unidade não escolhe ficha: aparece como
  "ficha sobrando" na conferência.
- O `POST /api/estoque/:id/unidades` da tela antiga continua como está neste
  projeto; o novo estoque usa `/organizacao/pecas/:id/unidades`.

### Próximo passo recomendado
Publicar o merge testado de `main` e aguardar o deploy. Depois, confirmar no
ambiente do app o cadastro de unidade com foto e os fluxos de reserva, venda e
conferência. Os roteiros SQL passaram no projeto Supabase conectado; falta
confirmar que esse projeto é o banco apontado pelo Render para fechar o smoke
test de produção.
