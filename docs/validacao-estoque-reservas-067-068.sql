-- =============================================================================
-- RK Sucatas — Roteiro de homologação das migrations 067 e 068
--              (reservas com sinal obrigatório, autoria, arquivamento e
--               histórico de eventos da unidade física)
-- =============================================================================
-- OBJETIVO
--   Provar, dentro do banco, que as regras novas funcionam e que convivem com
--   as RPCs financeiras VIGENTES registrar_venda (migration_059) e
--   cancelar_venda (migration_038), sem alterar nenhuma delas.
--
-- PRÉ-REQUISITOS
--   * schema.sql + migrations até a 066 aplicadas, e em seguida a 067 e a 068.
--   * Onde rodar: decisão do usuário (24/09/2026) — no banco de PRODUÇÃO,
--     porque não há projeto de homologação. Tudo termina em rollback; o único
--     efeito que fica é o avanço das SEQUÊNCIAS (o próximo código RK-xxxx e o
--     próximo SKU pulam alguns números), porque sequência no PostgreSQL não
--     volta atrás com rollback.
--   * Usuário do SQL Editor (postgres), dono das tabelas e funções.
--
-- NADA É GRAVADO
--   Tudo roda dentro de `begin; … rollback;`. As fixtures (categoria, peças,
--   unidades, formas de pagamento, clientes, endereços, reservas, vendas e
--   lançamentos de caixa) são criadas aqui dentro e desfeitas no final.
--   Se o script parar no meio por qualquer erro, a transação também não é
--   confirmada (não existe `commit` neste arquivo). Se o editor deixar a
--   sessão com transação aberta após um erro, rode `rollback;` sozinho.
--
-- COMO LER O RESULTADO
--   * Cada cenário imprime uma mensagem NOTICE "PASS: <cenário> — <detalhe>"
--     ou "FAIL: <cenário> — <detalhe>" (aba Mensagens/Output do psql,
--     DBeaver, pgAdmin etc.).
--   * O penúltimo comando é um SELECT com o checklist completo (uma linha por
--     cenário, colunas status/cenário/detalhe) e o resumo PASS/FAIL.
--     O SQL Editor do Supabase normalmente mostra só o resultado do ÚLTIMO
--     comando: se aparecer apenas "Success. No rows returned", selecione o
--     texto do início do arquivo até o SELECT do checklist (marcado com
--     ">>> CHECKLIST") e use "Run selected"; depois execute `rollback;`
--     sozinho para encerrar a transação.
--   * Homologação aprovada = 0 FAIL. Em cenários de erro esperado, o detalhe
--     do PASS mostra a mensagem real devolvida pelo banco (é o texto que a
--     equipe verá na tela).
--
-- ASSINATURAS USADAS (as vigentes; não inventar parâmetros)
--   registrar_venda(p_estoque_id, p_quantidade, p_valor_unitario,
--     p_forma_pagamento_id, p_modelo_moto_id, p_cliente_nome, p_observacoes,
--     p_data, p_componente, p_cliente_id, p_unidade_id, p_nome_item,
--     p_valor_recebido)                                   -- migration_059
--   cancelar_venda(p_venda_id)                            -- migration_038
--   reservar_unidade_estoque(p_unidade_id, p_responsavel, p_ate, p_cliente_id,
--     p_valor_sinal, p_forma_pagamento_id, p_usuario_id, p_usuario_nome)
--   liberar_reserva_estoque(p_reserva_id, p_usuario_id, p_usuario_nome)
--   arquivar_unidade_estoque(p_unidade_id, p_motivo, p_usuario_id, p_usuario_nome)
--   restaurar_unidade_estoque(p_unidade_id, p_usuario_id, p_usuario_nome)
--                                                          -- migration_068
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 0. Infraestrutura do roteiro (objetos temporários; somem no rollback)
-- -----------------------------------------------------------------------------
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
  if p_ok then
    raise notice 'PASS: % — %', p_cenario, coalesce(p_detalhe, '');
  else
    raise notice 'FAIL: % — %', p_cenario, coalesce(p_detalhe, '');
  end if;
end;
$$;

-- Confere um erro esperado: p_erro é o SQLERRM capturado (null = comando aceito).
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

-- -----------------------------------------------------------------------------
-- 1. Pré-requisitos: 067 e 068 aplicadas (aborta o roteiro se faltar)
-- -----------------------------------------------------------------------------
do $$
declare v_falta text := '';
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public'
      and table_name = 'estoque_reservas' and column_name = 'cliente_id') then
    v_falta := v_falta || ' [067: coluna estoque_reservas.cliente_id]';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_bloquear_exclusao_unidade_reservada') then
    v_falta := v_falta || ' [067: trigger trg_bloquear_exclusao_unidade_reservada]';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public'
      and table_name = 'estoque_reservas' and column_name = 'valor_sinal') then
    v_falta := v_falta || ' [068: coluna estoque_reservas.valor_sinal]';
  end if;
  if to_regclass('public.estoque_unidade_eventos') is null then
    v_falta := v_falta || ' [068: tabela estoque_unidade_eventos]';
  end if;
  if v_falta <> '' then
    raise exception 'Pré-requisito ausente — aplique 067 e 068 antes deste roteiro:%', v_falta;
  end if;
  perform pg_temp.hml_registra('P1 Migrations 067 e 068 presentes', true, 'colunas, tabela e trigger encontrados');
end $$;

-- P2. Assinatura financeira vigente presente e RPCs novas sem sobrecarga.
do $$
declare v_det text; v_ok boolean;
begin
  select string_agg(n || '=' || c, ', ' order by n), bool_and(c = 1) into v_det, v_ok
  from (
    select f.n, (select count(*) from pg_proc p join pg_namespace s on s.oid = p.pronamespace
                 where s.nspname = 'public' and p.proname = f.n) as c
    from unnest(array['reservar_unidade_estoque', 'liberar_reserva_estoque', 'arquivar_unidade_estoque',
                      'restaurar_unidade_estoque', 'cancelar_venda']) as f(n)
  ) t;
  v_ok := v_ok and to_regprocedure('public.registrar_venda(uuid,integer,numeric,uuid,uuid,text,text,date,text,uuid,uuid,text,numeric)') is not null;
  v_det := v_det || ', registrar_venda tem assinatura vigente de 13 args; todas as chamadas do roteiro incluem p_valor_recebido para desambiguar os overloads legados';
  perform pg_temp.hml_registra('P2 RPCs de estoque únicas e assinatura de venda vigente', v_ok, v_det);
end $$;

-- P3. Permissões: só service_role executa as RPCs de reserva/arquivamento.
do $$
declare v_ok boolean := true; v_det text := ''; r record;
begin
  for r in select * from (values
      ('reservar_unidade_estoque(uuid,text,timestamptz,uuid,numeric,uuid,uuid,text)'),
      ('liberar_reserva_estoque(uuid,uuid,text)'),
      ('arquivar_unidade_estoque(uuid,text,uuid,text)'),
      ('restaurar_unidade_estoque(uuid,uuid,text)')) v(assinatura) loop
    if not has_function_privilege('service_role', r.assinatura, 'execute')
       or has_function_privilege('anon', r.assinatura, 'execute')
       or has_function_privilege('authenticated', r.assinatura, 'execute') then
      v_ok := false; v_det := v_det || ' ' || r.assinatura;
    end if;
  end loop;
  for r in select t.tabela, g.papel from
      unnest(array['public.estoque_reservas', 'public.estoque_unidade_eventos']) t(tabela),
      unnest(array['anon', 'authenticated']) g(papel) loop
    if has_table_privilege(r.papel, r.tabela, 'select, insert, update, delete') then
      v_ok := false; v_det := v_det || ' ' || r.tabela || ' acessível a ' || r.papel;
    end if;
  end loop;
  perform pg_temp.hml_registra('P3 Permissões (só service_role)', v_ok,
    case when v_ok then 'service_role executa; anon/authenticated não' else 'revisar:' || v_det end);
