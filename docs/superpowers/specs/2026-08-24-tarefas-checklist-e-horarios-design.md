# Tarefas: checklist (checkboxes) + horários designada/concluída

Data: 2026-08-24
Feature: aba **Tarefas** (`src/features/tarefas/**`, `src/server/routes/tarefas.ts`)

## Objetivo

Duas mudanças na feature de Tarefas:

1. **Horários mais detalhados** — mostrar quando a tarefa foi designada e quando
   foi concluída, com tempo relativo no formato curto ("2h atrás").
2. **Checklist dentro da tarefa** — checkboxes que a tarefa pode ter em qualquer
   quantidade. A tarefa **só conclui de fato** quando todos os checkboxes estão
   marcados. O título passa a ser **opcional** (uma tarefa pode ser só uma lista
   de checkboxes), e mesmo sem título a exibição precisa ficar boa.

Exemplo alvo: título "Tirar foto das peças" com os itens "Postar no Facebook",
"Postar no WhatsApp", "Renovar anúncios". Ou uma tarefa sem título, só com os
três itens.

## Decisões travadas (com o usuário)

- **Conclusão**: automática. Marcar o último checkbox pendente conclui a tarefa;
  desmarcar qualquer um reabre. Sem botão manual "Concluir" quando há itens.
- **Permissões**: quem cria (admin/equipe) define os itens no formulário; o
  responsável (executor) apenas marca/desmarca. Admin/equipe também podem marcar.
  O responsável **não** adiciona itens novos.
- **Progresso**: aparece no card recolhido (badge "2/3" + barra) e no painel
  expandido (checklist completo).
- **Formato do tempo relativo**: "2h atrás" (curto).
- **Card sem título**: o **primeiro item vira o título visual**, com sinalização
  clara de que há mais checkboxes (badge de progresso + itens restantes visíveis
  + ícone de checklist) — não pode parecer uma tarefa simples de uma linha.

## Parte 1 — Horários (designada / concluída)

Os dados já existem no modelo: `tarefas.criado_em` (quando foi designada) e
`tarefas.concluida_em` (quando foi concluída). Sem migration, sem backend.

### Helper novo — `src/features/tarefas/tarefaUtils.ts`

```ts
// Formata um ISO como "24/08 às 14:30 · 2h atrás".
// Faixas do relativo: "agora" (<1min), "Xmin atrás", "Xh atrás",
// "ontem", "Xd atrás". Sempre mostra dia/mês e hora; o relativo vem depois
// de um separador "·".
export function formatarMomentoRelativo(iso: string | null): string | null
```

- `null` → retorna `null` (o consumidor não renderiza a linha).
- Base de tempo: `Date.now()`. Testável injetando `agora` opcional como 2º
  parâmetro (`formatarMomentoRelativo(iso, agora = Date.now())`) pra os testes
  não dependerem do relógio real.

### Exibição — painel expandido de `TarefaCards.tsx`

No bloco de detalhes (`rounded-2xl bg-surface-inset/60`, hoje com Responsável /
Designada por / Prazo), somar, mantendo a hierarquia "quem → quando":

- 🕐 (`Clock`) **Designada em:** `formatarMomentoRelativo(ativa.criado_em)` —
  sempre.
- ✓ (`CheckCircle2`) **Concluída em:** `formatarMomentoRelativo(ativa.concluida_em)` —
  só quando `ativa.status === 'concluida'`.

Mesmo padrão visual das linhas existentes (`text-text-faint` no rótulo,
`text-text-secondary` no valor).

## Parte 2 — Checklist

### 2.1 Migration — `supabase/migration_046_tarefa_itens.sql`

Próximo número livre é 046 (045 é a shopee, já commitada e pendente). Segue o
padrão das outras (RLS ligada sem policy — só o backend `service_role` mexe;
comentário-cabeçalho explicando o propósito).

```sql
create table tarefa_itens (
  id uuid primary key default gen_random_uuid(),
  tarefa_id uuid not null references tarefas(id) on delete cascade,
  texto text not null,
  concluido boolean not null default false,
  ordem integer not null default 0,
  concluido_em timestamptz,
  concluido_por uuid references usuarios(id) on delete set null,
  criado_em timestamptz not null default now()
);

create index idx_tarefa_itens_tarefa on tarefa_itens(tarefa_id);

alter table tarefa_itens enable row level security;
-- sem policy de propósito: só o backend (service_role) acessa, igual ao resto.

-- Título deixa de ser obrigatório: uma tarefa pode ser só uma lista de itens.
-- A regra "título OU pelo menos 1 item" é aplicada no backend (não dá pra
-- expressar bem via constraint entre duas tabelas).
alter table tarefas alter column titulo drop not null;

NOTIFY pgrst, 'reload schema';
```

`on delete cascade` garante que apagar a tarefa apaga os itens.
`concluido_por ... on delete set null` preserva o item se o usuário for removido.

