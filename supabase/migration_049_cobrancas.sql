-- migration_049_cobrancas.sql
-- Sistema de cobrança vinculado a pendências (fiado ou manual).
-- Cada cobrança armazena: referência ao boleto PDF (mesmo shape de
-- comprovantes_pix), timer de lembrete (mesmo modelo de lembretes —
-- intervalo_minutos XOR horario_fixo), e registro de envio via WhatsApp.

create table if not exists cobrancas (
  id uuid primary key default gen_random_uuid(),

  -- Vínculo com a pendência: exatamente UM dos dois deve ser preenchido.
  venda_id uuid references vendas(id) on delete cascade,
  pendencia_id uuid references caixa_pendencias(id) on delete cascade,
  constraint cobranca_vinculo_check check (
    (venda_id is not null and pendencia_id is null) or
    (venda_id is null and pendencia_id is not null)
  ),
  constraint cobranca_venda_unique unique (venda_id),
  constraint cobranca_pendencia_unique unique (pendencia_id),

  -- Boleto PDF (opcional — pode criar cobrança só com timer/WhatsApp)
  boleto_storage_path text,
  boleto_nome_arquivo text,
  boleto_tipo_mime text,
  boleto_tamanho_bytes integer,

  -- Timer de lembrete (mesmo modelo de lembretes — mutuamente exclusivos)
  intervalo_minutos integer,
  horario_fixo timestamptz,
  proxima_notificacao_em timestamptz,
  timer_ativo boolean not null default false,

  -- Registro de envio
  ultimo_envio_em timestamptz,
  enviado_por uuid references usuarios(id),

  criado_por uuid references usuarios(id),
  criado_em timestamptz not null default now()
);

create index if not exists idx_cobrancas_venda_id on cobrancas(venda_id) where venda_id is not null;
create index if not exists idx_cobrancas_pendencia_id on cobrancas(pendencia_id) where pendencia_id is not null;
create index if not exists idx_cobrancas_proxima_notificacao on cobrancas(proxima_notificacao_em) where timer_ativo = true;

alter table cobrancas enable row level security;

create policy "cobrancas_all" on cobrancas for all using (true) with check (true);
