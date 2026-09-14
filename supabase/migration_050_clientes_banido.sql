-- migration_050_clientes_banido.sql
-- Adiciona flag de banimento a clientes. Diferente de `ativo` (que só
-- esconde da listagem padrão), `banido` impede novas vendas e orçamentos.

alter table clientes add column if not exists banido boolean not null default false;