end $$;

-- -----------------------------------------------------------------------------
-- 2. Fixtures (criadas dentro da transação; nomes com sufixo aleatório)
--    E1: peça R$ 100,00 com 3 unidades — U1 preço próprio R$ 150,00; U2 e U3
--        herdam R$ 100,00.
--    E2: peça sem preço (valor 0) com 1 unidade sem preço.
--    E3: peça R$ 50,00 com 1 unidade RESERVADA (reserva ativa).
--    E4: peça R$ 50,00 com 1 unidade cuja reserva já foi LIBERADA.
--    E5: peça R$ 50,00 com 1 unidade em branco com reserva VENCIDA não liberada.
--    E6: peça R$ 50,00 com 1 unidade em branco com reserva ATIVA.
-- -----------------------------------------------------------------------------
do $$
declare
  v_sfx text := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
  v_cat uuid; v_fav uuid; v_ffi uuid; v_cli uuid; v_ban uuid; v_l1 uuid; v_l2 uuid;
  v_e uuid; v_u uuid; v_r estoque_reservas;
  i int;
begin
  insert into categorias (nome) values ('HML 067-068 ' || v_sfx) returning id into v_cat;
  insert into formas_pagamento (nome, natureza) values ('HML SINAL À VISTA ' || v_sfx, 'avista') returning id into v_fav;
  insert into formas_pagamento (nome, natureza) values ('HML FIADO ' || v_sfx, 'fiado') returning id into v_ffi;
  insert into clientes (nome) values ('Cliente Homologação ' || v_sfx) returning id into v_cli;
  insert into clientes (nome, banido) values ('Cliente Banido Homologação ' || v_sfx, true) returning id into v_ban;
  insert into estoque_locais (codigo, deposito, zona, prateleira, secao)
    values ('HML-' || v_sfx || '-A', 'Homologação ' || v_sfx, 'HML', 'P1', 'S1') returning id into v_l1;
  insert into estoque_locais (codigo, deposito, zona, prateleira, secao)
    values ('HML-' || v_sfx || '-B', 'Homologação ' || v_sfx, 'HML', 'P1', 'S2') returning id into v_l2;
  insert into hml_ctx values ('cat', v_cat), ('forma_avista', v_fav), ('forma_fiado', v_ffi),
    ('cliente', v_cli), ('cliente_banido', v_ban), ('local_a', v_l1), ('local_b', v_l2);

  -- E1 (unidades criadas pela RPC real da 065, que incrementa a quantidade)
  insert into estoque (nome, categoria_id, condicao, valor, quantidade)
    values ('HML Peça com reservas ' || v_sfx, v_cat, 'paralela', 100.00, 0) returning id into v_e;
  insert into hml_ctx values ('e1', v_e);
  select id into v_u from adicionar_unidade_estoque(v_e, jsonb_build_object('valor', 150));
  insert into hml_ctx values ('u1', v_u);
  select id into v_u from adicionar_unidade_estoque(v_e, '{}'::jsonb);
  insert into hml_ctx values ('u2', v_u);
  select id into v_u from adicionar_unidade_estoque(v_e, '{}'::jsonb);
  insert into hml_ctx values ('u3', v_u);

  -- E2: sem preço (estoque.valor é NOT NULL; 0 = sem preço definido)
  insert into estoque (nome, categoria_id, condicao, valor, quantidade)
    values ('HML Peça sem preço ' || v_sfx, v_cat, 'paralela', 0, 0) returning id into v_e;
  select id into v_u from adicionar_unidade_estoque(v_e, '{}'::jsonb);
  insert into hml_ctx values ('e2', v_e), ('e2u', v_u);

  -- E3..E6: uma unidade cada, preço herdado de R$ 50,00
  for i in 3..6 loop
    insert into estoque (nome, categoria_id, condicao, valor, quantidade)
      values ('HML Peça E' || i || ' ' || v_sfx, v_cat, 'paralela', 50.00, 0) returning id into v_e;
    select id into v_u from adicionar_unidade_estoque(v_e, '{}'::jsonb);
    insert into hml_ctx values ('e' || i, v_e), ('e' || i || 'u', v_u);
  end loop;

  -- E3 e E6: reserva ativa (RPC real, sinal de 20%)
  perform reservar_unidade_estoque(p_unidade_id => pg_temp.hml_id('e3u'), p_responsavel => 'Fixture E3',
    p_ate => now() + interval '7 days', p_valor_sinal => 10.00, p_forma_pagamento_id => v_fav);
  perform reservar_unidade_estoque(p_unidade_id => pg_temp.hml_id('e6u'), p_responsavel => 'Fixture E6',
    p_ate => now() + interval '7 days', p_valor_sinal => 10.00, p_forma_pagamento_id => v_fav);
  -- E4: reserva criada e liberada
  select * into v_r from reservar_unidade_estoque(p_unidade_id => pg_temp.hml_id('e4u'), p_responsavel => 'Fixture E4',
    p_ate => now() + interval '7 days', p_valor_sinal => 10.00, p_forma_pagamento_id => v_fav);
  perform liberar_reserva_estoque(p_reserva_id => v_r.id);
  -- E5: reserva vencida e não liberada (inserida direto, com criada_em no passado)
  insert into estoque_reservas (unidade_id, responsavel, reservada_ate, criada_em)
    values (pg_temp.hml_id('e5u'), 'Fixture E5 vencida', now() - interval '1 day', now() - interval '2 days');

  -- E7: peça R$ 100,00 com 1 unidade (venda SEM p_unidade_id zera a quantidade)
  insert into estoque (nome, categoria_id, condicao, valor, quantidade)
    values ('HML Peça E7 ' || v_sfx, v_cat, 'paralela', 100.00, 0) returning id into v_e;
  select id into v_u from adicionar_unidade_estoque(v_e, '{}'::jsonb);
  insert into hml_ctx values ('e7', v_e), ('e7u', v_u);
  -- E8: peça de R$ 0,01 com 1 unidade (arredondamento do sinal)
  insert into estoque (nome, categoria_id, condicao, valor, quantidade)
    values ('HML Peça E8 ' || v_sfx, v_cat, 'paralela', 0.01, 0) returning id into v_e;
  select id into v_u from adicionar_unidade_estoque(v_e, '{}'::jsonb);
  insert into hml_ctx values ('e8', v_e), ('e8u', v_u);

  perform pg_temp.hml_registra('F0 Fixtures criadas', true, 'sufixo ' || v_sfx);
end $$;

