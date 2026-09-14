# Estoque por Gavetas — Fase 1 (Setup + CRUD): design

Data: 2026-09-10
Escopo: reorganizar o estoque existente pelo conceito de **gavetas** (do
plano `docs/PROMPT-CLAUDE-CODE.md` + `docs/IMPLEMENTATION.md` + mockups
`docs/mockups/T01/T02/T03/T09/T13`), aposentando o conceito de **famílias**.
Fase 1 apenas — Vendas/Busca (Fase 2), UX avançado (Fase 3) e Migração/Desktop
(Fase 4) têm specs próprias depois.

## 1. Intenção (do dono, nesta sessão)

- O **estoque é o mesmo**: as peças e unidades físicas que já existem em
  produção (tabelas `estoque` e `estoque_unidades`) continuam sendo a fonte
  da verdade. Nada é recadastrado nem duplicado.
- O que muda é a **camada de organização**: sai "famílias", entra "gavetas",
  com a UI nova dos mockups.
- **Nada do conceito de famílias é reaproveitado.** Gaveta é um mecanismo
  novo (tabela nova, vínculo novo, UI nova), não um rename de `estoque_familias`.
- A organização é **manual**: o dono cria as gavetas e move as peças para
  dentro delas pela tela nova. Peças sem gaveta aparecem como
  "ITENS NÃO AGRUPADOS".
- **Nenhum dado é convertido automaticamente** de família → gaveta.

## 2. Mapeamento de conceitos (plano → produção)

Hierarquia confirmada pelo dono, com exemplo:

```
GAVETA:   Tanque de Combustível CG 125          (agrupa peças semelhantes)
 VARIANTE: Tanque CG 125 Titan · 1995–1999       (peça + modelo + faixa de ano)
  UNIDADE:  #1 e #2 — cada uma com nome, foto, descrição, avaria, nota PRÓPRIOS
```

| Plano (mockups) | Produção (código real) | Observação |
|---|---|---|
| **Gaveta** (agrupamento lógico) | **novo** `gavetas` + `estoque.gaveta_id` | substitui famílias |
| **Variante** (modelo/ano/condição) | **peça** = linha de `estoque` | já existe |
| **Unidade** (peça física individual) | `estoque_unidades` **estendida** | ver abaixo |
| Faixa min~max da variante | computada sobre as unidades | já existe |
| Categorias / filtro | `categorias` (schema.sql) | reusar, não recriar |

**Desvio consciente do schema literal do plano:** o `IMPLEMENTATION.md`
define tabelas novas `variantes`/`unidades`. NÃO as criamos — isso duplicaria
o estoque. Reusamos `estoque` (variante) e `estoque_unidades` (unidade). A
única tabela nova de dados é `gavetas`, mais a coluna `estoque.gaveta_id`.

**Unidade como item de primeira classe (mudança de modelo):** hoje
`estoque_unidades` é um registro "leve" que herda foto/preço/nota da peça-mãe.
O dono quer que cada unidade tenha **suas próprias informações completas** —
tudo o que se preenche ao cadastrar um item. Campos hoje: `apelido`, `avaria`,
`avaria_descricao`, `fotos`, `valor`, `condicao_nota`. Faltam e serão
adicionados: **`nome`** (nome próprio da unidade) e **`descricao`** (descrição
geral, hoje só existe `avaria_descricao`). Preço permanece obrigatório por
unidade; os demais campos são opcionais (cadastro mínimo = só preço).

## 3. Banco de dados (migration nova)

Arquivo: `supabase/migration_061_gavetas.sql` (o dono roda no Supabase; é o
fluxo do repo). Idempotente (`if not exists`), degrada com segurança.

```
create table gavetas (
  id           uuid primary key default gen_random_uuid(),
  nome         text not null,               -- 100% manual, sem autocomplete
  categoria_id uuid references categorias(id) on delete set null,
  icone        text,                         -- emoji opcional (T01)
  criado_em    timestamptz default now(),
  atualizado_em timestamptz default now()
);
alter table estoque add column if not exists gaveta_id uuid
  references gavetas(id) on delete set null;   -- null = item não agrupado
create index if not exists idx_estoque_gaveta on estoque(gaveta_id);

-- Unidade como item de primeira classe: nome e descrição próprios
-- (os demais campos — valor, fotos, avaria, avaria_descricao, condicao_nota —
--  já existem em estoque_unidades). Opcionais no schema; a UI exige só
--  preço (cadastro mínimo).
alter table estoque_unidades rename column apelido to nome;   -- apelido → nome
alter table estoque_unidades add column if not exists descricao text;
```

**Impacto do rename `apelido → nome`:** toda referência a
`estoque_unidades.apelido` precisa virar `nome` — backend
(`src/server/routes/estoque.ts` e services que leem/gravam unidade), tipos
(`EstoqueUnidade.apelido`, `EstoqueUnidadeInput`), e a UI de famílias que
ainda fica no ar nesta fase (`EstoqueFamiliaModal`, `UnidadesEstoque`,
`RegistrarUnidadeDialog`, `familiaEstoque.ts` e testes). Sem essa varredura a
UI antiga quebra. Fazer via busca por `apelido` no módulo estoque + ajuste,
com `tsc --noEmit` limpo ao final.

