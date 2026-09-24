-- =============================================================================
-- RK Sucatas — Roteiro de validação da migration 069
--              (baixa automática de unidade em venda sem ficha, conferência,
--               edição atômica da unidade e registro de fotos enviadas)
-- =============================================================================
-- OBJETIVO
--   Provar, dentro do banco, que a 069 convive com as RPCs financeiras
--   VIGENTES registrar_venda (migration_059) e cancelar_venda (migration_038)
--   sem alterar nenhuma delas.
--
-- ONDE RODAR
--   Decisão do usuário (24/09/2026): rodar no banco de PRODUÇÃO, dentro de
--   `begin; … rollback;`. Nada fica gravado. Efeito colateral aceito: as
--   sequências avançam (o próximo código RK-xxxx e o próximo SKU pulam alguns
--   números), porque sequência no PostgreSQL não volta com rollback.
--
-- COMO LER O RESULTADO
--   Igual ao roteiro 067/068: NOTICE "PASS/FAIL" por cenário e, no final, o
--   SELECT ">>> CHECKLIST". No SQL Editor do Supabase, se aparecer só
--   "Success. No rows returned", selecione do início até o SELECT do
--   checklist, use "Run selected" e depois rode `rollback;` sozinho.
--   Aprovado = 0 FAIL.
-- =============================================================================

begin;

create temp table hml_resultado (
  ordem serial primary key,
  status text not null,
  cenario text not null,
  detalhe text
) on commit drop;
create temp table hml_ctx (chave text primary key, id uuid not null) on commit drop;

create function pg_temp.hml_registra(p_cenario text, p_ok boolean, p_detalhe text)
returns void language plpgsql as $$
begin
  insert into hml_resultado (status, cenario, detalhe)
    values (case when p_ok then 'PASS' else 'FAIL' end, p_cenario, p_detalhe);
  if p_ok then raise notice 'PASS: % — %', p_cenario, coalesce(p_detalhe, '');
  else raise notice 'FAIL: % — %', p_cenario, coalesce(p_detalhe, ''); end if;
end;
$$;

create function pg_temp.hml_erro_esperado(p_cenario text, p_erro text, p_padrao text)
returns void language plpgsql as $$
begin
  if p_erro is null then
    perform pg_temp.hml_registra(p_cenario, false, 'esperava erro parecido com "' || p_padrao || '", mas o comando foi aceito');
  elsif p_erro ilike p_padrao then
    perform pg_temp.hml_registra(p_cenario, true, 'bloqueado: ' || p_erro);
  else
    perform pg_temp.hml_registra(p_cenario, false, 'erro diferente do esperado: ' || p_erro);
  end if;
end;
$$;

create function pg_temp.hml_id(p_chave text) returns uuid language sql stable as $$
  select id from hml_ctx where chave = p_chave
$$;

-- Fichas livres (não vendidas, não arquivadas) de uma peça.
create function pg_temp.hml_livres(p_estoque uuid) returns int language sql stable as $$
  select count(*)::int from estoque_unidades where estoque_id = p_estoque and vendida_em is null and arquivada_em is null
$$;

-- -----------------------------------------------------------------------------
-- 1. Pré-requisitos
-- -----------------------------------------------------------------------------
do $$
declare v_falta text := '';
begin
  if to_regclass('public.estoque_unidade_eventos') is null then v_falta := v_falta || ' [068]'; end if;
  if to_regclass('public.estoque_baixas_automaticas') is null then v_falta := v_falta || ' [069: estoque_baixas_automaticas]'; end if;
  if to_regclass('public.estoque_fotos_enviadas') is null then v_falta := v_falta || ' [069: estoque_fotos_enviadas]'; end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_baixar_unidades_venda_sem_ficha') then v_falta := v_falta || ' [069: trigger de baixa]'; end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_desfazer_baixa_automatica_venda') then v_falta := v_falta || ' [069: trigger de cancelamento]'; end if;
  if v_falta <> '' then raise exception 'Pré-requisito ausente:%', v_falta; end if;
  perform pg_temp.hml_registra('P1 Migration 069 presente', true, 'tabelas e triggers encontrados');