-- -----------------------------------------------------------------------------
-- A. Reserva com sinal válido
-- -----------------------------------------------------------------------------
-- A1. Sinal de exatamente 20% (R$ 20,00 de R$ 100,00), forma à vista, cliente
--     cadastrado sem responsável digitado → reserva criada com sinal, preço de
--     referência, forma, autoria e o nome do cliente como responsável.
do $$
declare v_r estoque_reservas; v_ok boolean := false; v_det text;
begin
  begin
    select * into v_r from reservar_unidade_estoque(
      p_unidade_id => pg_temp.hml_id('u2'), p_responsavel => '', p_ate => now() + interval '7 days',
      p_cliente_id => pg_temp.hml_id('cliente'), p_valor_sinal => 20.00,
      p_forma_pagamento_id => pg_temp.hml_id('forma_avista'),
      p_usuario_id => '11111111-1111-1111-1111-111111111111', p_usuario_nome => '  Homologador  ');
    insert into hml_ctx values ('reserva_u2', v_r.id);
    v_ok := v_r.valor_sinal = 20.00 and v_r.preco_referencia = 100.00
      and v_r.forma_pagamento_sinal_id = pg_temp.hml_id('forma_avista')
      and v_r.criada_por = '11111111-1111-1111-1111-111111111111' and v_r.criada_por_nome = 'Homologador'
      and v_r.cliente_id = pg_temp.hml_id('cliente') and v_r.responsavel like 'Cliente Homologação %'
      and v_r.liberada_em is null;
    v_det := format('valor_sinal=%s preco_referencia=%s criada_por_nome=%s responsavel=%s',
      v_r.valor_sinal, v_r.preco_referencia, v_r.criada_por_nome, v_r.responsavel);
  exception when others then v_det := 'erro inesperado: ' || sqlerrm;
  end;
  perform pg_temp.hml_registra('A1 Reserva com sinal de 20% (à vista)', v_ok, v_det);
end $$;

-- A2. Preço próprio da unidade prevalece sobre o da peça: U1 vale R$ 150,00,
--     então R$ 20,00 (20% da peça) não basta — mínimo R$ 30,00.
do $$
declare v_err text;
begin
  begin
    perform reservar_unidade_estoque(p_unidade_id => pg_temp.hml_id('u1'), p_responsavel => 'Teste A2',
      p_ate => now() + interval '7 days', p_valor_sinal => 20.00, p_forma_pagamento_id => pg_temp.hml_id('forma_avista'));
    raise exception 'aceito' using errcode = 'ZX000';
  exception when sqlstate 'ZX000' then v_err := null; when others then v_err := sqlerrm;
  end;
  perform pg_temp.hml_erro_esperado('A2 Preço da unidade (R$ 150) define o mínimo', v_err, '%abaixo de 20%R$ 30,00%');
end $$;

-- A3. Sinal igual ao preço (100%) é aceito (executa e desfaz).
do $$
declare v_r estoque_reservas; v_ok boolean := false; v_det text;
begin
  begin
    select * into v_r from reservar_unidade_estoque(p_unidade_id => pg_temp.hml_id('u3'), p_responsavel => 'Teste A3',
      p_ate => now() + interval '7 days', p_valor_sinal => 100.00, p_forma_pagamento_id => pg_temp.hml_id('forma_avista'));
    v_ok := v_r.valor_sinal = 100.00; v_det := 'valor_sinal=' || v_r.valor_sinal;
    raise exception 'desfazer' using errcode = 'ZX000';
  exception when sqlstate 'ZX000' then null; when others then v_ok := false; v_det := 'erro inesperado: ' || sqlerrm;
  end;
  perform pg_temp.hml_registra('A3 Sinal igual ao preço é aceito', v_ok, v_det);
end $$;

-- -----------------------------------------------------------------------------
-- B. Reserva rejeitada (sinal, forma de pagamento, preço, cliente)
-- -----------------------------------------------------------------------------
do $$
declare v_err text;
begin
  begin
    perform reservar_unidade_estoque(p_unidade_id => pg_temp.hml_id('u3'), p_responsavel => 'Teste B1',
      p_ate => now() + interval '7 days', p_valor_sinal => 19.99, p_forma_pagamento_id => pg_temp.hml_id('forma_avista'));
    raise exception 'aceito' using errcode = 'ZX000';
  exception when sqlstate 'ZX000' then v_err := null; when others then v_err := sqlerrm;
  end;
  perform pg_temp.hml_erro_esperado('B1 Sinal de 19,99% rejeitado', v_err, '%Sinal abaixo de 20%R$ 20,00%');
end $$;

do $$
declare v_err text;
begin
  begin
    perform reservar_unidade_estoque(p_unidade_id => pg_temp.hml_id('u3'), p_responsavel => 'Teste B2',
      p_ate => now() + interval '7 days', p_valor_sinal => 100.01, p_forma_pagamento_id => pg_temp.hml_id('forma_avista'));
    raise exception 'aceito' using errcode = 'ZX000';
  exception when sqlstate 'ZX000' then v_err := null; when others then v_err := sqlerrm;
  end;
  perform pg_temp.hml_erro_esperado('B2 Sinal maior que o preço rejeitado', v_err, '%sinal não pode ser maior que o preço%');
end $$;

do $$
declare v_err text;
begin
  begin
    perform reservar_unidade_estoque(p_unidade_id => pg_temp.hml_id('u3'), p_responsavel => 'Teste B3',
      p_ate => now() + interval '7 days', p_forma_pagamento_id => pg_temp.hml_id('forma_avista'));
    raise exception 'aceito' using errcode = 'ZX000';
  exception when sqlstate 'ZX000' then v_err := null; when others then v_err := sqlerrm;
  end;
  perform pg_temp.hml_erro_esperado('B3 Reserva sem sinal rejeitada', v_err, '%Informe o valor do sinal pago%');
end $$;

do $$
declare v_err text;
begin
  begin
    perform reservar_unidade_estoque(p_unidade_id => pg_temp.hml_id('u3'), p_responsavel => 'Teste B4',
      p_ate => now() + interval '7 days', p_valor_sinal => 0, p_forma_pagamento_id => pg_temp.hml_id('forma_avista'));
    raise exception 'aceito' using errcode = 'ZX000';
  exception when sqlstate 'ZX000' then v_err := null; when others then v_err := sqlerrm;
  end;
  perform pg_temp.hml_erro_esperado('B4 Sinal zero rejeitado', v_err, '%Informe o valor do sinal pago%');
end $$;

do $$
declare v_err text;
begin
  begin
    perform reservar_unidade_estoque(p_unidade_id => pg_temp.hml_id('u3'), p_responsavel => 'Teste B5',
      p_ate => now() + interval '7 days', p_valor_sinal => 20.00, p_forma_pagamento_id => pg_temp.hml_id('forma_fiado'));
    raise exception 'aceito' using errcode = 'ZX000';
  exception when sqlstate 'ZX000' then v_err := null; when others then v_err := sqlerrm;
  end;
  perform pg_temp.hml_erro_esperado('B5 Sinal no fiado rejeitado', v_err, '%fiado não é aceita%');
end $$;

