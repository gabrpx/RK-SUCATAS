-- =============================================================================
-- RK Sucatas — Migração 047: permissões granulares por tela/ação
-- =============================================================================
-- Rode isso no editor SQL do Supabase (projeto com schema.sql + migrations
-- 002 a 046 aplicadas). NÃO é destrutiva: só ADICIONA a coluna `permissoes` e
-- faz o backfill; a coluna `roles` continua existindo — passa a servir
-- principalmente como marcador de `admin` (super-usuário) e como base da
-- proteção do último admin ativo (ver src/server/routes/usuarios.ts).
--
-- Substitui o controle de acesso por CARGO por permissões finas por usuário:
--   usuarios.permissoes jsonb  =>  { "<tela>": { "<acao>": boolean } }
-- Ex: { "estoque": { "ver": true, "criar": true, "deletar": false }, ... }
--
-- O backfill abaixo é a equivalência 1:1 com o que cada cargo vê/faz hoje
-- (mesmo mapa de src/constants/permissoes.ts > permissoesDeRoles, coberto por
-- permissoes.test.ts) — ninguém perde nem ganha acesso no deploy. `equipe` é
-- derivada do próprio catálogo (tudo menos as 2 ações que hoje são exclusivas
-- de admin), pra não correr risco de a lista divergir da do TypeScript.
-- =============================================================================

alter table usuarios add column if not exists permissoes jsonb not null default '{}'::jsonb;

-- Backfill: converte roles -> permissoes (união quando há mais de um cargo).
with catalogo(chave) as (
  values
    ('dashboard.ver'), ('dashboard.ver_valores'), ('dashboard.ver_visao_dono'),
    ('estoque.ver'), ('estoque.criar'), ('estoque.editar'), ('estoque.deletar'),
      ('estoque.anunciar_ml'), ('estoque.anunciar_shopee'),
    ('frete.ver'), ('frete.criar'), ('frete.editar'), ('frete.deletar'),
    ('mercadolivre.ver'), ('mercadolivre.conectar'), ('mercadolivre.sincronizar'),
      ('mercadolivre.importar_pedidos'), ('mercadolivre.responder_perguntas'), ('mercadolivre.pausar_anuncio'),
    ('vendas.ver'), ('vendas.criar'), ('vendas.editar'), ('vendas.cancelar'),
      ('vendas.cancelar_fiado'), ('vendas.excluir_comprovante'),
    ('orcamentos.ver'), ('orcamentos.criar'), ('orcamentos.editar'), ('orcamentos.vender'),
      ('orcamentos.cancelar'), ('orcamentos.excluir'),
    ('clientes.ver'), ('clientes.criar'), ('clientes.editar'),
    ('caixa.ver'), ('caixa.criar'), ('caixa.editar'), ('caixa.excluir'),
      ('caixa.receber_fiado'), ('caixa.gerenciar_pendencias'),
    ('tarefas.ver'), ('tarefas.criar'), ('tarefas.editar'), ('tarefas.excluir'), ('tarefas.concluir'),
    ('configuracoes.ver'), ('configuracoes.gerenciar_categorias'), ('configuracoes.gerenciar_motos'),
      ('configuracoes.gerenciar_pagamento'), ('configuracoes.gerenciar_promocoes'),
    ('patchnotes.ver'),
    ('notificacoes.ver')
),
-- Ações que hoje são exclusivas de admin mesmo dentro de rotas admin+equipe
-- (ver vendas.ts): equipe NÃO as recebe no backfill (mas o dono pode conceder
-- individualmente depois — é o ganho do novo sistema).
sem_equipe(chave) as (
  values ('vendas.cancelar_fiado'), ('vendas.excluir_comprovante'), ('dashboard.ver_visao_dono')
),
role_chaves(role, chave) as (
  -- admin: catálogo inteiro (na prática ignorado — o backend trata admin como
  -- super-usuário — mas preenchido por consistência).
  select 'admin', chave from catalogo
  union all
  -- equipe: tudo menos as ações admin-only.
  select 'equipe', chave from catalogo where chave not in (select chave from sem_equipe)
  union all
  -- estoque_leitura (Eloisa): só consulta o estoque + changelog + notificações.
  select 'estoque_leitura', c from unnest(array['estoque.ver', 'patchnotes.ver', 'notificacoes.ver']) c
  union all
  -- mandados (Pitoco) e mecanico (Itinho): tarefa + baixa nas próprias + changelog + notificações.
  select 'mandados', c from unnest(array['tarefas.ver', 'tarefas.concluir', 'patchnotes.ver', 'notificacoes.ver']) c
  union all
  select 'mecanico', c from unnest(array['tarefas.ver', 'tarefas.concluir', 'patchnotes.ver', 'notificacoes.ver']) c
),
-- União (distinct) das chaves de todos os cargos de cada usuário.
user_chaves as (
  select u.id, rc.chave
  from usuarios u
  cross join lateral unnest(u.roles) as r(role)
  join role_chaves rc on rc.role = r.role
  group by u.id, rc.chave
),
-- Agrupa por tela -> { acao: true }.
user_tela as (
  select id, split_part(chave, '.', 1) as tela, jsonb_object_agg(split_part(chave, '.', 2), true) as acoes
  from user_chaves
  group by id, split_part(chave, '.', 1)
),
-- Agrupa por usuário -> { tela: { acao: true } }.
user_perm as (
  select id, jsonb_object_agg(tela, acoes) as permissoes
  from user_tela
  group by id
)
update usuarios u
set permissoes = up.permissoes
from user_perm up
where up.id = u.id;

NOTIFY pgrst, 'reload schema';
