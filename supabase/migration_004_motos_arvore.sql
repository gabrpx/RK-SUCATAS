-- =============================================================================
-- RK Sucatas — Migração 004: árvore de marca/cilindrada para modelos_moto
-- =============================================================================
-- Rode isso no editor SQL do Supabase (projeto que já tem schema.sql +
-- migration_002 + migration_003 aplicados). modelos_moto deixa de ser uma
-- lista plana e vira uma árvore por parent_id (mesmo formato de categorias):
-- Marca (raiz) > Cilindrada (filho) > Modelo (neto, com ano). estoque.modelo_moto_id
-- e vendas.modelo_moto_id continuam iguais — não mudam de tipo, só passam a
-- poder apontar pra um nó em qualquer profundidade da árvore.
-- =============================================================================

alter table modelos_moto add column parent_id uuid references modelos_moto(id) on delete restrict;
alter table modelos_moto add column ordem integer not null default 0;
alter table modelos_moto add column ano text;

-- Impede um modelo de ser pai dele mesmo. Ciclos maiores são bloqueados na
-- aplicação (rota PUT /api/modelos-moto/:id), igual já é feito em categorias.
alter table modelos_moto add constraint modelos_moto_nao_e_pai_de_si_mesma check (id <> parent_id);

-- Migra dados existentes: cada `marca` distinta (quando preenchida) vira um
-- nó raiz, e os modelos antigos com essa marca passam a ser filhos dele.
-- Modelos sem marca preenchida (nunca foi coletada pelo formulário até hoje)
-- ficam como nó raiz deles mesmos — dá pra reorganizar depois pela tela de
-- gerenciamento ("mover para...").
do $$
declare
  r record;
  v_marca_id uuid;
begin
  for r in select distinct marca from modelos_moto where marca is not null and trim(marca) <> '' loop
    insert into modelos_moto (nome, parent_id) values (trim(r.marca), null)
    returning id into v_marca_id;

    update modelos_moto set parent_id = v_marca_id
    where marca = r.marca and id <> v_marca_id;
  end loop;
end $$;

alter table modelos_moto drop column marca;

-- Nome deixa de ser único globalmente e passa a ser único só dentro do
-- mesmo nível (mesmo pai) — permite por exemplo duas cilindradas "150" em
-- marcas diferentes.
alter table modelos_moto drop constraint if exists modelos_moto_nome_key;
create unique index modelos_moto_parent_nome_uidx
  on modelos_moto (coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), nome);

create index idx_modelos_moto_parent on modelos_moto(parent_id);

NOTIFY pgrst, 'reload schema';
