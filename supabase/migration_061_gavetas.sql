-- =============================================================================
-- RK Sucatas — Migração 061: gavetas (nova organização de estoque)
-- =============================================================================
-- Rode no editor SQL do Supabase (schema.sql + migrations 002 a 060).
--
-- Substitui o conceito de "famílias" pelo de "gavetas" (ver
-- docs/superpowers/specs/2026-09-10-estoque-gavetas-fase1-design.md).
-- A gaveta agrupa peças semelhantes; peça sem gaveta (gaveta_id null)
-- aparece como "ITENS NÃO AGRUPADOS". Organização 100% manual — nenhuma
-- conversão automática de família → gaveta. Famílias continua existindo em
-- paralelo nesta fase (nada é migrado nem apagado).
--
-- Também promove a unidade física a item de primeira classe: renomeia
-- estoque_unidades.apelido -> nome e adiciona descricao própria.
-- ATENÇÃO: a renomeação NÃO degrada graciosamente — suba o código junto.
-- =============================================================================

create table gavetas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,                          -- 100% manual, sem autocomplete
  categoria_id uuid references categorias(id) on delete set null,
  icone text,                                  -- emoji opcional (T01)
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create trigger trg_gavetas_atualizado_em
  before update on gavetas
  for each row execute function set_atualizado_em();

alter table gavetas enable row level security;
-- Sem policy pra anon/authenticated de propósito — só o backend (service_role)
-- mexe nessa tabela, igual todo o resto do schema.

alter table estoque add column if not exists gaveta_id uuid
  references gavetas(id) on delete set null;   -- null = item não agrupado
create index if not exists idx_estoque_gaveta on estoque(gaveta_id);

-- Unidade como item de primeira classe: nome próprio (renomeado de apelido) e
-- descricao própria. Demais campos (valor, fotos, avaria, avaria_descricao,
-- condicao_nota) já existem. Opcionais no schema; a UI exige só preço.
alter table estoque_unidades rename column apelido to nome;
alter table estoque_unidades add column if not exists descricao text;

NOTIFY pgrst, 'reload schema';