do $$
declare v_err text;
begin
  begin
    perform reservar_unidade_estoque(p_unidade_id => pg_temp.hml_id('u3'), p_responsavel => 'Teste B6',
      p_ate => now() + interval '7 days', p_valor_sinal => 20.00);
    raise exception 'aceito' using errcode = 'ZX000';
  exception when sqlstate 'ZX000' then v_err := null; when others then v_err := sqlerrm;
  end;
  perform pg_temp.hml_erro_esperado('B6 Sinal sem forma de pagamento rejeitado', v_err, '%Informe a forma de pagamento do sinal%');
end $$;

do $$
declare v_err text;
begin
  begin
    perform reservar_unidade_estoque(p_unidade_id => pg_temp.hml_id('u3'), p_responsavel => 'Teste B7',
      p_ate => now() + interval '7 days', p_valor_sinal => 20.00, p_forma_pagamento_id => gen_random_uuid());
    raise exception 'aceito' using errcode = 'ZX000';
  exception when sqlstate 'ZX000' then v_err := null; when others then v_err := sqlerrm;
  end;
  perform pg_temp.hml_erro_esperado('B7 Forma de pagamento inexistente rejeitada', v_err, '%Forma de pagamento do sinal não encontrada%');
end $$;

do $$
declare v_err text;
begin
  begin
    perform reservar_unidade_estoque(p_unidade_id => pg_temp.hml_id('e2u'), p_responsavel => 'Teste B8',
      p_ate => now() + interval '7 days', p_valor_sinal => 20.00, p_forma_pagamento_id => pg_temp.hml_id('forma_avista'));
    raise exception 'aceito' using errcode = 'ZX000';
  exception when sqlstate 'ZX000' then v_err := null; when others then v_err := sqlerrm;
  end;
  perform pg_temp.hml_erro_esperado('B8 Unidade sem preço não pode ser reservada', v_err, '%Defina o preço da unidade antes de reservar%');
end $$;

do $$
declare v_err text;
begin
  begin
    perform reservar_unidade_estoque(p_unidade_id => pg_temp.hml_id('u3'), p_responsavel => '',
      p_ate => now() + interval '7 days', p_cliente_id => pg_temp.hml_id('cliente_banido'),
      p_valor_sinal => 20.00, p_forma_pagamento_id => pg_temp.hml_id('forma_avista'));
    raise exception 'aceito' using errcode = 'ZX000';
  exception when sqlstate 'ZX000' then v_err := null; when others then v_err := sqlerrm;
  end;
  perform pg_temp.hml_erro_esperado('B9 Cliente banido não reserva', v_err, '%Cliente banido não pode reservar%');
end $$;

-- -----------------------------------------------------------------------------
-- C. Prazo da reserva (máximo 30 × 24 h a partir de agora) e reserva duplicada
-- -----------------------------------------------------------------------------
do $$
declare v_r estoque_reservas; v_ok boolean := false; v_det text;
begin
  begin
    select * into v_r from reservar_unidade_estoque(p_unidade_id => pg_temp.hml_id('u3'), p_responsavel => 'Teste C1',
      p_ate => now() + interval '30 days' - interval '1 minute', p_valor_sinal => 20.00,
      p_forma_pagamento_id => pg_temp.hml_id('forma_avista'));
    v_ok := v_r.id is not null; v_det := 'reservada_ate=' || v_r.reservada_ate;
    raise exception 'desfazer' using errcode = 'ZX000';
  exception when sqlstate 'ZX000' then null; when others then v_ok := false; v_det := 'erro inesperado: ' || sqlerrm;
  end;
  perform pg_temp.hml_registra('C1 Prazo de 30 dias menos 1 minuto aceito', v_ok, v_det);
end $$;

do $$
declare v_err text;
begin
  begin
    perform reservar_unidade_estoque(p_unidade_id => pg_temp.hml_id('u3'), p_responsavel => 'Teste C2',
      p_ate => now() + interval '30 days' + interval '1 minute', p_valor_sinal => 20.00,
      p_forma_pagamento_id => pg_temp.hml_id('forma_avista'));
    raise exception 'aceito' using errcode = 'ZX000';
  exception when sqlstate 'ZX000' then v_err := null; when others then v_err := sqlerrm;
  end;
  perform pg_temp.hml_erro_esperado('C2 Prazo de 30 dias mais 1 minuto rejeitado', v_err, '%Vencimento da reserva deve estar entre agora e 30 dias%');
end $$;

do $$
declare v_err text;
begin
  begin
    perform reservar_unidade_estoque(p_unidade_id => pg_temp.hml_id('u3'), p_responsavel => 'Teste C3',
      p_ate => now() - interval '1 minute', p_valor_sinal => 20.00,
      p_forma_pagamento_id => pg_temp.hml_id('forma_avista'));
    raise exception 'aceito' using errcode = 'ZX000';
  exception when sqlstate 'ZX000' then v_err := null; when others then v_err := sqlerrm;
  end;
  perform pg_temp.hml_erro_esperado('C3 Prazo no passado rejeitado', v_err, '%Vencimento da reserva deve estar entre agora e 30 dias%');
end $$;

do $$
declare v_err text;
begin
  begin
    perform reservar_unidade_estoque(p_unidade_id => pg_temp.hml_id('u2'), p_responsavel => 'Teste C4',
      p_ate => now() + interval '7 days', p_valor_sinal => 20.00,
      p_forma_pagamento_id => pg_temp.hml_id('forma_avista'));
    raise exception 'aceito' using errcode = 'ZX000';
  exception when sqlstate 'ZX000' then v_err := null; when others then v_err := sqlerrm;
  end;
  perform pg_temp.hml_erro_esperado('C4 Segunda reserva na mesma unidade rejeitada', v_err, '%já está reservada%');
end $$;

-- -----------------------------------------------------------------------------
-- D. Interação com registrar_venda (migration_059, sem alteração)
-- -----------------------------------------------------------------------------
-- D1. Venda da unidade reservada (com p_unidade_id) → bloqueada.
do $$
declare v_err text;
begin
  begin
    perform registrar_venda(p_estoque_id => pg_temp.hml_id('e1'), p_quantidade => 1, p_valor_unitario => 100.00,
      p_forma_pagamento_id => pg_temp.hml_id('forma_avista'), p_valor_recebido => null, p_unidade_id => pg_temp.hml_id('u2'),
      p_cliente_nome => 'Homologação', p_observacoes => 'HML D1');
    raise exception 'aceito' using errcode = 'ZX000';
  exception when sqlstate 'ZX000' then v_err := null; when others then v_err := sqlerrm;
  end;
  perform pg_temp.hml_erro_esperado('D1 Venda da unidade reservada bloqueada', v_err, '%Unidade reservada: libere a reserva antes da venda%');
end $$;

-- D2. Venda SEM p_unidade_id quando a única unidade ativa está reservada → bloqueada.
do $$
declare v_err text;
begin
  begin
    perform registrar_venda(p_estoque_id => pg_temp.hml_id('e3'), p_quantidade => 1, p_valor_unitario => 50.00,
      p_forma_pagamento_id => pg_temp.hml_id('forma_avista'), p_valor_recebido => null, p_cliente_nome => 'Homologação', p_observacoes => 'HML D2');
    raise exception 'aceito' using errcode = 'ZX000';
  exception when sqlstate 'ZX000' then v_err := null; when others then v_err := sqlerrm;
  end;
  perform pg_temp.hml_erro_esperado('D2 Venda sem unidade não consome a reservada', v_err, '%unidade reservada: libere a reserva antes de vender%');