end $$;

do $$
declare v_ok boolean := true; v_det text := ''; r record;
begin
  for r in select * from (values
      ('conferir_baixa_automatica(uuid,uuid,uuid,text)'),
      ('baixar_ficha_excedente(uuid,uuid,text)'),
      ('editar_unidade_estoque(uuid,jsonb,uuid,text)')) v(assinatura) loop
    if not has_function_privilege('service_role', r.assinatura, 'execute')
       or has_function_privilege('anon', r.assinatura, 'execute')
       or has_function_privilege('authenticated', r.assinatura, 'execute') then
      v_ok := false; v_det := v_det || ' ' || r.assinatura;
    end if;
  end loop;
  for r in select t.tabela, g.papel from
      unnest(array['public.estoque_baixas_automaticas', 'public.estoque_fotos_enviadas']) t(tabela),
      unnest(array['anon', 'authenticated']) g(papel) loop
    if has_table_privilege(r.papel, r.tabela, 'select, insert, update, delete') then
      v_ok := false; v_det := v_det || ' ' || r.tabela || ' acessível a ' || r.papel;
    end if;
  end loop;
  perform pg_temp.hml_registra('P2 Permissões (só service_role)', v_ok,
    case when v_ok then 'service_role executa; anon/authenticated não' else 'revisar:' || v_det end);
end $$;

do $$
declare v_det text; v_ok boolean;
begin
  select string_agg(n || '=' || c, ', ' order by n), bool_and(c = 1) into v_det, v_ok
  from (select f.n, (select count(*) from pg_proc p join pg_namespace s on s.oid = p.pronamespace
                     where s.nspname = 'public' and p.proname = f.n) as c
        from unnest(array['cancelar_venda', 'conferir_baixa_automatica', 'baixar_ficha_excedente', 'editar_unidade_estoque']) f(n)) t;
  v_ok := v_ok and to_regprocedure('public.registrar_venda(uuid,integer,numeric,uuid,uuid,text,text,date,text,uuid,uuid,text,numeric)') is not null;
  v_det := v_det || ', registrar_venda tem assinatura vigente de 13 args; o payload inclui p_valor_recebido para desambiguar os overloads legados';
  perform pg_temp.hml_registra('P3 Funções vigentes e assinatura de venda identificada', v_ok, v_det);
end $$;

-- -----------------------------------------------------------------------------
-- 2. Fixtures
--    F1: R$ 100,00, 3 unidades (A mais antiga e RESERVADA, B, C).
--    F2: R$ 80,00, 3 unidades (para venda de 2 de uma vez).
--    F3: R$ 60,00, 2 fichas mas quantidade 3 (divergência antiga).
--    F4: R$ 90,00, 2 unidades, componente "tampa".
--    F5: R$ 70,00, 1 unidade (edição atômica).
--    F6: R$ 40,00, 3 fichas mas quantidade 2 (sobra de venda antiga).
-- -----------------------------------------------------------------------------
do $$
declare
  v_sfx text := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
  v_cat uuid; v_fav uuid; v_la uuid; v_li uuid; v_e uuid; v_u uuid; i int;
