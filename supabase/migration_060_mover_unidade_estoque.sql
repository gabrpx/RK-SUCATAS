-- Move uma unidade física de uma ficha para outra, mantendo o invariante de
-- quantidade em ambas (ver migration_057: count(estoque_unidades) == quantidade).
-- Usa FOR UPDATE nas duas fichas em ordem crescente de id pra evitar deadlock —
-- mesmo padrão de registrar_venda/cancelar_venda em schema.sql.
create or replace function mover_unidade_estoque(
  p_unidade_id uuid,
  p_ficha_destino_id uuid
) returns void
language plpgsql
security definer
as $$
declare
  v_ficha_origem_id uuid;
  v_vendida_em timestamptz;
  v_qtd_origem int;
  v_qtd_destino int;
begin
  select estoque_id, vendida_em
  into v_ficha_origem_id, v_vendida_em
  from estoque_unidades
  where id = p_unidade_id;

  if v_ficha_origem_id is null then
    raise exception 'Unidade % não encontrada', p_unidade_id
      using errcode = 'P0001';
  end if;
  if v_vendida_em is not null then
    raise exception 'Unidade já foi vendida e não pode ser movida'
      using errcode = 'P0001';
  end if;
  if v_ficha_origem_id = p_ficha_destino_id then
    raise exception 'Unidade já pertence à ficha de destino'
      using errcode = 'P0001';
  end if;

  -- Trava em ordem crescente de id pra evitar deadlock entre chamadas concorrentes.
  if v_ficha_origem_id < p_ficha_destino_id then
    select quantidade into v_qtd_origem  from estoque where id = v_ficha_origem_id  for update;
    select quantidade into v_qtd_destino from estoque where id = p_ficha_destino_id for update;
  else
    select quantidade into v_qtd_destino from estoque where id = p_ficha_destino_id for update;
    select quantidade into v_qtd_origem  from estoque where id = v_ficha_origem_id  for update;
  end if;

  if v_qtd_origem is null then
    raise exception 'Ficha de origem não encontrada'
      using errcode = 'P0001';
  end if;
  if v_qtd_destino is null then
    raise exception 'Ficha de destino não encontrada'
      using errcode = 'P0001';
  end if;
  if v_qtd_origem <= 0 then
    raise exception 'Ficha de origem sem quantidade para mover'
      using errcode = 'P0001';
  end if;

  update estoque_unidades set estoque_id = p_ficha_destino_id where id = p_unidade_id;
  update estoque set quantidade = v_qtd_origem  - 1 where id = v_ficha_origem_id;
  update estoque set quantidade = v_qtd_destino + 1 where id = p_ficha_destino_id;
end;
$$;
