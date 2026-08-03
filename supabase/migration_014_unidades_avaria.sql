-- =============================================================================
-- RK Sucatas — Migração 014: unidades físicas com avaria
-- =============================================================================
-- Rode isso no editor SQL do Supabase (projeto que já tem schema.sql +
-- migrations 002 a 013 aplicadas).
--
-- Problema: a loja tem 5 TBI de 160. Um está sem o bico injetor, outro
-- amassado, os outros três perfeitos. Continuam sendo a MESMA peça — não
-- podem virar 5 linhas separadas no estoque —, mas cada unidade física
-- precisa poder ser vista, fotografada e até ter preço próprio.
--
-- Solução: `estoque_unidades` guarda uma ficha por unidade física que tem
-- algo diferente das outras. É criada sob demanda: peça com 5 unidades e 2
-- avariadas tem 2 fichas, não 5. As três normais não precisam de registro
-- nenhum.
--
-- Mesma ideia já usada em `estoque.unidades_incompletas` (migração 006), mas
-- resolvendo outra coisa e por isso em tabela separada:
--   unidades_incompletas → parte que foi VENDIDA avulsa (mexe em dinheiro e
--                          estoque, gerido pelas funções registrar_venda /
--                          cancelar_venda, nunca na mão)
--   estoque_unidades     → estado FÍSICO da unidade (amassada, faltando peça
--                          de fábrica, riscada). É descritivo, preenchido por
--                          quem cataloga, e não movimenta estoque.
--
-- `estoque.quantidade` continua sendo a única fonte da verdade sobre quantas
-- unidades existem. As fichas vivem "dentro" desse total, nunca somam a ele.
--
-- valor: null = a unidade vale o preço normal da peça (estoque.valor). Com
-- valor preenchido, aquela unidade específica passa a valer isso — é como o
-- TBI amassado sai mais barato sem bagunçar o preço das outras quatro.
--
-- fotos: array de URLs no Storage, separadas de `estoque.imagem_url`. A foto
-- do produto mostra a peça como ela deveria ser; estas mostram o defeito.
-- =============================================================================

create table estoque_unidades (
  id uuid primary key default gen_random_uuid(),
  estoque_id uuid not null references estoque(id) on delete cascade,
  -- Como a loja se refere a essa unidade específica ("A amassada", "Sem bico").
  apelido text,
  avaria boolean not null default true,
  avaria_descricao text,
  fotos jsonb not null default '[]'::jsonb,
  valor numeric(10,2) check (valor is null or valor >= 0),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- on delete cascade acima: ficha de unidade não faz sentido sem a peça. Difere
-- de tarefas/usuarios (migração 012), onde o histórico precisa sobreviver.
create index idx_estoque_unidades_estoque on estoque_unidades(estoque_id);

create trigger trg_estoque_unidades_atualizado_em
  before update on estoque_unidades
  for each row execute function set_atualizado_em();

alter table estoque_unidades enable row level security;
-- Sem policy nenhuma pra anon/authenticated de propósito — só o backend
-- (service_role) mexe nessa tabela, igual todo o resto do schema.

NOTIFY pgrst, 'reload schema';