begin
  insert into categorias (nome) values ('HML 069 ' || v_sfx) returning id into v_cat;
  insert into formas_pagamento (nome, natureza) values ('HML 069 À VISTA ' || v_sfx, 'avista') returning id into v_fav;
  insert into estoque_locais (codigo, deposito, zona, prateleira, secao)
    values ('HML69-' || v_sfx || '-A', 'Homologação ' || v_sfx, 'HML', 'P1', 'S1') returning id into v_la;
  insert into estoque_locais (codigo, deposito, zona, prateleira, secao, ativo)
    values ('HML69-' || v_sfx || '-X', 'Homologação ' || v_sfx, 'HML', 'P1', 'S9', false) returning id into v_li;
  insert into hml_ctx values ('forma', v_fav), ('local_ativo', v_la), ('local_inativo', v_li);

  insert into estoque (nome, categoria_id, condicao, valor, quantidade)
    values ('HML69 F1 ' || v_sfx, v_cat, 'paralela', 100, 0) returning id into v_e;
  insert into hml_ctx values ('f1', v_e);
  for i in 1..3 loop
    select id into v_u from adicionar_unidade_estoque(v_e, '{}'::jsonb);
    update estoque_unidades set criado_em = now() - make_interval(days => 10 - i) where id = v_u;
    insert into hml_ctx values ('f1_' || chr(64 + i), v_u);
  end loop;
  perform reservar_unidade_estoque(p_unidade_id => pg_temp.hml_id('f1_A'), p_responsavel => 'Fixture 069',
    p_ate => now() + interval '3 days', p_valor_sinal => 20, p_forma_pagamento_id => v_fav);

  insert into estoque (nome, categoria_id, condicao, valor, quantidade)
    values ('HML69 F2 ' || v_sfx, v_cat, 'paralela', 80, 0) returning id into v_e;
  insert into hml_ctx values ('f2', v_e);
  for i in 1..3 loop
    select id into v_u from adicionar_unidade_estoque(v_e, '{}'::jsonb);
    update estoque_unidades set criado_em = now() - make_interval(days => 10 - i) where id = v_u;
    insert into hml_ctx values ('f2_' || chr(64 + i), v_u);
  end loop;

  insert into estoque (nome, categoria_id, condicao, valor, quantidade)
    values ('HML69 F3 ' || v_sfx, v_cat, 'paralela', 60, 0) returning id into v_e;
  insert into hml_ctx values ('f3', v_e);
  perform adicionar_unidade_estoque(v_e, '{}'::jsonb);
  perform adicionar_unidade_estoque(v_e, '{}'::jsonb);
  update estoque set quantidade = 3 where id = v_e;

  insert into estoque (nome, categoria_id, condicao, valor, quantidade, componentes)
    values ('HML69 F4 ' || v_sfx, v_cat, 'paralela', 90, 0, '["tampa", "base"]'::jsonb) returning id into v_e;
  insert into hml_ctx values ('f4', v_e);
  perform adicionar_unidade_estoque(v_e, '{}'::jsonb);
  perform adicionar_unidade_estoque(v_e, '{}'::jsonb);

  insert into estoque (nome, categoria_id, condicao, valor, quantidade)
    values ('HML69 F5 ' || v_sfx, v_cat, 'paralela', 70, 0) returning id into v_e;
  insert into hml_ctx values ('f5', v_e);
  select id into v_u from adicionar_unidade_estoque(v_e, jsonb_build_object('valor', 70, 'condicao_nota', 6));
  insert into hml_ctx values ('f5_A', v_u);

  insert into estoque (nome, categoria_id, condicao, valor, quantidade)
    values ('HML69 F6 ' || v_sfx, v_cat, 'paralela', 40, 0) returning id into v_e;
  insert into hml_ctx values ('f6', v_e);
  for i in 1..3 loop
    select id into v_u from adicionar_unidade_estoque(v_e, '{}'::jsonb);
    insert into hml_ctx values ('f6_' || chr(64 + i), v_u);
  end loop;
  update estoque set quantidade = 2 where id = v_e;

  perform pg_temp.hml_registra('F0 Fixtures criadas', true, 'sufixo ' || v_sfx);
end $$;

