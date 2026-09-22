# Handoff — Estoque pronto para uso diário

## LEIA PRIMEIRO — handoff atualizado em 22/09/2026, 16:55 (horário local)

O usuário informou que o uso do Codex está acabando e pediu que Claude
continue. **Claude só assume agora por esse motivo.** O pedido ativo é fazer
tudo para o novo estoque chegar a 10/10 e, **somente depois de confirmar isso
com testes**, perguntar se pode trocar a rota `/estoque`. Não troque a rota,
não faça deploy, não faça commit e não grave dados reais sem autorização
específica. Não chame a implementação de 10/10 enquanto faltar migration,
integração ou validação real. A referência visual de Tarefas é a **aba light
mode nova deste projeto**, nunca o projeto laranja/preto com barra lateral.

### Estado confirmado nesta passagem

- O usuário **já aplicou a migration 065**. Codex confirmou em leitura no
  Supabase do projeto `dfabkkffesulrmmtjzbx` que `estoque_locais`,
  `estoque_local_categorias`, novos campos de `estoque_unidades` e RPC
  `adicionar_unidade_estoque` existem. Nenhum SQL de escrita foi executado.
- O usuário decidiu a regra de produto: **venda de unidade reservada deve ser
  bloqueada até a reserva ser liberada**. A RPC de venda existente não verifica
  reserva nem arquivamento, e não havia tabela de reservas. A venda pode ser
  chamada sem `p_unidade_id`. Os caminhos de venda/orçamento precisam ficar
  protegidos no banco, preservando atomicidade de `registrar_venda` e
  `cancelar_venda`.
- Codex criou **somente no repositório**
  `supabase/migration_066_estoque_reservas_arquivamento.sql`: tabela de
  reservas, RPCs de reservar/liberar/arquivar/restaurar, triggers para bloquear
  venda de unidade reservada/arquivada e baixa de quantidade abaixo das
  reservas, e revisão de sincronização de fichas arquivadas. **066 NÃO FOI
  APLICADA NEM TESTADA EM POSTGRES.** Faça revisão profunda de SQL, ordem de
  locks, concorrência, permissões, vendas sem unidade, exclusão/alteração de
  quantidade e cancelamento; teste em homologação antes de pedir aplicação.
- Endpoints correspondentes foram adicionados em
  `src/server/routes/estoqueOrganizacao.ts`; o `GET /locais` agora lê também
  `estoque_reservas`. Tipos/API/adaptador da prévia começaram a refletir
  reservas. **A UI ainda NÃO tem botões/formulário de reservar/liberar,
  arquivar/restaurar reais** e a 066 pendente faz o GET de organização falhar.
  Essa parte está deliberadamente incompleta, não deve ser publicada.
- O drawer de novo cadastro reutilizava nome/etapa/dados ao cancelar;
  `InventoryComposer.tsx` agora limpa formulário ao fechar, deixa categoria
  inicialmente vazia para impedir ID demonstrativo obsoleto. Teste de
  regressão adicionado em `EstoquePreview.test.tsx`, passando.
- A prévia agora reconhece falha de revalidação de dados reais: mostra aviso
  de dados antigos em modo somente leitura, oferece “Tentar novamente” e
  impede alguns caminhos de gravação. **Ainda revise todos os caminhos**:
  edição no drawer, mapa, arquivamento, abertura de composer durante refetch.
- `realInventoryAdapter.ts` mapeia reservas ativas e ignora fichas arquivadas
  no cálculo da quantidade ativa representada; teste direcionado passou.
