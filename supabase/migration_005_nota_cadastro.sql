-- =============================================================================
-- RK Sucatas — Migração 005: nota fiscal pra cadastro em peças de Motor
-- =============================================================================
-- Rode isso no editor SQL do Supabase (projeto que já tem schema.sql +
-- migrations 002/003/004 aplicadas). Peças na categoria "Motor" (ou qualquer
-- subcategoria dela) precisam informar se têm nota fiscal pra cadastro do
-- órgão de trânsito — a obrigatoriedade em si é validada na aplicação
-- (rota POST/PUT de estoque), não dá pra expressar "obrigatório só quando
-- categoria = Motor" numa check constraint simples sem trigger.
-- =============================================================================

alter table estoque add column nota_cadastro text check (nota_cadastro in ('com_nota', 'sem_nota'));

NOTIFY pgrst, 'reload schema';