-- -----------------------------------------------------------------------------
-- 3. Baixa automática
-- -----------------------------------------------------------------------------
-- B1: venda sem unidade baixa a mais antiga NÃO reservada (B), não a A.
do $$
declare v_venda vendas; v_baixa estoque_baixas_automaticas; v_ok boolean;
begin
  select * into v_venda from registrar_venda(p_estoque_id => pg_temp.hml_id('f1'), p_quantidade => 1,
    p_valor_unitario => 100, p_forma_pagamento_id => pg_temp.hml_id('forma'), p_valor_recebido => null);
  insert into hml_ctx values ('venda_b1', v_venda.id);
  select * into v_baixa from estoque_baixas_automaticas where venda_id = v_venda.id;
  v_ok := v_baixa.unidade_id = pg_temp.hml_id('f1_B') and v_baixa.conferida_em is null
    and (select vendida_em is not null from estoque_unidades where id = pg_temp.hml_id('f1_B'))
    and (select vendida_em is null from estoque_unidades where id = pg_temp.hml_id('f1_A'))
    and (select quantidade from estoque where id = pg_temp.hml_id('f1')) = 2
    and pg_temp.hml_livres(pg_temp.hml_id('f1')) = 2;
  perform pg_temp.hml_registra('B1 Venda sem unidade baixa a mais antiga livre (pula reservada)', coalesce(v_ok, false),
    'quantidade=' || (select quantidade from estoque where id = pg_temp.hml_id('f1')) || ', fichas livres=' || pg_temp.hml_livres(pg_temp.hml_id('f1')));
  perform pg_temp.hml_registra('B1b Evento baixa_automatica na linha do tempo',
    exists (select 1 from estoque_unidade_eventos where unidade_id = pg_temp.hml_id('f1_B') and tipo = 'baixa_automatica'), null);
end $$;

-- B2: cancelar a venda devolve a MESMA unidade e apaga a pendência.
do $$
declare v_ok boolean;
begin
  perform cancelar_venda(pg_temp.hml_id('venda_b1'));
  v_ok := (select vendida_em is null from estoque_unidades where id = pg_temp.hml_id('f1_B'))
    and not exists (select 1 from estoque_baixas_automaticas where venda_id = pg_temp.hml_id('venda_b1'))
    and (select quantidade from estoque where id = pg_temp.hml_id('f1')) = 3
    and pg_temp.hml_livres(pg_temp.hml_id('f1')) = 3
    and exists (select 1 from estoque_unidade_eventos where unidade_id = pg_temp.hml_id('f1_B') and tipo = 'baixa_desfeita');
  perform pg_temp.hml_registra('B2 Cancelar devolve a unidade baixada', coalesce(v_ok, false),
    'quantidade=' || (select quantidade from estoque where id = pg_temp.hml_id('f1')) || ', fichas livres=' || pg_temp.hml_livres(pg_temp.hml_id('f1')));
end $$;

-- B3: venda COM unidade não cria baixa automática.
do $$
declare v_venda vendas;
begin
  select * into v_venda from registrar_venda(p_estoque_id => pg_temp.hml_id('f1'), p_quantidade => 1,
    p_valor_unitario => 100, p_forma_pagamento_id => pg_temp.hml_id('forma'), p_valor_recebido => null, p_unidade_id => pg_temp.hml_id('f1_C'));
  perform pg_temp.hml_registra('B3 Venda com unidade escolhida não gera baixa automática',
    not exists (select 1 from estoque_baixas_automaticas where venda_id = v_venda.id)
    and pg_temp.hml_livres(pg_temp.hml_id('f1')) = 2, null);
  perform cancelar_venda(v_venda.id);
end $$;

-- B4: venda de 2 de uma vez baixa as 2 mais antigas.
do $$
declare v_venda vendas; v_qtd int;
begin
  select * into v_venda from registrar_venda(p_estoque_id => pg_temp.hml_id('f2'), p_quantidade => 2,
    p_valor_unitario => 80, p_forma_pagamento_id => pg_temp.hml_id('forma'), p_valor_recebido => null);
  insert into hml_ctx values ('venda_b4', v_venda.id);
  select count(*) into v_qtd from estoque_baixas_automaticas where venda_id = v_venda.id
    and unidade_id in (pg_temp.hml_id('f2_A'), pg_temp.hml_id('f2_B'));
  perform pg_temp.hml_registra('B4 Venda de 2 unidades baixa as 2 mais antigas', v_qtd = 2
    and pg_temp.hml_livres(pg_temp.hml_id('f2')) = 1, v_qtd || ' baixa(s)');