- Usuário relatou novo problema na aba Tarefas: rascunho de formulário some
  alguns segundos após abrir/editar tarefa, quando os dados atualizam. Ainda
  não reproduzido no navegador: `/tarefas` do preview 4173 não alcança a API
  e desabilita “Nova tarefa”; não inicie `npm run dev` indiscriminadamente,
  pois `server.ts` inicia schedulers ligados ao ambiente. Teste unitário novo
  `src/features/tarefas/TarefasView.rascunho.test.tsx` demonstrou que um
  simples refetch de lista/re-render **não** apaga “Nova tarefa”. Usuário
  confirmou que é o **rascunho do formulário**, não painel de detalhes;
  pergunta complementar sobre se é Nova/Editar e se modal fecha/campos
  resetam foi enviada, resposta ainda não recebida nesta passagem. Investigue
  a sequência real antes de prometer correção. Não use `TasksView.tsx` dark
  demonstrativo como referência: rota real em `src/App.tsx` usa
  `TarefasView.tsx` light.

### Revisão do Claude na 066 → migration 067 — 22/09/2026

- **O usuário APLICOU a 066 original** no Supabase. Ela foi mantida intacta no
  repositório; as correções estão em
  `supabase/migration_067_estoque_reservas_correcoes.sql` (NÃO aplicada).
- Bug confirmado no estado atual do banco (066 sem 067): `estoque_reservas`
  com `on delete restrict` impede excluir peça cuja unidade já teve reserva,
  mesmo liberada (`violates foreign key constraint
  estoque_reservas_unidade_id_fkey`), e quebra a sincronização de quantidade
  ao apagar ficha em branco com reserva antiga.
- A 067 troca a FK para `on delete cascade`, adiciona o trigger
  `bloquear_exclusao_unidade_reservada` (ficha com reserva ativa não sai por
  exclusão, cascata ou sincronização), faz a sincronização ignorar reserva
  vencida, fixa `search_path = public` nas funções e deixa explícita a mensagem
  de bloqueio de venda.
- Testado em Postgres 16 local (stub mínimo + 065 + 066 original + 067): 9
  cenários passaram. Falta homologação com o schema real e com
  `registrar_venda`/`cancelar_venda` reais antes de aplicar a 067.
- Pendente de decisão do usuário: a reserva não guarda valor do sinal (20%)
  nem `cliente_id`; só `responsavel` texto e prazo.
- Com a 066 aplicada, o `GET /locais` deve voltar a carregar; confirmar.
- Suíte, lint e build NÃO rodados nesta passagem (shell local indisponível).

### Validações desta passagem

- `npm.cmd test -- src/features/estoque-preview/EstoquePreview.test.tsx`
  passou 16/16 após correção do teste para seleção explícita de categoria.
- `npm.cmd test -- src/features/estoque-preview/EstoquePreview.test.tsx
  src/features/estoque-preview/realInventoryAdapter.test.ts
  src/features/tarefas/TarefasView.rascunho.test.tsx` passou 19/19.
- `npm.cmd run lint` passou (tsc --noEmit) **após** migration/rotas/tipos/API
  atuais. Build e suíte completa **não foram rodados nesta passagem**;
  resultados antigos 692/692 e build do turno anterior não cobrem este diff.
- Preview 4173 de Tarefas abriu em light mode, mas sem API. Nenhum teste de
  escrita real, upload real, reserva real ou concorrência no Postgres ocorreu.

### Próxima sequência objetiva para Claude

1. Leia `AGENTS.md`, `docs/AI_CONTEXT.md`, `docs/AI_WORKFLOW.md`, este arquivo
   e `git status --short --branch`. A árvore `main` está suja, ahead 9; preserve
   tudo. A seção histórica abaixo não substitui o estado do código.
2. Revise criticamente a 066 e os consumidores de venda/estoque. Corrija
   concorrência e invariantes antes de pedir ao usuário aplicar a migration.
   Não edite a 065 já aplicada. Aplique 066 só com autorização explícita,
   preferindo homologação primeiro.
3. Termine a UI e testes reais simulados de reserva/liberação, motivo para
   arquivamento/restauração, feedback de erros e atualização dos indicadores.
   Integre a 066 sem deixar o `GET /locais` quebrado silenciosamente. Revise
   upload de fotos órfãs, retries/idempotência e submissão dupla da edição.
4. Reproduza e resolva o rascunho de Tarefas com uma sequência que falha no
   teste antes da correção; simples refetch não é a causa demonstrada.
