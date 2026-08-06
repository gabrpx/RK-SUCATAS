-- =============================================================================
-- RK Sucatas — Migração 036: comprovantes de PIX anexados a vendas
-- =============================================================================
-- Rode isso no editor SQL do Supabase (depende de vendas, clientes, usuarios
-- — schema.sql + migrations 002 a 035 aplicadas).
--
-- Cada venda pode ter MÚLTIPLOS comprovantes (imagem ou PDF) — upload novo
-- sempre SOMA à lista, nunca substitui um anterior. cliente_id aqui é
-- desnormalizado de vendas.cliente_id no momento do insert: cancelar_venda
-- (ver migration_010) faz HARD DELETE da linha de vendas, então sem essa
-- cópia o comprovante perderia o vínculo com o cliente também quando a
-- venda que o originou for cancelada.
--
-- venda_id e cliente_id são "on delete set null" DE PROPÓSITO — nunca
-- "cascade". Se o comprovante cascateasse junto com a venda, um recibo de
-- pagamento já recebido desapareceria ao cancelar a venda, violando a regra
-- de que comprovante nunca pode ser destruído. Com "set null" o registro
-- sobrevive (só perde a referência), exatamente como envios.venda_id/
-- cliente_id já fazem (migration_034) e caixa.venda_id já fazia desde o
-- schema original.
--
-- Exclusão pelo usuário é sempre soft-delete (removido_em/removido_por) — o
-- arquivo no Storage NUNCA é apagado, mesmo por admin. Ver rota DELETE em
-- src/server/routes/vendas.ts.
-- =============================================================================

create table comprovantes_pix (
  id uuid primary key default gen_random_uuid(),
  venda_id uuid references vendas(id) on delete set null,
  cliente_id uuid references clientes(id) on delete set null,
  storage_path text not null,          -- caminho no bucket "comprovantes" (privado) — URL é assinada e gerada por request, nunca persistida
  nome_arquivo text not null,          -- nome original do arquivo, pro usuário reconhecer na lista
  tipo_mime text not null
    check (tipo_mime in ('image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf')),
  tamanho_bytes integer not null check (tamanho_bytes > 0),
  criado_por uuid not null references usuarios(id) on delete restrict,
  criado_em timestamptz not null default now(),
  removido_em timestamptz,
  removido_por uuid references usuarios(id) on delete restrict
);

-- Índices parciais (só sobre o que está ativo) — as duas listagens que
-- importam (comprovantes de UMA venda, comprovantes agregados de UM
-- cliente) sempre filtram removido_em is null.
create index idx_comprovantes_pix_venda on comprovantes_pix(venda_id) where removido_em is null;
create index idx_comprovantes_pix_cliente on comprovantes_pix(cliente_id) where removido_em is null;

alter table comprovantes_pix enable row level security;
-- Sem policy pra anon/authenticated de propósito — só o backend (service_role)
-- mexe nessa tabela, igual todo o resto do schema.

-- -----------------------------------------------------------------------------
-- Storage: bucket dedicado pra comprovantes, PRIVADO (diferente do bucket
-- "estoque", que é público). São dados financeiros/pessoais vinculados a um
-- cliente identificável — leitura só via URL assinada de curta duração
-- gerada pelo backend (ver src/services/storageService.ts), nunca por URL
-- pública permanente.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('comprovantes', 'comprovantes', false)
on conflict (id) do nothing;

NOTIFY pgrst, 'reload schema';