end $$;

-- B5: divergência antiga (fichas < quantidade) não é agravada.
do $$
declare v_venda vendas;
begin
  select * into v_venda from registrar_venda(p_estoque_id => pg_temp.hml_id('f3'), p_quantidade => 1,
    p_valor_unitario => 60, p_forma_pagamento_id => pg_temp.hml_id('forma'), p_valor_recebido => null);
  perform pg_temp.hml_registra('B5 Fichas abaixo da quantidade: nada é baixado',
    not exists (select 1 from estoque_baixas_automaticas where venda_id = v_venda.id)
    and pg_temp.hml_livres(pg_temp.hml_id('f3')) = 2, 'quantidade agora ' || (select quantidade from estoque where id = pg_temp.hml_id('f3')));
end $$;

-- B6: venda de componente não tira a unidade inteira.
do $$
declare v_venda vendas;
begin
  select * into v_venda from registrar_venda(p_estoque_id => pg_temp.hml_id('f4'), p_quantidade => 1,
    p_valor_unitario => 30, p_forma_pagamento_id => pg_temp.hml_id('forma'), p_valor_recebido => null, p_componente => 'tampa');
  perform pg_temp.hml_registra('B6 Venda de componente não baixa ficha',
    not exists (select 1 from estoque_baixas_automaticas where venda_id = v_venda.id)
    and pg_temp.hml_livres(pg_temp.hml_id('f4')) = 2, null);
end $$;

-- B7: venda sem unidade com a única livre reservada continua barrada pela 066.
do $$
declare v_erro text;
begin
  begin
    perform registrar_venda(p_estoque_id => pg_temp.hml_id('f1'), p_quantidade => 3,
      p_valor_unitario => 100, p_forma_pagamento_id => pg_temp.hml_id('forma'), p_valor_recebido => null);
  exception when others then v_erro := sqlerrm;
  end;
  perform pg_temp.hml_erro_esperado('B7 Venda que consumiria a reservada é barrada', v_erro, '%reserv%');
end $$;

-- -----------------------------------------------------------------------------
-- 4. Conferência
-- -----------------------------------------------------------------------------
do $$
declare v_baixa estoque_baixas_automaticas; v_erro text;
begin
  select * into v_baixa from estoque_baixas_automaticas
    where venda_id = pg_temp.hml_id('venda_b4') and unidade_id = pg_temp.hml_id('f2_A');
  select * into v_baixa from conferir_baixa_automatica(p_baixa_id => v_baixa.id,
    p_usuario_id => null, p_usuario_nome => 'Homologação');
  perform pg_temp.hml_registra('C1 Confirmar a unidade escolhida', v_baixa.conferida_em is not null
    and v_baixa.conferida_por_nome = 'Homologação'
    and exists (select 1 from estoque_unidade_eventos where unidade_id = pg_temp.hml_id('f2_A')
      and tipo = 'baixa_conferida' and usuario_nome = 'Homologação'), null);
  begin
    perform conferir_baixa_automatica(p_baixa_id => v_baixa.id);
  exception when others then v_erro := sqlerrm;
  end;
  perform pg_temp.hml_erro_esperado('C2 Conferir duas vezes é bloqueado', v_erro, '%já foi conferida%');
end $$;

