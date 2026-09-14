-- =============================================================================
-- RK Sucatas — Migração 026: margem de repasse na sincronização com o
-- Mercado Livre
-- =============================================================================
-- Rode isso no editor SQL do Supabase (projeto que já tem schema.sql +
-- migrations 002 a 025 aplicadas — inclusive a migração 025, da qual esta
-- depende conceitualmente, embora não tecnicamente).
--
-- O preço enviado ao Mercado Livre na sincronização passa a ser o preço
-- efetivo do sistema (já considerando promoção ativa) MAIS uma margem
-- percentual, pra compensar as taxas que o Mercado Livre cobra em cima da
-- venda. Padrão de 30%, mas editável pela própria tela de sincronização.
--
-- Guardado como coluna em `mercadolivre_conexao` (migração 021), não em
-- tabela nova: é um valor único por loja, mesma natureza de `ml_user_id`/
-- `access_token` que já moram nessa tabela. Este projeto não tem uma tabela
-- de configurações genérica — cada config vira coluna na tabela de domínio
-- já existente quando o valor é singleton (ver também `promocoes`, que por
-- ser uma LISTA de regras, não um escalar, ganhou tabela própria).
--
-- Seguro contra o upsert de refresh de token: trocarTokens() em
-- src/services/mercadolivreApi.ts faz upsert (onConflict: 'ml_user_id') só
-- com colunas de token — Postgres/PostgREST só atualiza (SET) as colunas
-- presentes no payload do upsert, então o refresh de token nunca reseta a
-- margem. O `not null default 30` garante que a primeira conexão (INSERT)
-- também não quebra por essa coluna estar ausente do payload.
-- =============================================================================

alter table mercadolivre_conexao
  add column margem_sincronizacao_percentual numeric(5,2) not null default 30
  check (margem_sincronizacao_percentual >= 0);

NOTIFY pgrst, 'reload schema';
