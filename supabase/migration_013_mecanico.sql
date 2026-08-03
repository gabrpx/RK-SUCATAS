-- =============================================================================
-- RK Sucatas — Migração 013: Cargo "mecanico"
-- =============================================================================
-- Rode isso no editor SQL do Supabase (projeto que já tem schema.sql +
-- migrations 002 a 012 aplicadas).
--
-- Novo cargo "mecanico" (Itinho): por enquanto tem exatamente o mesmo acesso
-- que "mandados" (Pitoco) — só vê a aba Tarefas, recebe e dá baixa nas
-- próprias (ver EXECUTORES_TAREFA em src/constants/roles.ts, usado tanto no
-- frontend quanto nas rotas do backend). Fica registrado como um papel
-- separado no banco pra poder divergir depois sem precisar migrar dado
-- nenhum — só ajustar EXECUTORES_TAREFA (ou dar um cargo próprio) quando
-- houver essa necessidade.
-- =============================================================================

alter table usuarios drop constraint if exists usuarios_role_check;
alter table usuarios add constraint usuarios_role_check
  check (role in ('admin', 'equipe', 'estoque_leitura', 'mandados', 'mecanico'));

NOTIFY pgrst, 'reload schema';