5. Atualize o tutorial e esta documentação com o código real. Registre
   achados generalizáveis na skill de auditoria, como o usuário pediu.
6. Rode suíte completa, lint, build, `git diff --check`, inspeção do diff e
   validação manual desktop/mobile/API com segurança. Só declare 10/10 após
   migration aplicada e cenários críticos testados. Só então pergunte se pode
   trocar a rota `/estoque`; não a altere por inferência.

### Arquivos desta passagem (além dos herdados)

`src/features/estoque-preview/InventoryComposer.tsx`, `EstoquePreview.tsx`,
`EstoquePreview.test.tsx`, `realInventoryAdapter.ts`,
`realInventoryAdapter.test.ts`, `inventoryPreviewModel.ts`,
`src/features/estoque/api.ts`, `src/features/estoque/types.ts`,
`src/server/routes/estoqueOrganizacao.ts`,
`supabase/migration_066_estoque_reservas_arquivamento.sql`,
`src/features/tarefas/TarefasView.rascunho.test.tsx`, e
`plugins/ux-user-audit/skills/ux-user-audit/SKILL.md`. Não houve commit.

---

## Histórico anterior (preservado; status antigo pode estar superado)

Data: 22/09/2026  
Status: implementação local em andamento; Codex permanece como executor. Este
documento é somente contingência para Claude assumir se Codex ficar
indisponível. O usuário autorizou continuar a implementação local, **mas não
autorizou aplicar migration em produção, trocar `/estoque`, fazer deploy ou
alterar dados reais**.

## Atualização de execução — 22/09/2026

Este documento contém abaixo o plano e os achados **originais**, preservados
como histórico; parte deles já foi resolvida no código. Ao assumir, leia o diff
e o código atual antes de seguir a lista de pendências.

Implementado localmente por Codex: migration nova `065` (não aplicada), catálogo
de endereços e relação N:N endereço–categorias, endpoints Express protegidos,
tipos/API do frontend, mapa pesquisável, inclusão de unidade via RPC atômica,
drawer com upload e gravação na API, adaptação das unidades reais/virtuais,
ritmo calculado por `organizada_em`, avisos de cobertura de preço e guia em
`docs/TUTORIAL_ORGANIZACAO_ESTOQUE.md`. O preview continua separado da rota
principal e mostra modo demonstrativo quando a API não carrega.

Pendências de segurança e produto antes de chamar o fluxo de pronto:

1. Revisar e aplicar `migration_065` apenas com aprovação; validar a sequência
   real de migrations e testar transações com banco de homologação.
2. Rodar testes e build após os últimos ajustes, corrigir qualquer falha e
   fazer teste manual completo do preview em desktop e mobile.
3. Integrar reservas e arquivamento/restauração reais com `registrar_venda` e
   `cancelar_venda` sem quebrar atomicidade. Por enquanto essas ações reais
   estão desabilitadas/sem gravação; a aba de arquivados é consulta.
4. O adaptador agrupa venda e arquivamento fora do ativo, mas mantém
   `vendidaEm` para exibir "Vendida" separadamente; verificar esse contrato
   em homologação. Nenhum botão real de restauração é exibido.
5. Tratar fotos órfãs quando upload completar e o cadastro falhar; garantir
   teste de retry sem duplicidade.
6. A referência livre de moto é salva em `descricao`, não como
   `modelo_moto_id`/compatibilidade estruturada. Exibir isso com honestidade.
7. Fazer revisão final do contrato do `POST /:id/unidades`: depende da RPC
   `adicionar_unidade_estoque`, logo não publicar o backend antes da migration.
8. Planejar rollout da rota `/estoque` com aprovação explícita do usuário e
   checklist das funcionalidades existentes que não podem desaparecer.

