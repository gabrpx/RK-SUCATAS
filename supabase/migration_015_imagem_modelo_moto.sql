-- =============================================================================
-- RK Sucatas — Migração 015: foto por modelo de moto
-- =============================================================================
-- Rode isso no editor SQL do Supabase (projeto que já tem schema.sql +
-- migrations 002 a 014 aplicadas).
--
-- Cada modelo específico (nó-folha de modelos_moto — ver
-- src/features/motos/motoTree.ts) ganha uma foto própria, usada na
-- visualização "Por Moto" do Estoque (grade de cards com foto + contagem de
-- peças cadastradas para aquele modelo).
--
-- Upload feito manualmente na tela de gerenciamento de motos (Configurações >
-- Motos), reaproveitando o mesmo bucket/rota de upload já usados pelas peças
-- (mesmo padrão de estoque.imagem_url, migração 002).
-- =============================================================================

alter table modelos_moto add column imagem_url text;

NOTIFY pgrst, 'reload schema';
