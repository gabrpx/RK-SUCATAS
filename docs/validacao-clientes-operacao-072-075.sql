-- =============================================================================
-- Validação manual — Clientes operacional (migrations 072–075)
-- =============================================================================
-- Este roteiro NÃO é migration. Execute em homologação, uma seção por vez,
-- somente depois de autorização explícita para aplicar a migration correspondente.
-- A seção da 072 usa uma transação e termina em ROLLBACK.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Sequência aplicada e perfil ANTES da 072
-- -----------------------------------------------------------------------------
-- Confirme no histórico do ambiente que a migration 071 de Vendas foi aplicada
-- antes da 072. O repositório reserva 072–075 para Clientes.

select status, count(*) as quantidade
from public.pecas_procuradas
group by status
order by status;

select id, cliente_id, descricao, status, criado_em, atendida_em
from public.pecas_procuradas
where status in ('aguardando', 'atendida', 'cancelada')
order by criado_em desc
limit 30;

-- `atendida` é histórico terminal: não inferir que significa apenas
-- "peça encontrada" e não reescrever essas linhas na 072.

-- -----------------------------------------------------------------------------
-- 1. Estrutura criada pela 072
-- -----------------------------------------------------------------------------
select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and (
    (table_name = 'clientes' and column_name in ('instagram_usuario','cep','logradouro','numero','complemento','bairro'))
    or (table_name = 'clientes_motos' and column_name in ('principal','modelo_texto'))
    or (table_name = 'pecas_procuradas' and column_name in (
      'cliente_moto_id','moto_modelo_texto','ano_compatibilidade','observacoes',
      'responsavel_id','prometido_para','ultima_acao','ultima_acao_em',
      'proxima_acao_em','encerrada_em','atualizado_em','idempotency_key','venda_id'
    ))
  )
order by table_name, column_name;

select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('clientes_eventos', 'pecas_procuradas_eventos');

select indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and indexname in (
    'idx_clientes_telefone_preenchido',
    'idx_clientes_instagram_normalizado',
    'idx_clientes_motos_principal_unica',
    'idx_pecas_procuradas_idempotencia_criador',
    'idx_pecas_procuradas_responsavel_ativas',
    'idx_clientes_eventos_cliente_data',
    'idx_pecas_procuradas_eventos_pedido_data'
  )
order by indexname;

select p.proname, p.prosecdef, p.proconfig
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'registrar_cliente_com_pedido',
    'definir_moto_principal',
    'transicionar_pedido_busca',
    'registrar_acao_pedido',
    'corrigir_origem_cliente'
  )
order by p.proname;

-- Esperado: prosecdef=false (SECURITY INVOKER) e proconfig contém search_path="".

-- -----------------------------------------------------------------------------
-- 2. Grants: navegador negado, backend autorizado
-- -----------------------------------------------------------------------------
select
  has_table_privilege('anon', 'public.clientes_eventos', 'select,insert,update,delete') as anon_clientes_eventos,
  has_table_privilege('authenticated', 'public.clientes_eventos', 'select,insert,update,delete') as auth_clientes_eventos,
  has_table_privilege('anon', 'public.pecas_procuradas_eventos', 'select,insert,update,delete') as anon_pedidos_eventos,
  has_table_privilege('authenticated', 'public.pecas_procuradas_eventos', 'select,insert,update,delete') as auth_pedidos_eventos;

select
  has_function_privilege('anon', 'public.registrar_cliente_com_pedido(jsonb,jsonb,uuid)', 'execute') as anon_executa,
  has_function_privilege('authenticated', 'public.registrar_cliente_com_pedido(jsonb,jsonb,uuid)', 'execute') as auth_executa,
  has_function_privilege('service_role', 'public.registrar_cliente_com_pedido(jsonb,jsonb,uuid)', 'execute') as backend_executa;

-- Esperado: todos os acessos anon/authenticated = false; backend_executa = true.

-- -----------------------------------------------------------------------------
-- 3. Casos transacionais da 072 — HOMOLOGAÇÃO, termina em ROLLBACK
-- -----------------------------------------------------------------------------
begin;

do $$
declare
  v_usuario_id uuid;
  v_modelo_id uuid;
  v_primeiro jsonb;
  v_repetido jsonb;
  v_separado_a jsonb;
  v_separado_b jsonb;
  v_texto_livre jsonb;
  v_cliente_id uuid;
  v_pedido_id uuid;
  v_segunda_moto_id uuid;
  v_pedido_atual public.pecas_procuradas;
  v_clientes_antes bigint;
  v_clientes_depois bigint;