-- C3: trocar pela unidade que realmente saiu (B → C).
do $$
declare v_baixa estoque_baixas_automaticas; v_data timestamptz; v_ok boolean;
begin
  select * into v_baixa from estoque_baixas_automaticas
    where venda_id = pg_temp.hml_id('venda_b4') and unidade_id = pg_temp.hml_id('f2_B');
  insert into hml_ctx values ('baixa_c3', v_baixa.id);
  select vendida_em into v_data from estoque_unidades where id = pg_temp.hml_id('f2_B');
  select * into v_baixa from conferir_baixa_automatica(p_baixa_id => v_baixa.id,
    p_unidade_correta_id => pg_temp.hml_id('f2_C'), p_usuario_nome => 'Homologação');
  v_ok := v_baixa.unidade_id = pg_temp.hml_id('f2_C') and v_baixa.conferida_em is not null
    and (select vendida_em is null from estoque_unidades where id = pg_temp.hml_id('f2_B'))
    and (select vendida_em = v_data from estoque_unidades where id = pg_temp.hml_id('f2_C'))
    and pg_temp.hml_livres(pg_temp.hml_id('f2')) = 1
    and (select count(*) from estoque_unidade_eventos where tipo = 'baixa_corrigida'
         and unidade_id in (pg_temp.hml_id('f2_B'), pg_temp.hml_id('f2_C'))) = 2;
  perform pg_temp.hml_registra('C3 Trocar pela unidade que saiu (mantém a data da venda)', coalesce(v_ok, false), null);
end $$;

-- C4/C5: troca inválida.
do $$
declare v_id uuid; v_erro text;
begin
  -- Nova pendência em F1 (baixa a B), para tentar trocas inválidas.
  perform registrar_venda(p_estoque_id => pg_temp.hml_id('f1'), p_quantidade => 1,
    p_valor_unitario => 100, p_forma_pagamento_id => pg_temp.hml_id('forma'), p_valor_recebido => null);
  select id into v_id from estoque_baixas_automaticas where estoque_id = pg_temp.hml_id('f1') and conferida_em is null;
  begin
    perform conferir_baixa_automatica(p_baixa_id => v_id, p_unidade_correta_id => pg_temp.hml_id('f2_B'));
  exception when others then v_erro := sqlerrm;
  end;
  perform pg_temp.hml_erro_esperado('C4 Trocar por unidade de outra peça é bloqueado', v_erro, '%outra peça%');
  v_erro := null;
  begin
    perform conferir_baixa_automatica(p_baixa_id => v_id, p_unidade_correta_id => pg_temp.hml_id('f1_A'));
  exception when others then v_erro := sqlerrm;
  end;
  perform pg_temp.hml_erro_esperado('C5 Trocar por unidade reservada é bloqueado', v_erro, '%reserv%');
  perform pg_temp.hml_registra('C5b Troca recusada não altera nada',
    (select conferida_em is null and unidade_id = pg_temp.hml_id('f1_B') from estoque_baixas_automaticas where id = v_id)
    and (select vendida_em is not null from estoque_unidades where id = pg_temp.hml_id('f1_B')), null);
end $$;

-- C6: cancelar depois da troca devolve a unidade corrigida.
do $$
begin
  perform cancelar_venda(pg_temp.hml_id('venda_b4'));
  perform pg_temp.hml_registra('C6 Cancelar depois da troca devolve as unidades certas',
    pg_temp.hml_livres(pg_temp.hml_id('f2')) = 3 and (select quantidade from estoque where id = pg_temp.hml_id('f2')) = 3,
    'fichas livres=' || pg_temp.hml_livres(pg_temp.hml_id('f2')));
end $$;

-- C7/C8: ficha sobrando de venda antiga.
do $$
declare v_erro text; v_ok boolean;
begin
  perform baixar_ficha_excedente(pg_temp.hml_id('f6_B'), null, 'Homologação');
  v_ok := (select vendida_em is not null from estoque_unidades where id = pg_temp.hml_id('f6_B'))
    and (select quantidade from estoque where id = pg_temp.hml_id('f6')) = 2
    and pg_temp.hml_livres(pg_temp.hml_id('f6')) = 2
    and exists (select 1 from estoque_unidade_eventos where unidade_id = pg_temp.hml_id('f6_B') and tipo = 'baixa_excedente' and usuario_nome = 'Homologação');
  perform pg_temp.hml_registra('C7 Ficha sobrando é baixada sem mexer na quantidade', coalesce(v_ok, false), null);
  begin
    perform baixar_ficha_excedente(pg_temp.hml_id('f6_C'));
  exception when others then v_erro := sqlerrm;
  end;
  perform pg_temp.hml_erro_esperado('C8 Sem sobra, a baixa de ficha é bloqueada', v_erro, '%não tem fichas sobrando%');
