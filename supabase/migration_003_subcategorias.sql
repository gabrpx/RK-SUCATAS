-- =============================================================================
-- RK Sucatas — Migração 003: subcategorias de profundidade variável
-- =============================================================================
-- Rode isso no editor SQL do Supabase (projeto que já tem schema.sql +
-- migration_002 aplicados). Categorias passam a poder ter uma categoria-pai,
-- formando uma árvore de profundidade livre (ex: Farol > Farol completo >
-- Bloco do farol). categoria_id do estoque continua igual — não muda de
-- tipo nem precisa de dados migrados, só passa a poder apontar pra um nó em
-- qualquer profundidade da árvore.
-- =============================================================================

alter table categorias add column parent_id uuid references categorias(id) on delete restrict;
alter table categorias add column ordem integer not null default 0;

-- Impede uma categoria de ser pai dela mesma. Ciclos maiores (A é pai de B,
-- B é pai de A) não dá pra bloquear só com CHECK — isso é validado na
-- aplicação (rota PUT /api/categorias/:id) antes de mover um nó.
alter table categorias add constraint categorias_nao_e_pai_de_si_mesma check (id <> parent_id);

-- Nome deixa de ser único globalmente e passa a ser único só dentro do
-- mesmo nível (mesmo pai) — permite por exemplo duas subcategorias
-- "Dianteira" em ramos diferentes da árvore.
alter table categorias drop constraint categorias_nome_key;
create unique index categorias_parent_nome_uidx
  on categorias (coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), nome);

create index idx_categorias_parent on categorias(parent_id);

NOTIFY pgrst, 'reload schema';