end $$;

-- D3. Venda SEM p_unidade_id com unidade livre sobrando → aceita (executa e desfaz).
do $$
declare v_venda vendas; v_q0 int; v_q1 int; v_caixa numeric; v_ok boolean := false; v_det text;
begin
  select quantidade into v_q0 from estoque where id = pg_temp.hml_id('e1');
  begin
    select * into v_venda from registrar_venda(p_estoque_id => pg_temp.hml_id('e1'), p_quantidade => 1,
      p_valor_unitario => 100.00, p_forma_pagamento_id => pg_temp.hml_id('forma_avista'), p_valor_recebido => null,
      p_cliente_nome => 'Homologação', p_observacoes => 'HML D3');
    select quantidade into v_q1 from estoque where id = pg_temp.hml_id('e1');
    select sum(valor) into v_caixa from caixa where venda_id = v_venda.id;
    v_ok := v_q1 = v_q0 - 1 and v_caixa = 100.00;
    v_det := format('quantidade %s→%s, caixa=%s', v_q0, v_q1, v_caixa);
    raise exception 'desfazer' using errcode = 'ZX000';
  exception when sqlstate 'ZX000' then null; when others then v_ok := false; v_det := 'erro inesperado: ' || sqlerrm;
  end;
  perform pg_temp.hml_registra('D3 Venda sem unidade com sobra livre aceita', v_ok, v_det);
end $$;

-- D4. Venda de OUTRA unidade (livre) da mesma peça enquanto U2 está reservada → aceita.
do $$
declare v_venda vendas; v_vendida timestamptz; v_ok boolean := false; v_det text;
begin
  begin
    select * into v_venda from registrar_venda(p_estoque_id => pg_temp.hml_id('e1'), p_quantidade => 1,
      p_valor_unitario => 100.00, p_forma_pagamento_id => pg_temp.hml_id('forma_avista'), p_valor_recebido => null,
      p_unidade_id => pg_temp.hml_id('u3'), p_cliente_nome => 'Homologação', p_observacoes => 'HML D4');
    select vendida_em into v_vendida from estoque_unidades where id = pg_temp.hml_id('u3');
    v_ok := v_venda.unidade_id = pg_temp.hml_id('u3') and v_vendida is not null;
    v_det := 'unidade livre vendida; vendida_em=' || coalesce(v_vendida::text, 'null');
    raise exception 'desfazer' using errcode = 'ZX000';
  exception when sqlstate 'ZX000' then null; when others then v_ok := false; v_det := 'erro inesperado: ' || sqlerrm;
  end;
  perform pg_temp.hml_registra('D4 Venda de unidade livre da peça com reserva', v_ok, v_det);
end $$;

-- -----------------------------------------------------------------------------
-- E. Arquivar / restaurar com autoria e histórico
-- -----------------------------------------------------------------------------
do $$
declare v_err text;
begin
  begin
    perform arquivar_unidade_estoque(p_unidade_id => pg_temp.hml_id('u2'), p_motivo => 'Teste E1',
      p_usuario_nome => 'Homologador');
    raise exception 'aceito' using errcode = 'ZX000';
  exception when sqlstate 'ZX000' then v_err := null; when others then v_err := sqlerrm;
  end;
  perform pg_temp.hml_erro_esperado('E1 Arquivar unidade reservada bloqueado', v_err, '%Libere a reserva antes de arquivar%');
end $$;

do $$
declare v_u estoque_unidades; v_q0 int; v_q1 int; v_ev estoque_unidade_eventos; v_ok boolean := false; v_det text;
begin
  select quantidade into v_q0 from estoque where id = pg_temp.hml_id('e1');
  begin
    select * into v_u from arquivar_unidade_estoque(p_unidade_id => pg_temp.hml_id('u3'), p_motivo => '  Quebrou no manuseio  ',
      p_usuario_id => '22222222-2222-2222-2222-222222222222', p_usuario_nome => 'Homologador');
    select quantidade into v_q1 from estoque where id = pg_temp.hml_id('e1');
    select * into v_ev from estoque_unidade_eventos where unidade_id = pg_temp.hml_id('u3') and tipo = 'arquivada'
      order by criado_em desc limit 1;
    v_ok := v_u.arquivada_em is not null and v_q1 = v_q0 - 1 and v_ev.id is not null
      and v_ev.usuario_nome = 'Homologador' and v_ev.usuario_id = '22222222-2222-2222-2222-222222222222'
      and v_ev.detalhe ->> 'motivo' = 'Quebrou no manuseio';
    v_det := format('quantidade %s→%s, evento=%s por %s, detalhe=%s', v_q0, v_q1, v_ev.tipo, v_ev.usuario_nome, v_ev.detalhe);
  exception when others then v_ok := false; v_det := 'erro inesperado: ' || sqlerrm;
  end;
  perform pg_temp.hml_registra('E2 Arquivar unidade livre (baixa + evento)', v_ok, v_det);
end $$;

do $$
declare v_err text;
begin
  begin
    perform registrar_venda(p_estoque_id => pg_temp.hml_id('e1'), p_quantidade => 1, p_valor_unitario => 100.00,
      p_forma_pagamento_id => pg_temp.hml_id('forma_avista'), p_valor_recebido => null, p_unidade_id => pg_temp.hml_id('u3'),
      p_cliente_nome => 'Homologação', p_observacoes => 'HML E3');
    raise exception 'aceito' using errcode = 'ZX000';
  exception when sqlstate 'ZX000' then v_err := null; when others then v_err := sqlerrm;
  end;
  perform pg_temp.hml_erro_esperado('E3 Venda de unidade arquivada bloqueada', v_err, '%Unidade arquivada não pode ser vendida%');
end $$;

do $$
declare v_err text;
begin
  begin
    perform reservar_unidade_estoque(p_unidade_id => pg_temp.hml_id('u3'), p_responsavel => 'Teste E4',
      p_ate => now() + interval '7 days', p_valor_sinal => 20.00, p_forma_pagamento_id => pg_temp.hml_id('forma_avista'));
    raise exception 'aceito' using errcode = 'ZX000';
  exception when sqlstate 'ZX000' then v_err := null; when others then v_err := sqlerrm;
  end;
  perform pg_temp.hml_erro_esperado('E4 Reservar unidade arquivada bloqueado', v_err, '%vendida ou arquivada não pode ser reservada%');
end $$;

do $$
declare v_u estoque_unidades; v_q0 int; v_q1 int; v_ev estoque_unidade_eventos; v_ok boolean := false; v_det text;
begin
  select quantidade into v_q0 from estoque where id = pg_temp.hml_id('e1');
  begin
    select * into v_u from restaurar_unidade_estoque(p_unidade_id => pg_temp.hml_id('u3'),
      p_usuario_id => '22222222-2222-2222-2222-222222222222', p_usuario_nome => 'Homologador');
    select quantidade into v_q1 from estoque where id = pg_temp.hml_id('e1');
    select * into v_ev from estoque_unidade_eventos where unidade_id = pg_temp.hml_id('u3') and tipo = 'restaurada'
      order by criado_em desc limit 1;
    v_ok := v_u.arquivada_em is null and v_u.motivo_arquivamento is null and v_q1 = v_q0 + 1
      and v_ev.usuario_nome = 'Homologador' and v_ev.detalhe ->> 'motivo_anterior' = 'Quebrou no manuseio';
    v_det := format('quantidade %s→%s, evento=%s por %s, detalhe=%s', v_q0, v_q1, v_ev.tipo, v_ev.usuario_nome, v_ev.detalhe);
  exception when others then v_ok := false; v_det := 'erro inesperado: ' || sqlerrm;
  end;
  perform pg_temp.hml_registra('E5 Restaurar unidade (volta ao estoque + evento)', v_ok, v_det);