Validações executadas até esta atualização: testes direcionados finais
passaram (40/40), suíte completa passou (692/692, antes do último ajuste de
texto/fuso horário), lint e build finais passaram. Inspeção
visual manual do preview incluiu mapa, dropdown de categorias e etapas 1–3 do
drawer em modo demo. Não houve teste de gravação real, upload efetivo ou banco
de homologação. Nenhum SQL de escrita foi executado no Supabase real; a
inspeção de schema foi somente leitura.

## Objetivo acordado

Transformar a rota `/estoque-preview`, hoje uma demonstração visual local, em
uma experiência de estoque que possa entrar no dia a dia: cadastro de peça e
unidade, foto, localização física, categorias, reservas, lista, mapa e métricas
confiáveis. O usuário também pediu uma solução escalável para muitas categorias
e prateleiras.

## Regras que não podem ser quebradas

1. Ler `AGENTS.md`, `docs/AI_CONTEXT.md` e `docs/AI_WORKFLOW.md` antes de agir.
2. Nunca usar como referência o projeto antigo laranja/preto com barra lateral.
   A referência visual é exclusivamente a aba nova `/tarefas`, em light mode.
3. Preservar alterações locais existentes; a árvore já estava suja quando o
   trabalho foi assumido. Não fazer reset, clean, checkout restaurador, commit,
   push, merge ou deploy sem pedido.
4. O frontend fala somente com Express; Supabase service role nunca vai ao
   navegador. Reusar `estoqueApi`, rotas Express e upload existentes.
5. Banco, migrations, contratos públicos, reserva e qualquer dado real exigem
   confirmação humana explícita antes de escrever. Fazer a fase de descoberta
   primeiro; parar se o contrato real divergir.
6. Registrar todo achado confirmado, de forma generalizável, em
   `plugins/ux-user-audit/skills/ux-user-audit/SKILL.md`.

## Estado encontrado

### O que a prévia já entrega bem

- Visual claro, alinhado à linguagem light da aba Tarefas.
- Cards de métricas, catálogo em cards/lista, rolagem interna sem barra nativa,
  destaque de ruptura e quantidade física antes do detalhe.
- Drawer em quatro etapas e dropdown animado compartilhado para peça existente,
  categoria e endereço.
- Cards de unidade, menu de ação, aba de organização, mapa e arquivamento como
  experiência visual.
- Um seletor de 88 endereços demonstrativos (`P01-S01` a `P11-S08`) já existe.

### Bloqueios confirmados para uso diário

| ID | Prioridade | Evidência | Efeito no dia a dia |
| --- | --- | --- | --- |
| INV-01 | P0 | `EstoquePreview.tsx` executa criação, edição e arquivamento com `setEstoque`; a própria tela informa que nada será persistido. | O operador perde o cadastro ao recarregar. |
| INV-02 | P0 | O modelo de unidade da prévia tem `endereco`, `origem`, `estado` e reserva, mas `EstoqueUnidade`/rotas reais não têm esses campos. | Mapa, organização e reserva não são fonte de verdade. |
| INV-03 | P0 | `InventoryComposer` envia `fotoUrl: null`; o upload real existe em `EstoqueUploadFotos` e `/api/upload/imagem`, mas não está conectado à prévia. | Não é possível fotografar a peça no fluxo novo. |
| INV-04 | P1 | O adaptador cria unidades virtuais quando `quantidade` excede fichas reais. | Uma estimativa pode parecer unidade física e receber ação indevida. |
| INV-05 | P1 | `ritmoOrganizacao` é uma constante com datas e totais fixos. | O gráfico parece operacional, mas não mede o trabalho real. |
| INV-06 | P1 | Categoria e endereços da prévia são fallback de demonstração; a categoria–prateleira é `Record<endereco, categoria>`, um para um. | Não escala para muitas categorias, zonas e exceções. |
| INV-07 | P2 | `Valor em estoque` soma unidades ativas e trata preço ausente como zero, sem cobertura de preço. | Pode induzir decisão financeira com total incompleto. |
| INV-08 | P2 | A tela aberta contra o Vite local caiu em dados demonstrativos por não alcançar a API. | O estado offline está honesto, mas não existe recuperação/retentativa operacional. |

