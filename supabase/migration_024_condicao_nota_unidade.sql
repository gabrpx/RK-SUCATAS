-- =============================================================================
-- RK Sucatas — Migração 024: nota de condição por unidade
-- =============================================================================
-- Rode isso no editor SQL do Supabase (projeto que já tem schema.sql +
-- migrations 002 a 023 aplicadas — inclusive as migrations 022 e 023, que
-- ainda podem não ter rodado quando esta for aplicada).
--
-- `estoque.condicao_nota` (migration_017) avalia a peça inteira. Mas
-- `estoque_unidades` (migration_014) já existe pra registrar que UMA unidade
-- física é diferente das outras — e "diferente" nem sempre é avaria: uma
-- unidade pode estar em nota 10/10, perfeita, mas ser fisicamente outra peça
-- (veio de outra moto sucateada), e por isso merecer ficha própria mesmo sem
-- nenhum defeito.
--
-- Mesma semântica de herança que `estoque_unidades.valor` já usa: null =
-- essa unidade vale a nota da peça (estoque.condicao_nota); preenchido = essa
-- unidade tem nota própria, sobrepondo a da peça só pra ela.
--
-- Aproveitando: `avaria` nasceu `default true` (migration_014) porque, até
-- aqui, toda ficha existia POR CAUSA de uma avaria. Agora uma ficha pode
-- existir por outros motivos (nota própria, apelido, preço), então o normal
-- passa a ser "sem avaria". Isso só muda o default pra ficha nova que OMITE
-- o campo — fichas já gravadas não mudam, e o formulário do frontend sempre
-- manda o campo explicitamente, então não deve ter efeito observável na
-- prática (é sobretudo documentação de intenção, pra quem inserir via SQL
-- direto ou outra rota no futuro).
-- =============================================================================

alter table estoque_unidades add column condicao_nota smallint check (condicao_nota between 1 and 10);
alter table estoque_unidades alter column avaria set default false;

NOTIFY pgrst, 'reload schema';
