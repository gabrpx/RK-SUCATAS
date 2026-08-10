-- =============================================================================
-- RK Sucatas — Migração 041: pendências manuais de Caixa (Fiado/Pendência)
-- =============================================================================
-- Rode isso no editor SQL do Supabase, DEPOIS de schema.sql + migrations
-- 002 a 040 aplicadas (usa formas_pagamento.natureza da migration_030 e a
-- trigger set_atualizado_em de schema.sql).
--
-- O modal "Novo Lançamento" do Caixa só tinha Entrada/Saída — um valor "a
-- receber depois" registrado ali entrava direto em `caixa` e distorcia o
-- saldo na hora, mesmo sem o dinheiro ter sido recebido de fato. O sistema
-- já resolve exatamente esse problema pra Vendas (venda com forma de
-- pagamento de natureza 'fiado' não lança em caixa até um recebimento ser
-- confirmado — ver fiado_recebimentos/registrar_recebimento_fiado,
-- migration_031); esta migração traz o mesmo modelo pro lançamento manual
-- de Caixa, SEM tocar em fiado_recebimentos/vendas: uma pendência de caixa
-- não nasce de uma venda e não tem cliente vinculado (o modal de Caixa não
-- tem campo de cliente).
--
-- "Fiado/Pendência" no Caixa é sempre um valor a RECEBER no futuro (nunca
-- uma saída pendente) — por isso o RPC abaixo só insere tipo='entrada' em
-- caixa, nunca 'saida'.
--
-- Tabelas paralelas a fiado_recebimentos (não generalizadas) de propósito:
-- fiado_recebimentos.venda_id é "not null" com "on delete restrict" só pra
-- travar cancelar_venda — torná-lo nullable exigiria uma regra "exatamente
-- um entre venda_id/pendencia_id" que FK simples não expressa bem, e
-- arriscaria regressão no fluxo de Vendas/Fiado, que deve ficar intocado.
--
-- caixa_pendencia_recebimentos.pendencia_id é "on delete restrict" de
-- propósito, mesmo motivo de fiado_recebimentos.venda_id: impede apagar uma
-- pendência que já tem dinheiro recebido registrado sem reverter os
-- recebimentos primeiro (DELETE /api/caixa-pendencias/:id/recebimentos/:id).
-- =============================================================================

create table caixa_pendencias (
  id uuid primary key default gen_random_uuid(),
  descricao text not null,
  valor_total numeric(10,2) not null check (valor_total > 0),
  -- Mantido pelo RPC abaixo (não recalculado a cada leitura) — permite
  -- filtrar "pendências em aberto" com um where simples, mesmo padrão de
  -- tarefas.status. Diferente de fiado, que não tem status próprio porque
  -- `vendas` serve outros fluxos além de fiado.
  status text not null check (status in ('aberta', 'quitada')) default 'aberta',
  data date not null default current_date,
  criado_por uuid not null references usuarios(id) on delete restrict,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index idx_caixa_pendencias_status on caixa_pendencias(status);

create trigger trg_caixa_pendencias_atualizado_em
  before update on caixa_pendencias
  for each row execute function set_atualizado_em();

alter table caixa_pendencias enable row level security;
-- Sem policy pra anon/authenticated de propósito — só o backend
-- (service_role) mexe nessa tabela, igual todo o resto do schema.

create table caixa_pendencia_recebimentos (
  id uuid primary key default gen_random_uuid(),
  pendencia_id uuid not null references caixa_pendencias(id) on delete restrict,
  valor numeric(10,2) not null check (valor > 0),
  forma_pagamento_id uuid not null references formas_pagamento(id) on delete restrict,
  caixa_id uuid references caixa(id) on delete set null,
  recebido_por uuid not null references usuarios(id) on delete restrict,
  recebido_em timestamptz not null default now()
);

create index idx_caixa_pendencia_recebimentos_pendencia on caixa_pendencia_recebimentos(pendencia_id);

alter table caixa_pendencia_recebimentos enable row level security;
-- Sem policy pra anon/authenticated de propósito — só o backend (service_role).

-- Transacional, mesmo desenho de registrar_recebimento_fiado (migration_031):
-- trava a pendência, valida saldo em aberto e forma de pagamento, insere a
-- entrada em caixa e o recebimento juntos. Marca a pendência como 'quitada'
-- quando o saldo remanescente chega a zero. `for update` evita que dois
-- recebimentos simultâneos juntos ultrapassem o saldo.
create or replace function registrar_recebimento_caixa_pendencia(
  p_pendencia_id uuid,
  p_valor numeric,
  p_forma_pagamento_id uuid,
  p_usuario_id uuid
) returns caixa_pendencia_recebimentos as $$
declare
  v_pendencia caixa_pendencias;
  v_ja_recebido numeric;
  v_saldo numeric;
  v_natureza_forma text;
  v_caixa caixa;
  v_recebimento caixa_pendencia_recebimentos;
begin
  select * into v_pendencia from caixa_pendencias where id = p_pendencia_id for update;
  if v_pendencia is null then
    raise exception 'Pendência não encontrada';
  end if;

  if p_valor is null or p_valor <= 0 then
    raise exception 'Valor precisa ser maior que zero';
  end if;

  select natureza into v_natureza_forma from formas_pagamento where id = p_forma_pagamento_id;
  if v_natureza_forma is null then
    raise exception 'Forma de pagamento não encontrada';
  end if;
  if v_natureza_forma = 'fiado' then
    raise exception 'Escolha uma forma de pagamento que não seja fiado pra confirmar o recebimento';
  end if;

  select coalesce(sum(valor), 0) into v_ja_recebido from caixa_pendencia_recebimentos where pendencia_id = p_pendencia_id;
  v_saldo := v_pendencia.valor_total - v_ja_recebido;

  if p_valor > v_saldo + 0.01 then
    raise exception 'Valor (%) maior que o saldo em aberto (%)', p_valor, v_saldo;
  end if;

  insert into caixa (tipo, descricao, valor, forma_pagamento_id, data)
  values ('entrada', 'Recebimento pendência: ' || v_pendencia.descricao, p_valor, p_forma_pagamento_id, current_date)
  returning * into v_caixa;

  insert into caixa_pendencia_recebimentos (pendencia_id, valor, forma_pagamento_id, caixa_id, recebido_por)
  values (p_pendencia_id, p_valor, p_forma_pagamento_id, v_caixa.id, p_usuario_id)
  returning * into v_recebimento;

  if (v_saldo - p_valor) <= 0.01 then
    update caixa_pendencias set status = 'quitada' where id = p_pendencia_id;
  end if;

  return v_recebimento;
end;
$$ language plpgsql;

NOTIFY pgrst, 'reload schema';