RLS: seguir o padrão já usado nas tabelas do projeto (política de acesso
autenticado, como as demais migrations). Permissões: reusar
`estoque.ver/criar/editar/deletar` na Fase 1; chaves `gaveta.*` dedicadas
ficam para depois (não bloquear a Fase 1).

Stats por gaveta (faixa de preço, nº de variantes, nº de unidades
disponíveis, valor total) são **computados no backend/domínio** reaproveitando
a lógica pura já existente de preço/unidade — sem depender de views novas na
Fase 1 (menos superfície de migration). Uma view pode ser adicionada depois
se a performance pedir.

## 4. Backend (`src/server/routes/estoque.ts` + rota nova de gavetas)

- `GET /api/gavetas` — lista gavetas (+ categoria) com stats agregadas.
- `POST /api/gavetas` — cria (nome obrigatório, categoria opcional).
- `PATCH /api/gavetas/:id` — renomeia / troca categoria / ícone.
- `DELETE /api/gavetas/:id` — exclui a gaveta; peças voltam a `gaveta_id=null`
  (não some peça nenhuma). **Com confirmação** (não repetir o erro F05 da
  auditoria de excluir sem confirmar).
- `GET /api/estoque` já retorna as peças; adicionar `gaveta`/`gaveta_id` ao
  payload (join simples), tratado como opcional no client (payloads em cache).
- `PATCH /api/estoque/:id` aceita `gaveta_id` (mover peça para gaveta / soltar).

Handlers assíncronos com `try/catch/finally` (evitar F15 — botão travado em
rede ruim). Sem reaproveitar código de `estoqueFamilias.ts`.

## 5. Frontend (novo, coexistindo — nada é apagado nesta fase)

Novos arquivos em `src/features/estoque/gaveta/`, rota nova (ex.
`/estoque/gavetas`) — a UI de famílias (`EstoqueFamiliaModal` etc.) **não é
removida** nesta fase; a aposentadoria é decisão do dono quando o novo estiver
validado (parte "responsável" do plano).

Telas (ler o mockup com `Read()` imediatamente antes de implementar cada uma):

- **T01 — `GavetaList.tsx`**: header + "Nova Gaveta"; search; stats-row (4
  pills: gavetas / variantes / unidades / valor total, número > label);
  filter-chips por categoria; lista de gavetas (`GavetaRow`); seção "ITENS NÃO
  AGRUPADOS" (peças com `gaveta_id=null`, visual dimmed, badge "SEM GRUPO").
- **T02 — `GavetaDetail.tsx`**: back nav; título editável inline; meta
  (categoria · N variantes · N unidades · faixa R$); `VarianteCard` por peça
  com edição inline (nome/ano/tipo), badges (Original/Paralela/Novo/ML/Shopee),
  faixa de preço computada, lista de unidades (`UnidadeRow`) com dot de status,
  apelido, nota; unidade "cadastro mínimo" (só preço) com ⚠️; botão "+ Unidade".
- **T03 — `UnidadeForm.tsx`**: form inline dentro do card; preço obrigatório
  (currency-input R$), resto opcional; anos; checkbox avaria; upload de fotos
  (Supabase Storage, `use-media`); Salvar (único accent) / Cancelar (ghost).
- **T09 — skeletons** (animate-ui) em todas as telas durante carregamento.
- **T13 — estados preventivos**: empty state (nenhuma gaveta), offline bar,
  alerta de duplicata de nome de gaveta (aviso + "vincular à existente?",
  reaproveitando a lógica de similaridade já existente no projeto).

Componentes base via **animate-ui** (CLI → `src/components/ui/`), customizados
para os tokens de `src/styles/theme.css` (nunca hex cru). Custom (stats-row,
filter-chips, currency-input) com Radix + Motion. Regras do design system:
cor com significado; no máx. 1 accent preenchido por tela; todo alerta com
ação; número > label.

Hooks (React Query): `use-gavetas`, `use-variantes` (peças de uma gaveta),
`use-unidades`, `use-media`.

## 6. Testes (Vitest, TDD onde a lógica justifica)

- Faixa de preço da gaveta/variante (min~max sobre unidades disponíveis,
  herança de preço).
- Agrupamento de peças por gaveta + seção "não agrupados".
- Máscara de moeda brasileira (currency-input).
- Rodar de dentro do escopo correto para não contaminar com worktrees
  (memória `npm-test-worktree-contamination`).

## 7. Fora de escopo (Fase 1)

Venda / seleção de unidade obrigatória (Fase 2), busca fuzzy `buscar_estoque`
(Fase 2), swipe-to-delete / lote / toasts (Fase 3), tela de Migração T07 /
layout desktop (Fase 4), remoção do código de famílias, chaves de permissão
`gaveta.*`, atualização de patch notes ao final da entrega (memória
`sempre-atualizar-patchnotes`).

## 8. Riscos / decisões abertas

- **Convivência com famílias:** as duas organizações coexistem
  temporariamente. Peça pode ter `familia_id` (antigo) e `gaveta_id` (novo) ao
  mesmo tempo — na Fase 1 ignoramos `familia_id` na UI nova; nenhuma escrita
  cruza os dois.
- **`estoque` mantém `quantidade`+`valor`** (não reestruturado nesta fase). A
  UI de gavetas lê unidades como fonte de exibição de preço, mas não altera o
  contrato da peça — evita mexer em Vendas/ML/Shopee/Orçamentos agora.