end $$;

-- -----------------------------------------------------------------------------
-- F. Liberar reserva → vender → cancelar venda (cancelar_venda da migration_038)
-- -----------------------------------------------------------------------------
do $$
declare v_r estoque_reservas; v_ok boolean := false; v_det text;
begin
  begin
    select * into v_r from liberar_reserva_estoque(p_reserva_id => pg_temp.hml_id('reserva_u2'),
      p_usuario_id => '33333333-3333-3333-3333-333333333333', p_usuario_nome => ' Gerente HML ');
    v_ok := v_r.liberada_em is not null and v_r.liberada_por_nome = 'Gerente HML'
      and v_r.liberada_por = '33333333-3333-3333-3333-333333333333' and v_r.motivo_liberacao = 'Liberada pela equipe';
    v_det := format('liberada_por_nome=%s motivo=%s', v_r.liberada_por_nome, v_r.motivo_liberacao);
  exception when others then v_ok := false; v_det := 'erro inesperado: ' || sqlerrm;
  end;
  perform pg_temp.hml_registra('F1 Liberar reserva com autoria', v_ok, v_det);
end $$;

do $$
declare v_err text;
begin
  begin
    perform liberar_reserva_estoque(p_reserva_id => pg_temp.hml_id('reserva_u2'));
    raise exception 'aceito' using errcode = 'ZX000';
  exception when sqlstate 'ZX000' then v_err := null; when others then v_err := sqlerrm;
  end;
  perform pg_temp.hml_erro_esperado('F2 Liberar a mesma reserva de novo rejeitado', v_err, '%Reserva já foi liberada%');
end $$;

do $$
declare v_venda vendas; v_q0 int; v_q1 int; v_vendida timestamptz; v_caixa numeric; v_ok boolean := false; v_det text;
begin
  select quantidade into v_q0 from estoque where id = pg_temp.hml_id('e1');
  begin
    select * into v_venda from registrar_venda(p_estoque_id => pg_temp.hml_id('e1'), p_quantidade => 1,
      p_valor_unitario => 100.00, p_forma_pagamento_id => pg_temp.hml_id('forma_avista'), p_valor_recebido => null,
      p_unidade_id => pg_temp.hml_id('u2'), p_cliente_id => pg_temp.hml_id('cliente'), p_observacoes => 'HML F3');
    insert into hml_ctx values ('venda_u2', v_venda.id);
    select quantidade into v_q1 from estoque where id = pg_temp.hml_id('e1');
    select vendida_em into v_vendida from estoque_unidades where id = pg_temp.hml_id('u2');
    select sum(valor) into v_caixa from caixa where venda_id = v_venda.id;
    v_ok := v_vendida is not null and v_q1 = v_q0 - 1 and v_caixa = 100.00 and v_venda.valor_total = 100.00;
    v_det := format('quantidade %s→%s, vendida_em preenchida=%s, caixa=%s', v_q0, v_q1, v_vendida is not null, v_caixa);
  exception when others then v_ok := false; v_det := 'erro inesperado: ' || sqlerrm;
  end;
  perform pg_temp.hml_registra('F3 Venda da unidade após liberar a reserva', v_ok, v_det);
end $$;

do $$
declare v_q0 int; v_q1 int; v_vendida timestamptz; v_caixa int; v_vendas int; v_ok boolean := false; v_det text;
begin
  select quantidade into v_q0 from estoque where id = pg_temp.hml_id('e1');
  begin
    perform cancelar_venda(p_venda_id => pg_temp.hml_id('venda_u2'));
    select quantidade into v_q1 from estoque where id = pg_temp.hml_id('e1');
    select vendida_em into v_vendida from estoque_unidades where id = pg_temp.hml_id('u2');
    select count(*) into v_caixa from caixa where venda_id = pg_temp.hml_id('venda_u2');
    select count(*) into v_vendas from vendas where id = pg_temp.hml_id('venda_u2');
    v_ok := v_vendida is null and v_q1 = v_q0 + 1 and v_caixa = 0 and v_vendas = 0;
    v_det := format('quantidade %s→%s, vendida_em=%s, caixa=%s linha(s), venda=%s linha(s)',
      v_q0, v_q1, coalesce(v_vendida::text, 'null'), v_caixa, v_vendas);
  exception when others then v_ok := false; v_det := 'erro inesperado: ' || sqlerrm;
  end;
  perform pg_temp.hml_registra('F4 cancelar_venda devolve a unidade e estorna o caixa', v_ok, v_det);
end $$;

-- -----------------------------------------------------------------------------
-- G. Reserva vencida (não liberada) não bloqueia venda nem sincronização
-- -----------------------------------------------------------------------------
-- Cria em U3 uma reserva vencida sem liberar (inserção direta, criada no passado).
do $$
begin
  insert into estoque_reservas (unidade_id, responsavel, reservada_ate, criada_em)
    values (pg_temp.hml_id('u3'), 'Reserva vencida HML', now() - interval '1 hour', now() - interval '3 days');
end $$;

do $$
declare v_venda vendas; v_ok boolean := false; v_det text;
begin
  begin
    select * into v_venda from registrar_venda(p_estoque_id => pg_temp.hml_id('e1'), p_quantidade => 1,
      p_valor_unitario => 100.00, p_forma_pagamento_id => pg_temp.hml_id('forma_avista'), p_valor_recebido => null,
      p_unidade_id => pg_temp.hml_id('u3'), p_cliente_nome => 'Homologação', p_observacoes => 'HML G1');
    v_ok := v_venda.id is not null; v_det := 'venda aceita com reserva vencida pendente';
    raise exception 'desfazer' using errcode = 'ZX000';
  exception when sqlstate 'ZX000' then null; when others then v_ok := false; v_det := 'erro inesperado: ' || sqlerrm;
  end;
  perform pg_temp.hml_registra('G1 Reserva vencida não bloqueia venda', v_ok, v_det);
end $$;

do $$
declare v_r estoque_reservas; v_exp text; v_ok boolean := false; v_det text;
begin
  begin
    select * into v_r from reservar_unidade_estoque(p_unidade_id => pg_temp.hml_id('u3'), p_responsavel => 'Teste G2',
      p_ate => now() + interval '2 days', p_valor_sinal => 25.00, p_forma_pagamento_id => pg_temp.hml_id('forma_avista'));
    select motivo_liberacao into v_exp from estoque_reservas
      where unidade_id = pg_temp.hml_id('u3') and responsavel = 'Reserva vencida HML';
    v_ok := v_r.id is not null and v_exp = 'Expirada';
    v_det := 'nova reserva criada; a vencida foi encerrada como ' || coalesce(v_exp, 'null');
    raise exception 'desfazer' using errcode = 'ZX000';
  exception when sqlstate 'ZX000' then null; when others then v_ok := false; v_det := 'erro inesperado: ' || sqlerrm;
  end;
  perform pg_temp.hml_registra('G2 Nova reserva encerra a vencida como Expirada', v_ok, v_det);