end $$;

-- C9: venda de componente esgota a unidade (sobra), a equipe aponta a ficha
--     e depois a venda é cancelada: a ficha apontada volta.
do $$
declare v_v1 vendas; v_v2 vendas; v_ok boolean;
begin
  -- F4 tem componentes tampa/base e 2 fichas; B6 já vendeu uma tampa.
  select * into v_v1 from registrar_venda(p_estoque_id => pg_temp.hml_id('f4'), p_quantidade => 1,
    p_valor_unitario => 30, p_forma_pagamento_id => pg_temp.hml_id('forma'), p_valor_recebido => null, p_componente => 'base');
  v_ok := (select quantidade from estoque where id = pg_temp.hml_id('f4')) = 1 and pg_temp.hml_livres(pg_temp.hml_id('f4')) = 2;
  perform pg_temp.hml_registra('C9a Componente que esgota a unidade deixa ficha sobrando (conferência)', coalesce(v_ok, false), null);
  perform baixar_ficha_excedente((select id from estoque_unidades where estoque_id = pg_temp.hml_id('f4') order by criado_em limit 1));
  perform cancelar_venda(v_v1.id);
  v_ok := (select quantidade from estoque where id = pg_temp.hml_id('f4')) = 2 and pg_temp.hml_livres(pg_temp.hml_id('f4')) = 2;
  perform pg_temp.hml_registra('C9b Cancelar a venda devolve a ficha apontada como saída', coalesce(v_ok, false),
    'quantidade=' || (select quantidade from estoque where id = pg_temp.hml_id('f4')) || ', fichas livres=' || pg_temp.hml_livres(pg_temp.hml_id('f4')));
end $$;

-- -----------------------------------------------------------------------------
-- 5. Edição atômica
-- -----------------------------------------------------------------------------
do $$
declare v_u estoque_unidades; v_ok boolean;
begin
  select * into v_u from editar_unidade_estoque(pg_temp.hml_id('f5_A'), jsonb_build_object(
    'valor', 85.5, 'condicao_nota', 9, 'endereco_id', pg_temp.hml_id('local_ativo'),
    'origem_identificacao', 'Moto doadora HML', 'fotos', '["https://exemplo.invalid/hml.jpg"]'::jsonb),
    null, 'Homologação');
  v_ok := v_u.valor = 85.5 and v_u.condicao_nota = 9 and v_u.endereco_id = pg_temp.hml_id('local_ativo')
    and v_u.origem_identificacao = 'Moto doadora HML' and jsonb_array_length(v_u.fotos) = 1 and v_u.organizada_em is not null;
  perform pg_temp.hml_registra('D1 Edição grava tudo junto', coalesce(v_ok, false), null);
  perform pg_temp.hml_registra('D1b Eventos com autor (editada + endereço)',
    exists (select 1 from estoque_unidade_eventos where unidade_id = v_u.id and tipo = 'editada' and usuario_nome = 'Homologação')
    and exists (select 1 from estoque_unidade_eventos where unidade_id = v_u.id and tipo = 'endereco_alterado' and usuario_nome = 'Homologação'), null);
end $$;

do $$
declare v_erro text;
begin
  begin
    perform editar_unidade_estoque(pg_temp.hml_id('f5_A'), jsonb_build_object('valor', 99, 'endereco_id', pg_temp.hml_id('local_inativo')));
  exception when others then v_erro := sqlerrm;
  end;
  perform pg_temp.hml_erro_esperado('D2 Local inativo bloqueia a edição', v_erro, '%inativo%');
  perform pg_temp.hml_registra('D2b Nada muda quando a edição falha',
    (select valor = 85.5 from estoque_unidades where id = pg_temp.hml_id('f5_A')), null);
  v_erro := null;
  begin
    perform editar_unidade_estoque(pg_temp.hml_id('f5_A'), jsonb_build_object('valor', 0));
  exception when others then v_erro := sqlerrm;
  end;
  perform pg_temp.hml_erro_esperado('D3 Preço zero é bloqueado', v_erro, '%maior que zero%');
  v_erro := null;
  begin
    perform editar_unidade_estoque(pg_temp.hml_id('f5_A'), jsonb_build_object('condicao_nota', 11));
  exception when others then v_erro := sqlerrm;
  end;
  perform pg_temp.hml_erro_esperado('D4 Nota fora de 1–10 é bloqueada', v_erro, '%entre 1 e 10%');