begin
  select id into v_usuario_id
  from public.usuarios
  where ativo = true
  order by criado_em
  limit 1;
  if v_usuario_id is null then
    raise exception 'Crie ou ative um usuário de homologação antes desta seção';
  end if;

  -- Cliente + moto em texto livre + pedido são uma única transação.
  v_primeiro := public.registrar_cliente_com_pedido(
    jsonb_build_object(
      'nome', 'Validação Clientes 072',
      'telefone', '(83) 99999-0001',
      'origem', 'whatsapp',
      'preferencia_contato', 'whatsapp',
      'cidade', 'Campina Grande',
      'estado', 'PB',
      'moto', jsonb_build_object('modelo_texto', 'Moto teste fora do catálogo')
    ),
    jsonb_build_object(
      'descricao', 'Farol para validação',
      'moto_modelo_texto', 'Moto teste fora do catálogo',
      'ano_compatibilidade', '2024',
      'idempotency_key', 'validacao-072-idempotente'
    ),
    v_usuario_id
  );

  v_repetido := public.registrar_cliente_com_pedido(
    jsonb_build_object(
      'nome', 'Este nome não pode gerar duplicata',
      'telefone', '83999990002',
      'origem', 'balcao',
      'preferencia_contato', 'whatsapp',
      'cidade', 'João Pessoa',
      'estado', 'PB'
    ),
    jsonb_build_object(
      'descricao', 'Outro texto que deve ser ignorado no retry',
      'moto_modelo_texto', 'Outra moto',
      'idempotency_key', 'validacao-072-idempotente'
    ),
    v_usuario_id
  );

  if v_primeiro->'cliente'->>'id' is distinct from v_repetido->'cliente'->>'id'
    or v_primeiro->'pedido'->>'id' is distinct from v_repetido->'pedido'->>'id' then
    raise exception 'Falha: retry idempotente criou outro resultado';
  end if;

  v_cliente_id := (v_primeiro->'cliente'->>'id')::uuid;
  v_pedido_id := (v_primeiro->'pedido'->>'id')::uuid;

  if (select count(*) from public.clientes_motos where cliente_id = v_cliente_id and principal) <> 1 then
    raise exception 'Falha: cliente não ficou com exatamente uma moto principal';
  end if;
  if (select count(*) from public.pecas_procuradas_eventos where pedido_id = v_pedido_id and tipo = 'pedido_criado') <> 1 then
    raise exception 'Falha: evento de criação do pedido ausente ou duplicado';
  end if;

  -- Troca de principal mantém exatamente uma moto marcada.
  insert into public.clientes_motos (cliente_id, modelo_texto, principal)
  values (v_cliente_id, 'Segunda moto de validação', false)
  returning id into v_segunda_moto_id;
  perform public.definir_moto_principal(v_cliente_id, v_segunda_moto_id);
  if (select count(*) from public.clientes_motos where cliente_id = v_cliente_id and principal) <> 1
    or not exists (select 1 from public.clientes_motos where id = v_segunda_moto_id and principal) then
    raise exception 'Falha: troca de moto principal violou a unicidade';
  end if;

  -- Ação e transição mudam estado e evento na mesma chamada.
  v_pedido_atual := public.registrar_acao_pedido(v_pedido_id, 'iniciar_busca', v_usuario_id, '{}'::jsonb);
  if v_pedido_atual.status <> 'em_busca' then raise exception 'Falha: iniciar busca não mudou o estado'; end if;
  v_pedido_atual := public.transicionar_pedido_busca(v_pedido_id, 'nao_encontrada', v_usuario_id, 'Validação do encerramento');
  if v_pedido_atual.status <> 'nao_encontrada' or v_pedido_atual.encerrada_em is null then
    raise exception 'Falha: encerramento do pedido não foi atômico';
  end if;
  v_pedido_atual := public.transicionar_pedido_busca(v_pedido_id, 'em_busca', v_usuario_id, 'Reabertura de validação');
  if v_pedido_atual.status <> 'em_busca' or v_pedido_atual.encerrada_em is not null then
    raise exception 'Falha: reabertura do pedido não limpou o encerramento';
  end if;

  perform public.corrigir_origem_cliente(v_cliente_id, 'facebook', v_usuario_id, 'Validação de auditoria');
  if not exists (
    select 1 from public.clientes_eventos
    where cliente_id = v_cliente_id and tipo = 'origem_corrigida'
  ) then
    raise exception 'Falha: correção de origem não gerou evento';
  end if;

  -- Contato compartilhado é permitido quando a equipe confirma cadastros separados.
  v_separado_a := public.registrar_cliente_com_pedido(
    jsonb_build_object(
      'nome', 'Contato compartilhado A', 'telefone', '83988887777',
      'origem', 'indicacao', 'preferencia_contato', 'whatsapp',
      'cidade', 'Campina Grande', 'estado', 'PB',
      'duplicidade_decisao', 'confirmada_separada',
      'duplicidade_criterios', jsonb_build_array('whatsapp')
    ),
    jsonb_build_object(
      'descricao', 'Peça A', 'moto_modelo_texto', 'CG 160',
      'idempotency_key', 'validacao-072-compartilhado-a'
    ),
    v_usuario_id
  );
  v_separado_b := public.registrar_cliente_com_pedido(
    jsonb_build_object(
      'nome', 'Contato compartilhado B', 'telefone', '83988887777',
      'origem', 'indicacao', 'preferencia_contato', 'whatsapp',
      'cidade', 'Campina Grande', 'estado', 'PB',
      'duplicidade_decisao', 'confirmada_separada',
      'duplicidade_criterios', jsonb_build_array('whatsapp')
    ),
    jsonb_build_object(
      'descricao', 'Peça B', 'moto_modelo_texto', 'Biz 125',
      'idempotency_key', 'validacao-072-compartilhado-b'
    ),
    v_usuario_id
  );
  if v_separado_a->'cliente'->>'id' = v_separado_b->'cliente'->>'id' then
    raise exception 'Falha: contatos compartilhados foram fundidos';
  end if;

  -- Quando houver modelo no catálogo, também deve aceitar a FK e manter snapshot.
  select id into v_modelo_id from public.modelos_moto order by criado_em limit 1;
  if v_modelo_id is not null then
    v_texto_livre := public.registrar_cliente_com_pedido(
      jsonb_build_object(
        'nome', 'Validação catálogo 072', 'instagram_usuario', '@validacao_072',
        'origem', 'instagram', 'preferencia_contato', 'instagram',
        'cidade', 'Recife', 'estado', 'PE',
        'moto', jsonb_build_object('modelo_moto_id', v_modelo_id)
      ),
      jsonb_build_object(
        'descricao', 'Peça com modelo de catálogo',
        'modelo_moto_id', v_modelo_id,
        'idempotency_key', 'validacao-072-modelo-fk'
      ),
      v_usuario_id
    );
    if nullif(v_texto_livre->'pedido'->>'moto_modelo_texto', '') is null then
      raise exception 'Falha: snapshot textual do modelo não foi preenchido';
    end if;
  end if;

  -- Uma falha no pedido deve desfazer a criação do cliente no sub-bloco.
  select count(*) into v_clientes_antes from public.clientes;
  begin
    perform public.registrar_cliente_com_pedido(
      jsonb_build_object(
        'nome', 'Não pode ficar órfão', 'telefone', '83977776666',
        'origem', 'whatsapp', 'preferencia_contato', 'whatsapp',
        'cidade', 'Patos', 'estado', 'PB'
      ),
      jsonb_build_object(
        'descricao', '', 'moto_modelo_texto', 'CG 125',
        'idempotency_key', 'validacao-072-falha-atomica'
      ),
      v_usuario_id
    );
    raise exception 'Falha: pedido inválido foi aceito';
  exception when others then
    if sqlerrm = 'Falha: pedido inválido foi aceito' then raise; end if;
  end;
  select count(*) into v_clientes_depois from public.clientes;
  if v_clientes_antes <> v_clientes_depois then
    raise exception 'Falha: cliente órfão permaneceu após erro do pedido';
  end if;
end;
$$;

-- Estados legados continuam presentes e válidos; nenhum foi reescrito.
select status, count(*)
from public.pecas_procuradas
where status in ('aguardando', 'atendida', 'cancelada')
group by status
order by status;

rollback;

-- Resultado esperado: bloco DO sem exceção e nenhuma linha de validação
-- persistida, pois a transação termina em ROLLBACK.
