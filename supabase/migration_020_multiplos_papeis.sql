-- =============================================================================
-- RK Sucatas — Migração 020: múltiplos papéis por usuário
-- =============================================================================
-- Rode isso no editor SQL do Supabase (projeto que já tem schema.sql +
-- migrations 002 a 019 aplicadas).
--
-- Problema: `usuarios.role` era uma coluna única — um funcionário só podia
-- ter UM papel. Pra cobrir "vê o Estoque E recebe Tarefas" não tinha como
-- escolher os dois (estoque_leitura não entra em Tarefas, mandados/mecanico
-- não entra em Estoque), então qualquer escolha deixava alguma coisa faltando.
--
-- Solução: troca `role text` por `roles text[]` — um usuário carrega
-- quantos papéis fizer sentido (ex: ['estoque_leitura', 'mandados']). Todo
-- lugar do backend/frontend que comparava `role === 'x'` passou a testar
-- `roles.includes('x')`/`roles.some(...)` (ver middleware/auth.ts,
-- src/server/routes/{usuarios,tarefas,categorias,modelosMoto}.ts e
-- src/App.tsx).
--
-- `<@` (contido em) garante que só os 5 papéis conhecidos entram no array;
-- `array_length(roles,1) > 0` garante que ninguém fica sem nenhum papel —
-- mesmo espírito do CHECK anterior, só que pra array em vez de string.
-- =============================================================================

alter table usuarios add column roles text[];

update usuarios set roles = array[role];

alter table usuarios alter column roles set not null;

alter table usuarios add constraint usuarios_roles_valido
  check (
    roles <@ array['admin', 'equipe', 'estoque_leitura', 'mandados', 'mecanico']::text[]
    and array_length(roles, 1) > 0
  );

alter table usuarios drop constraint usuarios_role_check;
alter table usuarios drop column role;

NOTIFY pgrst, 'reload schema';