## Decisões de produto propostas (não implementar sem confirmação)

1. **Endereço:** armazenar endereço por unidade física, composto por `depósito`,
   `zona`, `prateleira`, `nível` e `posição`; exibir também o código curto, por
   exemplo `A · P03 · N02 · C04`. Não usar texto livre.
2. **Mapa:** tratar endereço físico e regra de organização como entidades
   separadas. Uma zona pode recomendar várias categorias; uma categoria pode
   estar em várias zonas. Cada associação tem prioridade e capacidade opcional.
3. **Reserva:** só reservar unidade persistida, com responsável/cliente,
   criação, vencimento e status. Expiração deve ser calculada no servidor ou
   por job, nunca apenas no relógio do navegador.
4. **Valor em estoque:** mostrar valor vendável das unidades disponíveis;
   exibir à parte valor reservado e cobertura (`X de Y unidades com preço`).
   Não somar preço desconhecido como se fosse R$ 0,00 sem aviso.
5. **Unidades legadas:** até cada unidade receber ficha persistida, mostrar
   "quantidade ainda não individualizada". Não oferecer reservar, mover,
   arquivar ou editar como unidade individual virtual.

## Plano de implementação após aprovação

### Fase 0 — contrato e segurança (primeiro checkpoint)

- Confirmar migrations realmente aplicadas e modelo real de `estoque`,
  `estoque_unidades`, categorias e permissões.
- Auditar consumidores de venda (`registrar_venda`/`cancelar_venda`) antes de
  alterar disponibilidade; não quebrar sua atomicidade.
- Decidir e apresentar a migration nova para os campos de endereço/reserva e
  entidades de localização. Não executá-la sem aprovação específica.
- Corrigir o conflito conhecido da migration 057: `POST /unidades` não pode ser
  usado quando todas as unidades já são explícitas. O fluxo novo deve promover
  uma ficha em branco por PATCH, ou usar uma operação de domínio transacional
  equivalente, nunca criar duplicata.

### Fase 1 — modelo persistente de localização e organização

- Criar migration nova, reversível na prática e documentada, para:
  - catálogo de locais (`depositos`, `zonas`, `prateleiras`/posições),
    respeitando a nomenclatura já presente no banco;
  - vínculo de unidade ao local;
  - regras categoria–zona N:N, com prioridade, capacidade e ativo;
  - reserva por unidade, se não houver entidade equivalente confirmada.
- Criar tipos, validação Express e endpoints protegidos pelas permissões de
  estoque já existentes. Validar IDs no servidor e retornar conflitos claros.
- Gerar/adaptar o mapa exclusivamente destes dados; busca deve localizar por
  código e descrição humana.

### Fase 2 — integrar o drawer com o sistema real

- Extrair/adaptar o modelo de prévia para uma camada de repositório, sem manter
  dois modelos concorrentes de verdade.
- Reusar `estoqueApi.criar`, `atualizarParcial`, `atualizarUnidade` e
  `moverUnidade`; transformar falhas em feedback acionável e impedir envio
  duplicado.
- No cadastro: buscar categoria real completa, oferecer pesquisa e teclado,
  criar nova peça ou selecionar existente, apresentar revisão final de todos os
  campos persistidos e gravar somente após sucesso.
- Ao salvar, atualizar cards, lista, mapa, contadores e drawer a partir da
  resposta do servidor ou de revalidação; nunca apenas por estado otimista sem
  rollback.

### Fase 3 — fotos e qualidade do cadastro

- Reusar `EstoqueUploadFotos` e `uploadImagemEstoque`; manter compressão,
  formatos, tamanho, câmera em toque, capa, remoção e erro já existentes.
- Para peça nova, criar a peça e enviar fotos na ordem segura definida pela API;
  para unidade existente, usar a ficha de unidade. Se upload parcial falhar,
  manter o que foi salvo e dizer exatamente o que falta, sem duplicar cadastro.