A migration fica **pendente** (o usuário roda no Supabase). O backend deve
degradar com segurança se rodar antes dela (a query de `itens` falharia; ver
2.3 — os itens vêm como relação aninhada, então sem a tabela o join quebra;
por isso a migration precisa rodar antes de subir o backend novo — documentar
isso no aviso de conclusão, como nas outras migrations pendentes).

### 2.2 Tipos — `src/features/tarefas/types.ts`

```ts
export interface TarefaItem {
  id: string;
  texto: string;
  concluido: boolean;
  ordem: number;
  concluido_em: string | null;
  concluido_por: string | null;
}
```

- `Tarefa` ganha `itens: TarefaItem[]` (sempre presente; `[]` quando não há).
- `titulo` em `Tarefa` passa a `string | null`.
- `TarefaInput` e `TarefaUpdateInput`: `titulo` opcional/anulável; ganham
  `itens?: TarefaItemInput[]` onde
  `TarefaItemInput = { id?: string; texto: string }` (com `id` nos que já
  existem, sem `id` nos novos — usado no diff do PATCH).

### 2.3 Backend — `src/server/routes/tarefas.ts`

**SELECT com itens**

`SELECT_COM_JOINS` passa a incluir os itens aninhados, ordenados por `ordem`:

```
'*, atribuido:usuarios!atribuido_para(...), criador:usuarios!criado_por(...), '
+ 'cliente:clientes(...), itens:tarefa_itens(id, texto, concluido, ordem, concluido_em, concluido_por)'
```

Ordenação dos itens por `ordem` via `.order('ordem', { foreignTable: 'tarefa_itens', ascending: true })`
na query (ou ordenar em JS após buscar, se o foreignTable order não cooperar —
decidir na implementação). `itens` nunca deve vir `null` pro cliente: normalizar
pra `[]`.

**Validação compartilhada de itens**

Helper `normalizarItens(body): { texto: string }[]` — filtra itens com `texto`
não-vazio (trim), preserva ordem do array. Um item só-espaços é descartado.

**POST `/`**

- Regra nova: exige `titulo` (trim não-vazio) **ou** ≥1 item válido. Se nenhum
  dos dois → 400 `'Informe um título ou pelo menos um item'`.
- `titulo` agora pode ser `null` (quando só há itens).
- Após inserir a tarefa, inserir os itens (`ordem` = índice no array,
  `concluido = false`).
- Notificação push mantém o corpo = título; quando não há título, usar o texto
  do 1º item como corpo (fallback), pra a notificação não ir vazia.

**PATCH `/:id` (diff de itens)**

- `CAMPOS_EDITAVEIS` continua igual pros campos escalares; `titulo` passa a
  aceitar `null`.
- Se `req.body.itens` veio (definido), aplicar diff **por id** dentro da mesma
  requisição:
  - itens com `id` existente → `update` de `texto` e `ordem` (preserva
    `concluido`, `concluido_em`, `concluido_por`);
  - itens sem `id` → `insert` (novos, `concluido = false`);
  - ids que existiam e não vieram → `delete`.
- Validação: após aplicar o diff, a tarefa precisa continuar tendo `titulo` **ou**
  ≥1 item — senão 400.
- **Recalcular status** ao final (mesma função de 2.4), porque apagar o único
  item pendente pode fechar a tarefa, e adicionar um item novo a uma tarefa
  concluída deve reabri-la.

**PATCH `/:id/itens/:itemId/toggle` (novo)**

- Permissão = mesma de `concluir`: `ehAdminOuEquipe(roles)` **ou**
  (`ehExecutor(roles)` e `tarefa.atribuido_para === req.usuario.id`). Senão 403.
- Alterna `concluido`. Ao marcar: grava `concluido_em = now()`,
  `concluido_por = req.usuario.id`. Ao desmarcar: zera os dois.
- Chama o recálculo de status e **devolve a tarefa inteira** (`SELECT_COM_JOINS`),
  igual ao `concluir`/`reabrir`, pro cliente atualizar num só passo.

**`/concluir` e `/reabrir` com itens**

- Se a tarefa tem ≥1 item, `/concluir` → 400 `'Marque todos os itens para concluir'`
  e `/reabrir` → 400 `'Desmarque um item para reabrir'`. Com itens, a conclusão
  é dirigida só pelo toggle. Sem itens, comportam-se como hoje.

### 2.4 Recálculo de status (backend)

Função `recalcularStatusTarefa(supabase, tarefaId)`:

- Busca os itens da tarefa.
- Se **não há itens**: não mexe no status (tarefa "livre", controlada por
  `/concluir`/`/reabrir`).
- Se **há itens**:
  - todos `concluido` → se ainda não estava `concluida`, seta
    `status = 'concluida'`, `concluida_em = now()`;
  - algum pendente → se estava `concluida`, seta `status = 'pendente'`,
    `concluida_em = null`.
- Idempotente (não regrava se já está no estado certo).

Usada pelo toggle e pelo PATCH (após diff).

### 2.5 Frontend — API (`src/features/tarefas/api.ts`)