end $$;

do $$
declare v_unid int; v_res int; v_ok boolean := false; v_det text;
begin
  begin
    perform sincronizar_unidades_estoque(pg_temp.hml_id('e5'), 0);
    select count(*) into v_unid from estoque_unidades where id = pg_temp.hml_id('e5u');
    select count(*) into v_res from estoque_reservas where unidade_id = pg_temp.hml_id('e5u');
    v_ok := v_unid = 0 and v_res = 0;
    v_det := format('ficha em branco removida (%s restante), reserva vencida removida em cascata (%s restante)', v_unid, v_res);
    raise exception 'desfazer' using errcode = 'ZX000';
  exception when sqlstate 'ZX000' then null; when others then v_ok := false; v_det := 'erro inesperado: ' || sqlerrm;
  end;
  perform pg_temp.hml_registra('G3 Sincronização ignora reserva vencida', v_ok, v_det);
end $$;

do $$
declare v_err text;
begin
  begin
    perform sincronizar_unidades_estoque(pg_temp.hml_id('e6'), 0);
    raise exception 'aceito' using errcode = 'ZX000';
  exception when sqlstate 'ZX000' then v_err := null; when others then v_err := sqlerrm;
  end;
  perform pg_temp.hml_erro_esperado('G4 Sincronização preserva ficha com reserva ativa', v_err, '%Reduza a quantidade excluindo as unidades específicas%');
end $$;

-- -----------------------------------------------------------------------------
-- H. Exclusão de peça (067: FK em cascata + trigger contra reserva ativa)
-- -----------------------------------------------------------------------------
do $$
declare v_err text;
begin
  begin
    delete from estoque where id = pg_temp.hml_id('e3');
    raise exception 'aceito' using errcode = 'ZX000';
  exception when sqlstate 'ZX000' then v_err := null; when others then v_err := sqlerrm;
  end;
  perform pg_temp.hml_erro_esperado('H1 Excluir peça com reserva ativa bloqueado', v_err, '%Unidade reservada: libere a reserva antes de excluir%');
end $$;

do $$
declare v_pecas int; v_res int; v_ok boolean := false; v_det text;
begin
  begin
    delete from estoque where id = pg_temp.hml_id('e4');
    select count(*) into v_pecas from estoque where id = pg_temp.hml_id('e4');
    select count(*) into v_res from estoque_reservas where unidade_id = pg_temp.hml_id('e4u');
    v_ok := v_pecas = 0 and v_res = 0;
    v_det := format('peça excluída; reservas liberadas restantes=%s (cascata)', v_res);
  exception when others then v_ok := false; v_det := 'erro inesperado: ' || sqlerrm;
  end;
  perform pg_temp.hml_registra('H2 Excluir peça só com reserva liberada', v_ok, v_det);
end $$;

-- -----------------------------------------------------------------------------
-- I. Histórico de endereço (trigger da 068)
-- -----------------------------------------------------------------------------
do $$
declare v_ev1 estoque_unidade_eventos; v_ev2 estoque_unidade_eventos; v_org timestamptz;
  v_a text; v_b text; v_ok boolean := false; v_det text;
begin
  select codigo into v_a from estoque_locais where id = pg_temp.hml_id('local_a');
  select codigo into v_b from estoque_locais where id = pg_temp.hml_id('local_b');
  begin
    update estoque_unidades set endereco_id = pg_temp.hml_id('local_a') where id = pg_temp.hml_id('u1');
    update estoque_unidades set endereco_id = pg_temp.hml_id('local_b') where id = pg_temp.hml_id('u1');
    select * into v_ev1 from estoque_unidade_eventos where unidade_id = pg_temp.hml_id('u1')
      and tipo = 'endereco_alterado' and detalhe ->> 'para' = v_a;
    select * into v_ev2 from estoque_unidade_eventos where unidade_id = pg_temp.hml_id('u1')
      and tipo = 'endereco_alterado' and detalhe ->> 'de' = v_a;
    select organizada_em into v_org from estoque_unidades where id = pg_temp.hml_id('u1');
    v_ok := v_ev1.id is not null and (v_ev1.detalhe -> 'de') = 'null'::jsonb
      and v_ev2.id is not null and v_ev2.detalhe ->> 'para' = v_b and v_org is not null
      and (select count(*) from estoque_unidade_eventos where unidade_id = pg_temp.hml_id('u1')) = 2;
    v_det := format('eventos: %s e %s; organizada_em preenchida=%s', v_ev1.detalhe, v_ev2.detalhe, v_org is not null);
  exception when others then v_ok := false; v_det := 'erro inesperado: ' || sqlerrm;
  end;
  perform pg_temp.hml_registra('I1 Troca de endereço gera evento de/para', v_ok, v_det);
end $$;

do $$
declare v_antes int; v_depois int; v_ok boolean := false; v_det text;
begin
  select count(*) into v_antes from estoque_unidade_eventos where unidade_id = pg_temp.hml_id('u1');
  begin
    perform registrar_venda(p_estoque_id => pg_temp.hml_id('e1'), p_quantidade => 1, p_valor_unitario => 150.00,
      p_forma_pagamento_id => pg_temp.hml_id('forma_avista'), p_valor_recebido => null, p_unidade_id => pg_temp.hml_id('u1'),
      p_cliente_nome => 'Homologação', p_observacoes => 'HML I2');
    update estoque_unidades set nome = 'Renomeada HML' where id = pg_temp.hml_id('u1');
    select count(*) into v_depois from estoque_unidade_eventos where unidade_id = pg_temp.hml_id('u1');
    v_ok := v_depois = v_antes;
    v_det := format('eventos antes=%s depois=%s (venda + edição de nome)', v_antes, v_depois);
    raise exception 'desfazer' using errcode = 'ZX000';
  exception when sqlstate 'ZX000' then null; when others then v_ok := false; v_det := 'erro inesperado: ' || sqlerrm;
  end;
  perform pg_temp.hml_registra('I2 Venda/edição sem troca de endereço não gera evento', v_ok, v_det);
end $$;

-- -----------------------------------------------------------------------------
-- J. Compatibilidade com chamadas antigas
-- -----------------------------------------------------------------------------
-- J1. Formato de chamada anterior à 068 (sem sinal, 3 ou 4 argumentos) cai
--     na regra do sinal — e não em erro de função ambígua/inexistente.
do $$
declare v_err3 text; v_err4 text;
begin
  begin
    perform reservar_unidade_estoque(p_unidade_id => pg_temp.hml_id('u3'), p_responsavel => 'Teste J1',
      p_ate => now() + interval '7 days');
    raise exception 'aceito' using errcode = 'ZX000';
  exception when sqlstate 'ZX000' then v_err3 := null; when others then v_err3 := sqlerrm;
  end;
  begin
    perform reservar_unidade_estoque(p_unidade_id => pg_temp.hml_id('u3'), p_responsavel => 'Teste J1',
      p_ate => now() + interval '7 days', p_cliente_id => pg_temp.hml_id('cliente'));
    raise exception 'aceito' using errcode = 'ZX000';
  exception when sqlstate 'ZX000' then v_err4 := null; when others then v_err4 := sqlerrm;
  end;
  perform pg_temp.hml_erro_esperado('J1a Chamada antiga de 3 argumentos', v_err3, '%Informe o valor do sinal pago%');
  perform pg_temp.hml_erro_esperado('J1b Chamada antiga de 4 argumentos', v_err4, '%Informe o valor do sinal pago%');
