-- =============================================================================
-- RK Sucatas — Migração 055: split de clientes.cidade em (cidade, estado)
-- =============================================================================
-- Rode isso no editor SQL do Supabase (schema.sql + migrations 002 a 054).
-- Adiciona a coluna estado (CHAR(2)) e faz backfill best-effort do padrão
-- "Cidade - UF" (com ou sem espaço) que hoje é gravado concatenado.

alter table clientes add column if not exists estado char(2);

with brazilian_ufs as (
  select unnest(array[
    'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA',
    'PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'
  ]) as uf
)
update clientes c
set
  estado = split_uf,
  cidade = split_cidade
from (
  select
    id,
    trim(split_part(cidade, ' - ', 1)) as split_cidade,
    upper(trim(split_part(cidade, ' - ', 2))) as split_uf
  from clientes
  where cidade ~ '^.+ - [A-Za-z]{2}$'
) parsed
where c.id = parsed.id
  and parsed.split_uf in (select uf from brazilian_ufs);

with brazilian_ufs as (
  select unnest(array[
    'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA',
    'PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'
  ]) as uf
)
update clientes c
set
  estado = split_uf,
  cidade = split_cidade
from (
  select
    id,
    trim(split_part(cidade, '-', 1)) as split_cidade,
    upper(trim(split_part(cidade, '-', 2))) as split_uf
  from clientes
  where cidade ~ '^.+-[A-Za-z]{2}$'
    and estado is null
) parsed
where c.id = parsed.id
  and parsed.split_uf in (select uf from brazilian_ufs);

NOTIFY pgrst, 'reload schema';