- Mostrar no drawer a diferença entre foto geral da peça e foto específica da
  unidade, para não confundir o operador.

### Fase 4 — reservas, disponibilidade e histórico

- Implementar reserva somente após a entidade persistente estar definida.
- Bloquear reserva de unidade vendida, arquivada ou sem identificação física;
  lidar com concorrência no servidor. A venda deve respeitar a reserva segundo
  regra aprovada, sem substituir as RPCs existentes.
- Arquivamento deve ser soft state auditável, com confirmação, recuperação e
  impacto explícito em busca e métricas.
- Registrar eventos de organização (unidade conferida, endereço definido) para
  alimentar o ritmo diário sem dados artificiais.

### Fase 5 — métricas, mapa e acabamento da experiência

- Substituir o gráfico fixo por série derivada de eventos persistidos, com
  período selecionável, vazio honesto e timezone do negócio.
- Revisar métricas: disponível, reservada, para organizar, valor disponível,
  valor reservado e cobertura de preço. Cada card deve apontar para sua fila
  filtrada, quando fizer sentido.
- Mapa: navegação por depósito/zona, busca de endereço, contagem por posição,
  recomendação de categoria e aviso de ocupação/itens fora da zona recomendada.
- Preservar a identidade da aba Tarefas: light mode, cartões sóbrios, mesmo
  componente de scroll/fade e mesmas transições, sem voltar ao projeto laranja.

### Fase 6 — testes, rollout e validação manual

- Testes de tipos/modelo, endpoints, autorização e conflitos de reserva.
- Testes de interface: quatro etapas, categoria pesquisável com muitas opções,
  seleção de prateleira, upload/erro, recuperar falha, lista/cartões/mapa,
  teclado, foco, Escape, rolagem e viewport mobile.
- Executar `npm run lint`, testes direcionados, testes de rotas relevantes e
  `npm run build`. Validar em staging antes de migration/backfill; preparar
  checklist de implantação e amostra de dados reais, sem alterar produção em
  silêncio.

## Arquivos com maior probabilidade de mudança

- `src/features/estoque-preview/*` — UI, adapter e modelo atual; pode ser
  reduzido/removido somente depois de integração completa e teste de rota.
- `src/features/estoque/api.ts`, `src/features/estoque/types.ts` — contratos.
- `src/server/routes/estoque.ts` e possível rota de localização — validação e
  permissões; são críticos, revisar consumidores antes de editar.
- `supabase/migration_*.sql` — apenas migration nova, após autorização.
- `src/features/estoque/EstoqueUploadFotos.tsx`, `RegistrarUnidadeDialog.tsx`,
  `UnidadesEstoque.tsx` — reutilizar comportamento existente, não duplicar.
- Testes próximos a esses arquivos e `plugins/ux-user-audit/.../SKILL.md`.

## Prompt refinado para Claude Code