- `criar`/`atualizar` já mandam o payload inteiro — só incluir `itens` no tipo.
- Novo: `alternarItem: (tarefaId, itemId) => api.patch(`/api/tarefas/${tarefaId}/itens/${itemId}/toggle`, {})`.

### 2.6 Frontend — formulário (`TarefasView.tsx`)

- `EMPTY_FORM` ganha `itens: []`.
- Editor de checklist no modal, abaixo da descrição:
  - lista de linhas, cada uma com um input de texto + botão remover (X);
  - botão "＋ Adicionar item" ao final;
  - Enter num input adiciona uma linha nova (fluxo rápido de digitação);
  - estado local `itens: { id?: string; texto: string }[]`.
- `abrirEditar` popula `itens` a partir de `tarefa.itens` (com `id` e `texto`).
- Validação `salvar`: `form.titulo.trim()` **ou** algum item com texto → senão
  `setErroForm('Informe um título ou pelo menos um item')`. Remove a
  obrigatoriedade atual do título.
- Placeholder do título: indicar que é opcional havendo itens.
- Alvos de toque mobile: inputs/botões `h-11 sm:h-9` no padrão já usado.

### 2.7 Frontend — cards (`TarefaCards.tsx`)

**Progresso** (helper em `tarefaUtils.ts`):

```ts
export function progressoChecklist(tarefa: Tarefa): { feitos: number; total: number } | null
// null quando total === 0
```

**Card recolhido** (`tarefas.map`):

- Com itens: badge `feitos/total` + barra fina de progresso
  (`bg-surface-inset` com preenchimento `bg-positive` proporcional).
- **Com título**: título como hoje; progresso abaixo dos badges.
- **Sem título**: o **primeiro item vira o título visual** (mesma tipografia do
  título), mas com sinalização de checklist para não parecer tarefa única:
  - ícone `ListChecks` (lucide) antes do texto;
  - badge de progresso `1/3` ao lado;
  - os itens restantes listados abaixo em `text-xs text-text-faint` com um
    quadradinho de checkbox (✓ quando feito), até 2–3 linhas, com "+N" se
    exceder.
  - O primeiro item, se concluído, aparece riscado — igual aos demais.

**Painel expandido**:

- Bloco de checklist (quando `itens.length > 0`), acima do bloco de detalhes:
  - barra de progresso + texto `feitos de total`;
  - cada item: linha clicável com checkbox (quadrado, vira ✓ `bg-positive`
    quando marcado), texto riscado quando concluído (`line-through opacity-60`);
  - clicar chama `tarefasApi.alternarItem(...)` → atualiza `ativa` e a lista
    (otimista + refetch, no padrão do `salvarNumeroCliente`);
  - se o usuário **não pode marcar** (sem permissão), os checkboxes ficam
    só-leitura (sem handler, cursor default, sem hover).
- Título do painel: quando `ativa.titulo` é `null`, usar o 1º item como título
  (com o mesmo tratamento de "é checklist") em vez de deixar vazio.

**Ações condicionais**:

- `StatusDaTarefa` continua igual (deriva de `status`/`prazo`).
- Quando a tarefa **tem itens**: **não** renderizar o botão "Concluir"
  (`renderAcaoRapida`) nem os itens de menu "Concluir/Reabrir"
  (`renderMenu` na `TarefasView`) — a conclusão é pelo checklist. Editar/Excluir
  continuam. Isso exige as render props checarem `tarefa.itens.length`.

### 2.8 Patch notes — `src/features/patchnotes/data.ts`

Item novo descrevendo: checklists dentro de tarefas (conclusão automática ao
marcar tudo), tarefas sem título, e horários de designada/concluída.

## Testes

- `src/features/tarefas/tarefaUtils.test.ts`:
  - `formatarMomentoRelativo`: `null`; <1min ("agora"); minutos; horas;
    "ontem"/dias — injetando `agora` fixo.
  - `progressoChecklist`: sem itens (`null`); parcial; completo.
- (Opcional, se houver harness de rota) lógica de `recalcularStatusTarefa`:
  marcar último item conclui; desmarcar reabre. Se não houver setup de teste de
  rota para tarefas, cobrir a regra via os helpers puros e verificação manual no
  preview.

## Verificação (preview)

- Criar tarefa só com itens (sem título) → card mostra 1º item como título +
  progresso + itens restantes; não parece tarefa simples.
- Marcar todos os itens no painel → tarefa vira "Concluída" sozinha; desmarcar
  um → volta a "Pendente".
- Conferir "Designada em"/"Concluída em" com "2h atrás".
- Preset mobile: checkboxes com alvo de toque confortável; layout sem overflow.

## Fora de escopo (YAGNI)

- Reordenar itens por drag-and-drop (ordem = ordem de criação/edição).
- Responsável adicionar itens próprios.
- Notificação push por item concluído.
- Histórico/auditoria além de `concluido_por`/`concluido_em` no próprio item.