end $$;

do $$
declare v_erro text;
begin
  perform registrar_venda(p_estoque_id => pg_temp.hml_id('f5'), p_quantidade => 1, p_valor_unitario => 85.5,
    p_forma_pagamento_id => pg_temp.hml_id('forma'), p_valor_recebido => null, p_unidade_id => pg_temp.hml_id('f5_A'));
  begin
    perform editar_unidade_estoque(pg_temp.hml_id('f5_A'), jsonb_build_object('valor', 90));
  exception when others then v_erro := sqlerrm;
  end;
  perform pg_temp.hml_erro_esperado('D5 Unidade vendida não pode ser editada', v_erro, '%vendida ou arquivada%');
end $$;

do $$
declare v_erro text; v_id uuid;
begin
  -- Venda cancelada: conferir a baixa dela não pode dar erro técnico.
  select b.id into v_id from estoque_baixas_automaticas b join vendas v on v.id = b.venda_id
    where b.estoque_id = pg_temp.hml_id('f1') and b.conferida_em is null limit 1;
  perform cancelar_venda((select venda_id from estoque_baixas_automaticas where id = v_id));
  begin
    perform conferir_baixa_automatica(v_id);
  exception when others then v_erro := sqlerrm;
  end;
  perform pg_temp.hml_erro_esperado('C10 Conferir baixa de venda cancelada tem mensagem clara', v_erro, '%não encontrada%');
end $$;

-- -----------------------------------------------------------------------------
-- 6. Registro de fotos
-- -----------------------------------------------------------------------------
do $$
begin
  insert into estoque_fotos_enviadas (url, usuario_id) values ('https://exemplo.invalid/hml-069.jpg', 'hml');
  perform pg_temp.hml_registra('E1 Registro de foto enviada grava',
    exists (select 1 from estoque_fotos_enviadas where url = 'https://exemplo.invalid/hml-069.jpg' and enviada_em is not null), null);
  -- D1 gravou https://exemplo.invalid/hml.jpg nas fotos da unidade de F5.
  perform pg_temp.hml_registra('E2 Foto usada numa unidade é reconhecida', foto_estoque_em_uso('https://exemplo.invalid/hml.jpg'), null);
  perform pg_temp.hml_registra('E3 Foto não usada pode ser limpa', not foto_estoque_em_uso('https://exemplo.invalid/hml-069.jpg'), null);
end $$;

-- -----------------------------------------------------------------------------
-- Resumo
-- -----------------------------------------------------------------------------
do $$
declare v_pass int; v_fail int;
begin
  select count(*) filter (where status = 'PASS'), count(*) filter (where status = 'FAIL')
    into v_pass, v_fail from hml_resultado;
  raise notice '==== RESULTADO: % PASS, % FAIL — % ====', v_pass, v_fail,
    case when v_fail = 0 then 'VALIDAÇÃO APROVADA' else 'REVISAR OS FAIL ACIMA' end;
end $$;

-- >>> CHECKLIST (uma linha por cenário; a última linha é o resumo)
select status, cenario, detalhe from (
  select ordem, status, cenario, detalhe from hml_resultado
  union all
  select 1000000,
    case when count(*) filter (where status = 'FAIL') = 0 then 'OK' else 'REVISAR' end,
    'RESUMO',
    count(*) filter (where status = 'PASS') || ' PASS, ' || count(*) filter (where status = 'FAIL') || ' FAIL'
  from hml_resultado
) t order by ordem;

rollback;
