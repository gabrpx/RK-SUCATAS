-- SKU global, sequencial e permanente para cada unidade física.
-- Execute somente após backup, ensaio e pré-checagens descritas no plano de fichas.
begin;

alter table estoque_unidades add column if not exists sku bigint;
create sequence if not exists estoque_unidades_sku_seq;

with ordenadas as (
  select id, row_number() over (order by criado_em asc, id asc)::bigint as novo_sku
  from estoque_unidades
)
update estoque_unidades unidade
set sku = ordenadas.novo_sku
from ordenadas
where unidade.id = ordenadas.id and unidade.sku is null;

select setval(
  'estoque_unidades_sku_seq',
  greatest(coalesce((select max(sku) from estoque_unidades), 1), 1),
  (select count(*) > 0 from estoque_unidades)
);

alter table estoque_unidades
  alter column sku set default nextval('estoque_unidades_sku_seq'),
  alter column sku set not null;

create unique index if not exists estoque_unidades_sku_key on estoque_unidades (sku);
notify pgrst, 'reload schema';
commit;
