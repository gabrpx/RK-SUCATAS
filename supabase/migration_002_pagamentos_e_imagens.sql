-- =============================================================================
-- RK Sucatas — Migração 002: formas de pagamento editáveis + upload de imagem
-- =============================================================================
-- Rode isso no editor SQL do Supabase (projeto que já tem o schema.sql
-- original aplicado). Seguro rodar mesmo com dados existentes — só altera
-- vendas/caixa, não apaga nada de estoque.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Formas de pagamento — vira tabela de apoio (antes era lista fixa no código)
-- -----------------------------------------------------------------------------
create table formas_pagamento (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  criado_em timestamptz not null default now()
);

-- Seed com as formas já usadas, pra não perder nada do que já existia
insert into formas_pagamento (nome) values
  ('CRÉDITO'), ('DÉBITO'), ('DINHEIRO'), ('MARCELO'), ('PENDÊNCIA'), ('PIX');

alter table formas_pagamento enable row level security;

-- -----------------------------------------------------------------------------
-- Troca a coluna de texto livre por FK (mesmo padrão de categoria_id/modelo_moto_id)
-- -----------------------------------------------------------------------------
alter table vendas add column forma_pagamento_id uuid references formas_pagamento(id) on delete set null;
alter table caixa add column forma_pagamento_id uuid references formas_pagamento(id) on delete set null;

-- Se você já tinha vendas/caixa com a coluna de texto antiga preenchida,
-- isso tenta casar pelo nome antes de descartar a coluna velha.
update vendas v set forma_pagamento_id = fp.id
  from formas_pagamento fp where fp.nome = v.forma_pagamento;
update caixa c set forma_pagamento_id = fp.id
  from formas_pagamento fp where fp.nome = c.forma_pagamento;

alter table vendas drop column forma_pagamento;
alter table caixa drop column forma_pagamento;

-- -----------------------------------------------------------------------------
-- registrar_venda atualizada pra usar forma_pagamento_id
-- -----------------------------------------------------------------------------
create or replace function registrar_venda(
  p_estoque_id uuid,
  p_quantidade int,
  p_valor_unitario numeric,
  p_forma_pagamento_id uuid,
  p_modelo_moto_id uuid default null,
  p_cliente_nome text default null,
  p_observacoes text default null,
  p_data date default current_date
) returns vendas as $$
declare
  v_nome text;
  v_estoque_atual int;
  v_venda vendas;
begin
  select nome, quantidade into v_nome, v_estoque_atual
  from estoque where id = p_estoque_id
  for update;

  if v_estoque_atual is null then
    raise exception 'Item de estoque não encontrado';
  end if;
  if v_estoque_atual < p_quantidade then
    raise exception 'Estoque insuficiente: disponível %, solicitado %', v_estoque_atual, p_quantidade;
  end if;

  update estoque set quantidade = quantidade - p_quantidade where id = p_estoque_id;

  insert into vendas (
    estoque_id, nome_item, quantidade, valor_unitario, valor_total,
    forma_pagamento_id, modelo_moto_id, cliente_nome, observacoes, data
  ) values (
    p_estoque_id, v_nome, p_quantidade, p_valor_unitario, p_quantidade * p_valor_unitario,
    p_forma_pagamento_id, p_modelo_moto_id, p_cliente_nome, p_observacoes, coalesce(p_data, current_date)
  ) returning * into v_venda;

  insert into caixa (tipo, descricao, valor, forma_pagamento_id, venda_id, data)
  values ('entrada', 'Venda: ' || v_nome, v_venda.valor_total, p_forma_pagamento_id, v_venda.id, v_venda.data);

  return v_venda;
end;
$$ language plpgsql;

-- -----------------------------------------------------------------------------
-- Bucket público pras imagens do estoque (upload via anexo)
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('estoque', 'estoque', true)
on conflict (id) do nothing;

NOTIFY pgrst, 'reload schema';