```text
Você é o executor de produção do RK Sucatas. Continue a partir do repositório
existente, sem recomeçar o trabalho visual já correto.

ESTADO INICIAL
- A rota /estoque-preview é uma prévia light alinhada à aba nova /tarefas. Ela
  lê /api/estoque quando possível, mas criação, edição, arquivamento, reserva,
  mapa, endereços e ritmo ainda são estado local ou demonstrativo.
- Já existem estoqueApi, rotas Express de estoque, fichas de estoque_unidades,
  EstoqueUploadFotos e uploadImagemEstoque. Não duplique upload nem leve
  Supabase ao frontend.
- O usuário exige que o projeto antigo laranja/preto com barra lateral nunca
  seja usado como referência. Use somente a identidade light de /tarefas.
- Há alterações locais não relacionadas. Preserve-as; comece com git status,
  git diff e leitura de AGENTS.md, docs/AI_CONTEXT.md e docs/AI_WORKFLOW.md.

OBJETIVO
Após a confirmação humana para cada alteração de dados necessária, tornar o
estoque apto ao uso diário: cadastro persistente de peça/unidade com fotos,
localização física pesquisável, regras escaláveis entre categorias e zonas de
prateleiras, reserva segura, lista/mapa consistentes e métricas reais.

SEQUÊNCIA OBRIGATÓRIA
1. Descubra o contrato real e as migrations aplicadas. Leia vendas/RPCs,
   estoque_unidades, permissões e consumidores antes de mudar contratos.
2. Apresente um checkpoint curto: schema atual, migration necessária, efeito
   nos dados e rollback/mitigação. Pare para aprovação antes de executar SQL,
   migration, backfill ou alteração de reserva/venda.
3. Só depois da aprovação, implemente por fases pequenas: modelo de locais e
   regras categoria-zona; endpoints/tipos; drawer e persistência; fotos;
   reserva/histórico; métricas/mapa; testes e rollout.
4. Reuse os componentes e APIs existentes. Toda mutação deve tratar loading,
   sucesso, erro, duplicidade, refresh e rollback; todas as vistas devem
   refletir a resposta persistida.
5. Trate unidade virtual/estimada como não individualizada; não permita
   reservar, vender, mover, editar ou arquivar como se fosse física.

REQUISITOS DE UX
- Endereço estruturado (depósito, zona, prateleira, nível, posição), código
  curto e descrição legível; busca por ambos.
- Muitas categorias: combobox pesquisável e acessível. A regra de organização
  é N:N categoria-zona com prioridade/capacidade/exceções, nunca uma categoria
  fixa por prateleira.
- Fotos: usar o upload existente, com feedback de compressão, falha parcial,
  capa e diferença entre foto da peça e da unidade.
- Preserve light mode, cartões, scroll/fade e movimento da aba /tarefas; não
  use a referência antiga laranja/com sidebar.
- Gráfico e valor devem derivar de dados persistidos e declarar escopo/cobertura.

FORBIDDEN
- Não fazer commit, push, deploy, reset, clean, checkout restaurador ou tocar
  em dados reais sem autorização explícita.
- Não criar migração editando uma já aplicada; não expor service role; não
  substituir registrar_venda/cancelar_venda por operações da UI.
- Não declarar pronto com mock, constante de demonstração ou estado local.

CHECKPOINTS E ACEITAÇÃO
- Após descoberta: contratos e risco aprovados.
- Após migration: testes de schema/rotas e plano de rollback revisados.
- Após cada fluxo: teclado, foco, mobile, erro de rede e atualização de
  cards/lista/mapa validados.
- Conclusão: npm run lint, testes pertinentes e npm run build executados com
  resultado real; validação manual em staging; documentação e skill de auditoria
  atualizadas; relatório final com arquivos, testes, limitações e follow-ups.
```

## Autorrevisão deste plano

- O plano não trata a prévia como produto pronto: separa claramente interface
  demonstrativa e integrações persistentes.
- Não pressupõe que a migration 057 esteja aplicada; ela contém conflito
  conhecido com `POST /unidades`, que precisa ser resolvido antes de ativar o
  novo fluxo.
- Não presume que uma categoria tenha uma única prateleira; propõe N:N e
  busca, que é o ponto adicional solicitado pelo usuário.
- Não inclui migração ou edição de banco como ação implícita. Exige checkpoint
  e aprovação específica por risco a dados reais.

## Validações já executadas pelo Codex antes deste handoff

- `npm.cmd test -- src/features/estoque-preview src/components/ui/Combobox.test.tsx`:
  35 testes aprovados (aviso conhecido do jsdom para `Window.scrollTo`).
- `npm.cmd run lint`: aprovado.
- `npm.cmd run build`: aprovado (aviso conhecido de chunk maior que 500 kB).
- `git diff --check`: aprovado, com avisos de CRLF.
- Revisão manual da prévia em `http://127.0.0.1:4173/estoque-preview`: cards,
  ruptura, quantidades, drawer, dropdown e estado de fallback verificados. A
  API não estava acessível nesse servidor local, logo a tela exibiu dados demo
  e a mensagem honesta de não persistência.