end $$;

-- J2. Chamadas atuais da API sem autoria (liberar 1 arg, arquivar 2 args,
--     restaurar 1 arg) continuam funcionando (executa e desfaz).
do $$
declare v_r estoque_reservas; v_u estoque_unidades; v_ok boolean := false; v_det text;
begin
  begin
    select * into v_r from reservar_unidade_estoque(p_unidade_id => pg_temp.hml_id('u2'), p_responsavel => 'Teste J2',
      p_ate => now() + interval '1 day', p_valor_sinal => 20.00, p_forma_pagamento_id => pg_temp.hml_id('forma_avista'));
    select * into v_r from liberar_reserva_estoque(p_reserva_id => v_r.id);
    select * into v_u from arquivar_unidade_estoque(p_unidade_id => pg_temp.hml_id('u2'), p_motivo => 'Teste J2');
    select * into v_u from restaurar_unidade_estoque(p_unidade_id => pg_temp.hml_id('u2'));
    v_ok := v_r.liberada_em is not null and v_r.liberada_por_nome is null and v_u.arquivada_em is null
      and exists (select 1 from estoque_unidade_eventos where unidade_id = pg_temp.hml_id('u2')
                  and tipo = 'arquivada' and usuario_nome is null);
    v_det := 'liberar/arquivar/restaurar sem autoria aceitos (autoria fica nula)';
    raise exception 'desfazer' using errcode = 'ZX000';
  exception when sqlstate 'ZX000' then null; when others then v_ok := false; v_det := 'erro inesperado: ' || sqlerrm;
  end;
  perform pg_temp.hml_registra('J2 Chamadas atuais da API sem autoria', v_ok, v_det);
end $$;

-- -----------------------------------------------------------------------------
-- K. Saldo da peça e arredondamento do sinal
-- -----------------------------------------------------------------------------
-- K1. Venda SEM p_unidade_id (orçamento/Mercado Livre) zera a quantidade mas
--     não marca nenhuma ficha como vendida → a ficha que sobrou não pode
--     receber sinal.
do $$
declare v_q int; v_ativas int; v_err text; v_pre text;
begin
  begin
    perform registrar_venda(p_estoque_id => pg_temp.hml_id('e7'), p_quantidade => 1, p_valor_unitario => 100.00,
      p_forma_pagamento_id => pg_temp.hml_id('forma_avista'), p_valor_recebido => null, p_cliente_nome => 'Homologação', p_observacoes => 'HML K1');
    select quantidade into v_q from estoque where id = pg_temp.hml_id('e7');
    select count(*) into v_ativas from estoque_unidades
      where estoque_id = pg_temp.hml_id('e7') and vendida_em is null and arquivada_em is null;
    -- Com a 069 aplicada, a própria venda baixa a ficha (baixa automática):
    -- aí a reserva cai na regra de unidade vendida.
    if to_regclass('public.estoque_baixas_automaticas') is not null and v_q = 0 and v_ativas = 0 then
      begin
        perform reservar_unidade_estoque(p_unidade_id => pg_temp.hml_id('e7u'), p_responsavel => 'Teste K1',
          p_ate => now() + interval '7 days', p_valor_sinal => 20.00, p_forma_pagamento_id => pg_temp.hml_id('forma_avista'));
        raise exception 'aceito' using errcode = 'ZX000';
      exception when sqlstate 'ZX000' then v_err := null; when others then v_err := sqlerrm;
      end;
      perform pg_temp.hml_erro_esperado('K1 Reserva em peça com quantidade 0 bloqueada (069: ficha baixada na venda)', v_err, '%vendida ou arquivada%');
      return;
    end if;
    if v_q <> 0 or v_ativas <> 1 then
      v_pre := format('pré-condição não atingida: quantidade=%s, fichas ativas=%s', v_q, v_ativas);
    end if;
  exception when others then v_pre := 'venda sem unidade falhou: ' || sqlerrm;
  end;
  if v_pre is not null then
    perform pg_temp.hml_registra('K1 Reserva em peça com quantidade 0 bloqueada', false, v_pre);
    return;
  end if;
  begin
    perform reservar_unidade_estoque(p_unidade_id => pg_temp.hml_id('e7u'), p_responsavel => 'Teste K1',
      p_ate => now() + interval '7 days', p_valor_sinal => 20.00, p_forma_pagamento_id => pg_temp.hml_id('forma_avista'));
    raise exception 'aceito' using errcode = 'ZX000';
  exception when sqlstate 'ZX000' then v_err := null; when others then v_err := sqlerrm;
  end;
  perform pg_temp.hml_erro_esperado('K1 Reserva em peça com quantidade 0 bloqueada', v_err,
    '%Sem estoque disponível: a quantidade da peça já está vendida ou reservada%');
end $$;

-- K2. Sinal de R$ 0,004 numa unidade de R$ 0,01: arredonda para R$ 0,00 e
--     deve cair na mensagem de sinal (não em violação de constraint).
do $$
declare v_err text;
begin
  begin
    perform reservar_unidade_estoque(p_unidade_id => pg_temp.hml_id('e8u'), p_responsavel => 'Teste K2',
      p_ate => now() + interval '7 days', p_valor_sinal => 0.004, p_forma_pagamento_id => pg_temp.hml_id('forma_avista'));
    raise exception 'aceito' using errcode = 'ZX000';
  exception when sqlstate 'ZX000' then v_err := null; when others then v_err := sqlerrm;
  end;
  if v_err ilike '%violates check constraint%' or v_err ilike '%viola a restrição%' then
    perform pg_temp.hml_registra('K2 Sinal de R$ 0,004 em unidade de R$ 0,01', false, 'erro de constraint: ' || v_err);
  else
    perform pg_temp.hml_erro_esperado('K2 Sinal de R$ 0,004 em unidade de R$ 0,01', v_err, '%Sinal abaixo de 20%R$ 0,01%');
  end if;
end $$;

-- K3. Segunda reserva numa peça de 1 unidade (E3, já reservada) deve dizer
--     que a unidade já está reservada — não "Sem estoque disponível".
do $$
declare v_err text;
begin
  begin
    perform reservar_unidade_estoque(p_unidade_id => pg_temp.hml_id('e3u'), p_responsavel => 'Teste K3',
      p_ate => now() + interval '7 days', p_valor_sinal => 10.00, p_forma_pagamento_id => pg_temp.hml_id('forma_avista'));
    raise exception 'aceito' using errcode = 'ZX000';
  exception when sqlstate 'ZX000' then v_err := null; when others then v_err := sqlerrm;
  end;
  perform pg_temp.hml_erro_esperado('K3 Segunda reserva em peça de 1 unidade', v_err, '%Esta unidade já está reservada%');
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
    case when v_fail = 0 then 'HOMOLOGAÇÃO APROVADA' else 'REVISAR OS FAIL ACIMA' end;
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
