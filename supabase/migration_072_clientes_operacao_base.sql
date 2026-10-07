  -- =============================================================================
  -- RK Sucatas — Migração 072: base operacional de Clientes
  -- =============================================================================
  -- EXPANSÃO SOMENTE. Preserva os estados e cadastros legados; não reinterpreta
  -- `atendida`, não remove colunas e não aplica regras novas ao CRUD antigo.
  --
  -- Ordem reservada: 071 pertence ao plano de Vendas. Antes de aplicar esta
  -- migration, confirme no ambiente alvo que 071 foi aplicada e execute primeiro
  -- em homologação. Este arquivo, por si só, NÃO autoriza aplicação em produção.
  -- =============================================================================

  begin;

  -- 1. Contatos e endereço -------------------------------------------------------
  alter table public.clientes
    add column if not exists instagram_usuario text,
    add column if not exists cep text,
    add column if not exists logradouro text,
    add column if not exists numero text,
    add column if not exists complemento text,
    add column if not exists bairro text;

  alter table public.clientes drop constraint if exists clientes_origem_check;
  alter table public.clientes add constraint clientes_origem_check check (
    origem is null or origem in (
      'whatsapp', 'facebook', 'mercado_livre', 'instagram', 'indicacao', 'balcao',
      'redes_sociais', 'outro'
    )
  );

  alter table public.clientes drop constraint if exists clientes_preferencia_contato_check;
  alter table public.clientes add constraint clientes_preferencia_contato_check check (
    preferencia_contato is null or preferencia_contato in (
      'whatsapp', 'instagram', 'ligacao', 'sms', 'nenhuma'
    )
  );

  create index if not exists idx_clientes_telefone_preenchido
    on public.clientes (telefone)
    where telefone is not null;
  create index if not exists idx_clientes_instagram_normalizado
    on public.clientes (lower(instagram_usuario))
    where instagram_usuario is not null;

  -- 2. Moto principal e nome fora do catálogo ----------------------------------
  alter table public.clientes_motos
    add column if not exists principal boolean not null default false,
    add column if not exists modelo_texto text;

  update public.clientes_motos cm
  set modelo_texto = nullif(btrim(mm.nome), '')
  from public.modelos_moto mm
  where mm.id = cm.modelo_moto_id
    and cm.modelo_texto is null;

  with motos_ordenadas as (
    select
      id,
      row_number() over (partition by cliente_id order by criado_em asc, id asc) as posicao
    from public.clientes_motos
  )
  update public.clientes_motos cm
  set principal = (mo.posicao = 1)
  from motos_ordenadas mo
  where mo.id = cm.id;

  create unique index if not exists idx_clientes_motos_principal_unica
    on public.clientes_motos (cliente_id)
    where principal;
  create index if not exists idx_clientes_motos_modelo_texto
    on public.clientes_motos (lower(modelo_texto))
    where modelo_texto is not null;

  -- Registros antigos sem modelo continuam válidos. A exigência de FK ou texto
  -- é aplicada nas RPCs abaixo e na API nova, evitando quebrar a edição do legado.

  -- 3. Pedido em busca expandido ------------------------------------------------
  alter table public.pecas_procuradas
    add column if not exists cliente_moto_id uuid references public.clientes_motos(id) on delete set null,
    add column if not exists moto_modelo_texto text,
    add column if not exists ano_compatibilidade text,
    add column if not exists observacoes text,
    add column if not exists responsavel_id uuid references public.usuarios(id) on delete restrict,
    add column if not exists prometido_para timestamptz,
    add column if not exists ultima_acao text,
    add column if not exists ultima_acao_em timestamptz,
    add column if not exists proxima_acao_em timestamptz,
    add column if not exists encerrada_em timestamptz,
    add column if not exists atualizado_em timestamptz not null default now(),
    add column if not exists idempotency_key text,
    add column if not exists venda_id uuid references public.vendas(id) on delete set null;

  alter table public.pecas_procuradas drop constraint if exists pecas_procuradas_status_check;
  alter table public.pecas_procuradas add constraint pecas_procuradas_status_check check (
    status in (
      'nova', 'em_busca', 'peca_disponivel', 'aguardando_cliente', 'vendida',
      'nao_encontrada', 'cliente_desistiu', 'cancelada',
      'aguardando', 'atendida'
    )
  );

  update public.pecas_procuradas
  set responsavel_id = criado_por
  where responsavel_id is null;

  update public.pecas_procuradas pp
  set moto_modelo_texto = coalesce(
    nullif(btrim(cm.modelo_texto), ''),
    nullif(btrim(mm_cliente.nome), '')
  )
  from public.clientes_motos cm
  left join public.modelos_moto mm_cliente on mm_cliente.id = cm.modelo_moto_id
  where cm.id = pp.cliente_moto_id
    and pp.moto_modelo_texto is null;

  update public.pecas_procuradas pp
  set moto_modelo_texto = nullif(btrim(mm.nome), '')
  from public.modelos_moto mm
  where mm.id = pp.modelo_moto_id
    and pp.moto_modelo_texto is null;

  create unique index if not exists idx_pecas_procuradas_idempotencia_criador
    on public.pecas_procuradas (criado_por, idempotency_key)
    where idempotency_key is not null;
  create index if not exists idx_pecas_procuradas_responsavel_ativas
    on public.pecas_procuradas (
      responsavel_id,
      (coalesce(proxima_acao_em, prometido_para, criado_em))
    )
    where status in ('nova', 'em_busca', 'peca_disponivel', 'aguardando_cliente', 'aguardando');
  create index if not exists idx_pecas_procuradas_cliente_moto
    on public.pecas_procuradas (cliente_moto_id)
    where cliente_moto_id is not null;
  create index if not exists idx_pecas_procuradas_venda
    on public.pecas_procuradas (venda_id)
    where venda_id is not null;

  drop trigger if exists trg_pecas_procuradas_atualizado_em on public.pecas_procuradas;
  create trigger trg_pecas_procuradas_atualizado_em
    before update on public.pecas_procuradas
    for each row execute function public.set_atualizado_em();

  -- 4. Eventos auditáveis -------------------------------------------------------
  create table if not exists public.clientes_eventos (
    id uuid primary key default gen_random_uuid(),
    cliente_id uuid not null references public.clientes(id) on delete cascade,
    tipo text not null check (tipo in (
      'cliente_criado', 'origem_corrigida', 'duplicidade_sugerida',
      'duplicidade_reutilizada', 'duplicidade_confirmada_separada'
    )),
    detalhe jsonb not null default '{}'::jsonb,
    criado_por uuid references public.usuarios(id) on delete restrict,
    criado_em timestamptz not null default now()
  );

  create table if not exists public.pecas_procuradas_eventos (
    id uuid primary key default gen_random_uuid(),
    pedido_id uuid not null references public.pecas_procuradas(id) on delete cascade,
    tipo text not null check (tipo in ('pedido_criado', 'estado_alterado', 'acao_registrada')),
    estado_anterior text,
    estado_novo text,
    acao text,
    motivo text,
    detalhe jsonb not null default '{}'::jsonb,
    criado_por uuid references public.usuarios(id) on delete restrict,
    criado_em timestamptz not null default now()
  );

  create index if not exists idx_clientes_eventos_cliente_data
    on public.clientes_eventos (cliente_id, criado_em desc);
  create index if not exists idx_pecas_procuradas_eventos_pedido_data
    on public.pecas_procuradas_eventos (pedido_id, criado_em desc);

  alter table public.clientes_eventos enable row level security;
  alter table public.pecas_procuradas_eventos enable row level security;
  revoke all on table public.clientes_eventos, public.pecas_procuradas_eventos from public, anon, authenticated;

  -- 5. Uma moto principal por cliente ------------------------------------------
  create or replace function public.definir_moto_principal(
    p_cliente_id uuid,
    p_moto_id uuid
  ) returns public.clientes_motos
  language plpgsql
  security invoker
  set search_path = ''
  as $$
  declare
    v_moto public.clientes_motos;
  begin
    perform 1
    from public.clientes
    where id = p_cliente_id
    for update;
    if not found then
      raise exception 'Cliente não encontrado';
    end if;

    select * into v_moto
    from public.clientes_motos
    where id = p_moto_id and cliente_id = p_cliente_id
    for update;
    if v_moto.id is null then
      raise exception 'Moto não pertence ao cliente';
    end if;

    update public.clientes_motos
    set principal = false
    where cliente_id = p_cliente_id and principal;
    update public.clientes_motos
    set principal = true
    where id = p_moto_id;

    select * into v_moto from public.clientes_motos where id = p_moto_id;
    return v_moto;
  end;
  $$;

  -- 6. Criação atômica e idempotente de cliente + pedido ------------------------
  create or replace function public.registrar_cliente_com_pedido(
    p_cliente jsonb,
    p_pedido jsonb,
    p_usuario_id uuid
  ) returns jsonb
  language plpgsql
  security invoker
  set search_path = ''
  as $$
  declare
    v_cliente public.clientes;
    v_pedido public.pecas_procuradas;
    v_moto public.clientes_motos;
    v_idempotency_key text := nullif(btrim(coalesce(p_pedido->>'idempotency_key', '')), '');
    v_cliente_id uuid;
    v_cliente_moto_id uuid;
    v_modelo_moto_id uuid;
    v_categoria_id uuid;
    v_nome text := btrim(coalesce(p_cliente->>'nome', ''));
    v_telefone text := nullif(regexp_replace(coalesce(p_cliente->>'telefone', ''), '\D', '', 'g'), '');
    v_instagram text := nullif(lower(ltrim(btrim(coalesce(p_cliente->>'instagram_usuario', '')), '@')), '');
    v_origem text := nullif(p_cliente->>'origem', '');
    v_preferencia text := nullif(p_cliente->>'preferencia_contato', '');
    v_cidade text := nullif(btrim(coalesce(p_cliente->>'cidade', '')), '');
    v_estado text := upper(nullif(btrim(coalesce(p_cliente->>'estado', '')), ''));
    v_descricao text := btrim(coalesce(p_pedido->>'descricao', ''));
    v_moto_texto text := nullif(btrim(coalesce(p_pedido->>'moto_modelo_texto', '')), '');
    v_decisao_duplicidade text := nullif(p_cliente->>'duplicidade_decisao', '');
    v_criterios jsonb := '[]'::jsonb;
    v_moto_json jsonb := coalesce(p_cliente->'moto', '{}'::jsonb);
  begin
    if p_usuario_id is null then
      raise exception 'Usuário responsável é obrigatório';
    end if;
    if v_idempotency_key is null or length(v_idempotency_key) > 120 then
      raise exception 'Chave de idempotência é obrigatória e deve ter até 120 caracteres';
    end if;

    -- Serializa repetições concorrentes da mesma ação. A chamada perdedora vê
    -- o pedido criado pela primeira e devolve o mesmo resultado, sem cliente órfão.
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(p_usuario_id::text || ':' || v_idempotency_key, 0)
    );

    select * into v_pedido
    from public.pecas_procuradas
    where criado_por = p_usuario_id and idempotency_key = v_idempotency_key;
    if v_pedido.id is not null then
      select * into v_cliente from public.clientes where id = v_pedido.cliente_id;
      return pg_catalog.jsonb_build_object('cliente', pg_catalog.to_jsonb(v_cliente), 'pedido', pg_catalog.to_jsonb(v_pedido));
    end if;

    if jsonb_typeof(coalesce(p_cliente->'duplicidade_criterios', '[]'::jsonb)) = 'array' then
      select coalesce(jsonb_agg(criterio), '[]'::jsonb) into v_criterios
      from jsonb_array_elements_text(p_cliente->'duplicidade_criterios') as criterios(criterio)
      where criterio in ('nome', 'whatsapp', 'instagram');
    end if;

    if nullif(p_cliente->>'id', '') is not null then
      v_cliente_id := (p_cliente->>'id')::uuid;
      select * into v_cliente from public.clientes where id = v_cliente_id for update;
      if v_cliente.id is null then raise exception 'Cliente não encontrado'; end if;
      if v_cliente.banido then raise exception 'Cliente bloqueado não pode registrar novo pedido'; end if;

      -- O cadastro legado continua consultável incompleto, mas ao registrar um
      -- novo pedido a equipe precisa completar os mínimos aprovados. Origem já
      -- preenchida é preservada; correção posterior usa a RPC administrativa.
      v_telefone := coalesce(v_telefone, v_cliente.telefone);
      v_instagram := coalesce(v_instagram, v_cliente.instagram_usuario);
      v_preferencia := coalesce(v_preferencia, v_cliente.preferencia_contato);
      v_cidade := coalesce(v_cidade, v_cliente.cidade);
      v_estado := coalesce(v_estado, v_cliente.estado);
      v_origem := coalesce(v_cliente.origem, v_origem);
      if v_telefone is null and v_instagram is null then raise exception 'Informe WhatsApp ou Instagram'; end if;
      if v_preferencia = 'whatsapp' and v_telefone is null then raise exception 'Informe o WhatsApp escolhido como contato'; end if;
      if v_preferencia = 'instagram' and v_instagram is null then raise exception 'Informe o Instagram escolhido como contato'; end if;
      if v_preferencia not in ('whatsapp', 'instagram') then raise exception 'Escolha WhatsApp ou Instagram como contato'; end if;
      if v_cidade is null or v_estado is null then raise exception 'Cidade e estado são obrigatórios'; end if;
      if v_estado not in ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO') then
        raise exception 'Estado inválido';
      end if;
      if v_origem is null then raise exception 'Origem é obrigatória'; end if;

      update public.clientes
      set
        telefone = v_telefone,
        instagram_usuario = v_instagram,
        preferencia_contato = v_preferencia,
        cidade = v_cidade,
        estado = v_estado,
        origem = v_origem,
        cep = coalesce(nullif(regexp_replace(coalesce(p_cliente->>'cep', ''), '\D', '', 'g'), ''), cep),
        logradouro = coalesce(nullif(btrim(coalesce(p_cliente->>'logradouro', '')), ''), logradouro),
        numero = coalesce(nullif(btrim(coalesce(p_cliente->>'numero', '')), ''), numero),
        complemento = coalesce(nullif(btrim(coalesce(p_cliente->>'complemento', '')), ''), complemento),
        bairro = coalesce(nullif(btrim(coalesce(p_cliente->>'bairro', '')), ''), bairro)
      where id = v_cliente.id
      returning * into v_cliente;

      if v_decisao_duplicidade in ('sugerida', 'reutilizada') then
        insert into public.clientes_eventos (cliente_id, tipo, detalhe, criado_por)
        values (
          v_cliente.id,
          case when v_decisao_duplicidade = 'sugerida' then 'duplicidade_sugerida' else 'duplicidade_reutilizada' end,
          pg_catalog.jsonb_build_object('criterios', v_criterios),
          p_usuario_id
        );
      end if;
    else
      if length(v_nome) < 2 then raise exception 'Nome do cliente é obrigatório'; end if;
      if v_telefone is null and v_instagram is null then raise exception 'Informe WhatsApp ou Instagram'; end if;
      if v_preferencia = 'whatsapp' and v_telefone is null then raise exception 'Informe o WhatsApp escolhido como contato'; end if;
      if v_preferencia = 'instagram' and v_instagram is null then raise exception 'Informe o Instagram escolhido como contato'; end if;
      if v_preferencia not in ('whatsapp', 'instagram') then raise exception 'Escolha WhatsApp ou Instagram como contato'; end if;
      if v_cidade is null or v_estado is null then raise exception 'Cidade e estado são obrigatórios'; end if;
      if v_estado not in ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO') then
        raise exception 'Estado inválido';
      end if;
      if v_origem not in ('whatsapp', 'facebook', 'mercado_livre', 'instagram', 'indicacao', 'balcao') then
        raise exception 'Origem inválida';
      end if;

      insert into public.clientes (
        nome, telefone, instagram_usuario, documento, data_nascimento, origem,
        preferencia_contato, tags, observacoes, cidade, estado,
        cep, logradouro, numero, complemento, bairro
      ) values (
        v_nome,
        v_telefone,
        v_instagram,
        nullif(regexp_replace(coalesce(p_cliente->>'documento', ''), '\D', '', 'g'), ''),
        nullif(p_cliente->>'data_nascimento', '')::date,
        v_origem,
        v_preferencia,
        case
          when jsonb_typeof(coalesce(p_cliente->'tags', '[]'::jsonb)) = 'array'
            then array(select jsonb_array_elements_text(p_cliente->'tags'))
          else '{}'::text[]
        end,
        nullif(btrim(coalesce(p_cliente->>'observacoes', '')), ''),
        v_cidade,
        v_estado,
        nullif(regexp_replace(coalesce(p_cliente->>'cep', ''), '\D', '', 'g'), ''),
        nullif(btrim(coalesce(p_cliente->>'logradouro', '')), ''),
        nullif(btrim(coalesce(p_cliente->>'numero', '')), ''),
        nullif(btrim(coalesce(p_cliente->>'complemento', '')), ''),
        nullif(btrim(coalesce(p_cliente->>'bairro', '')), '')
      ) returning * into v_cliente;

      insert into public.clientes_eventos (cliente_id, tipo, detalhe, criado_por)
      values (v_cliente.id, 'cliente_criado', pg_catalog.jsonb_build_object('origem', v_origem), p_usuario_id);

      if v_decisao_duplicidade = 'confirmada_separada' then
        insert into public.clientes_eventos (cliente_id, tipo, detalhe, criado_por)
        values (
          v_cliente.id,
          'duplicidade_confirmada_separada',
          pg_catalog.jsonb_build_object('criterios', v_criterios),
          p_usuario_id
        );
      end if;
    end if;

    if jsonb_typeof(v_moto_json) = 'object' and v_moto_json <> '{}'::jsonb then
      v_modelo_moto_id := nullif(v_moto_json->>'modelo_moto_id', '')::uuid;
      v_moto_texto := coalesce(
        nullif(btrim(coalesce(v_moto_json->>'modelo_texto', '')), ''),
        v_moto_texto
      );
      if v_modelo_moto_id is null and v_moto_texto is null then
        raise exception 'Informe o modelo da moto pelo catálogo ou em texto livre';
      end if;
      if v_modelo_moto_id is not null and v_moto_texto is null then
        select nullif(btrim(nome), '') into v_moto_texto from public.modelos_moto where id = v_modelo_moto_id;
        if v_moto_texto is null then raise exception 'Modelo de moto não encontrado'; end if;
      end if;

      insert into public.clientes_motos (
        cliente_id, modelo_moto_id, modelo_texto, placa, chassi, ano, cor,
        observacoes, principal
      ) values (
        v_cliente.id,
        v_modelo_moto_id,
        v_moto_texto,
        nullif(btrim(coalesce(v_moto_json->>'placa', '')), ''),
        nullif(btrim(coalesce(v_moto_json->>'chassi', '')), ''),
        nullif(btrim(coalesce(v_moto_json->>'ano', '')), ''),
        nullif(btrim(coalesce(v_moto_json->>'cor', '')), ''),
        nullif(btrim(coalesce(v_moto_json->>'observacoes', '')), ''),
        not exists (select 1 from public.clientes_motos where cliente_id = v_cliente.id and principal)
      ) returning * into v_moto;
      v_cliente_moto_id := v_moto.id;
    elsif nullif(p_pedido->>'cliente_moto_id', '') is not null then
      v_cliente_moto_id := (p_pedido->>'cliente_moto_id')::uuid;
      select * into v_moto
      from public.clientes_motos
      where id = v_cliente_moto_id and cliente_id = v_cliente.id;
      if v_moto.id is null then raise exception 'Moto não pertence ao cliente'; end if;
      v_modelo_moto_id := v_moto.modelo_moto_id;
      v_moto_texto := coalesce(nullif(btrim(v_moto.modelo_texto), ''), v_moto_texto);
    else
      v_modelo_moto_id := nullif(p_pedido->>'modelo_moto_id', '')::uuid;
    end if;

    if v_modelo_moto_id is not null and v_moto_texto is null then
      select nullif(btrim(nome), '') into v_moto_texto from public.modelos_moto where id = v_modelo_moto_id;
      if v_moto_texto is null then raise exception 'Modelo de moto não encontrado'; end if;
    end if;
    if v_moto_texto is null then raise exception 'Informe a moto do pedido'; end if;
    if v_descricao = '' then raise exception 'Descrição da peça é obrigatória'; end if;

    v_categoria_id := nullif(p_pedido->>'categoria_id', '')::uuid;
    insert into public.pecas_procuradas (
      cliente_id, cliente_nome, descricao, categoria_id, modelo_moto_id,
      cliente_moto_id, moto_modelo_texto, ano_compatibilidade, observacoes,
      status, criado_por, responsavel_id, prometido_para,
      ultima_acao, ultima_acao_em, proxima_acao_em, idempotency_key
    ) values (
      v_cliente.id,
      v_cliente.nome,
      v_descricao,
      v_categoria_id,
      v_modelo_moto_id,
      v_cliente_moto_id,
      v_moto_texto,
      nullif(btrim(coalesce(p_pedido->>'ano_compatibilidade', '')), ''),
      nullif(btrim(coalesce(p_pedido->>'observacoes', '')), ''),
      'nova',
      p_usuario_id,
      coalesce(nullif(p_pedido->>'responsavel_id', '')::uuid, p_usuario_id),
      nullif(p_pedido->>'prometido_para', '')::timestamptz,
      'registrar',
      now(),
      null,
      v_idempotency_key
    ) returning * into v_pedido;

    insert into public.pecas_procuradas_eventos (
      pedido_id, tipo, estado_novo, acao, criado_por
    ) values (
      v_pedido.id, 'pedido_criado', 'nova', 'registrar', p_usuario_id
    );

    return pg_catalog.jsonb_build_object('cliente', pg_catalog.to_jsonb(v_cliente), 'pedido', pg_catalog.to_jsonb(v_pedido));
  end;
  $$;

  -- 7. Transições e ações auditadas --------------------------------------------
  create or replace function public.transicionar_pedido_busca(
    p_pedido_id uuid,
    p_novo_status text,
    p_usuario_id uuid,
    p_motivo text default null,
    p_venda_id uuid default null
  ) returns public.pecas_procuradas
  language plpgsql
  security invoker
  set search_path = ''
  as $$
  declare
    v_pedido public.pecas_procuradas;
    v_anterior text;
    v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
    v_venda_cliente_id uuid;
  begin
    if p_usuario_id is null then raise exception 'Usuário responsável é obrigatório'; end if;
    select * into v_pedido from public.pecas_procuradas where id = p_pedido_id for update;
    if v_pedido.id is null then raise exception 'Pedido não encontrado'; end if;
    v_anterior := v_pedido.status;

    if p_novo_status = 'vendida' then
      if v_anterior not in ('nova', 'em_busca', 'peca_disponivel', 'aguardando_cliente', 'aguardando') then
        raise exception 'Transição inválida: % para vendida', v_anterior;
      end if;
      if p_venda_id is null then raise exception 'Venda vinculada é obrigatória'; end if;
      select cliente_id into v_venda_cliente_id from public.vendas where id = p_venda_id;
      if not found then raise exception 'Venda não encontrada'; end if;
      if v_pedido.cliente_id is null or v_venda_cliente_id is distinct from v_pedido.cliente_id then
        raise exception 'A venda não pertence ao mesmo cliente do pedido';
      end if;
    elsif not (
      (v_anterior = 'nova' and p_novo_status in ('em_busca', 'peca_disponivel', 'nao_encontrada', 'cancelada', 'atendida')) or
      (v_anterior = 'em_busca' and p_novo_status in ('peca_disponivel', 'nao_encontrada', 'cancelada', 'atendida')) or
      (v_anterior = 'aguardando' and p_novo_status in ('em_busca', 'peca_disponivel', 'nao_encontrada', 'cancelada', 'atendida')) or
      (v_anterior = 'peca_disponivel' and p_novo_status in ('em_busca', 'aguardando_cliente', 'cliente_desistiu', 'cancelada', 'atendida')) or
      (v_anterior = 'aguardando_cliente' and p_novo_status in ('aguardando_cliente', 'cliente_desistiu', 'cancelada', 'atendida')) or
      (v_anterior in ('nao_encontrada', 'cliente_desistiu', 'cancelada') and p_novo_status = 'em_busca') or
      (v_anterior in ('nova', 'em_busca', 'peca_disponivel', 'aguardando_cliente', 'aguardando') and p_novo_status = 'vendida')
    ) then
      raise exception 'Transição inválida: % para %', v_anterior, p_novo_status;
    end if;

    if p_novo_status in ('nao_encontrada', 'cliente_desistiu', 'cancelada') and v_motivo is null then
      raise exception 'Informe o motivo para encerrar o pedido';
    end if;

    update public.pecas_procuradas
    set
      status = p_novo_status,
      venda_id = case when p_novo_status = 'vendida' then p_venda_id else venda_id end,
      encerrada_em = case
        when p_novo_status in ('vendida', 'nao_encontrada', 'cliente_desistiu', 'cancelada', 'atendida') then now()
        when p_novo_status = 'em_busca' then null
        else encerrada_em
      end,
      atendida_em = case
        when p_novo_status in ('vendida', 'atendida') then now()
        when p_novo_status = 'em_busca' then null
        else atendida_em
      end,
      ultima_acao = 'transicao:' || p_novo_status,
      ultima_acao_em = now(),
      proxima_acao_em = case when p_novo_status = 'em_busca' then null else proxima_acao_em end
    where id = p_pedido_id
    returning * into v_pedido;

    insert into public.pecas_procuradas_eventos (
      pedido_id, tipo, estado_anterior, estado_novo, motivo, criado_por
    ) values (
      p_pedido_id, 'estado_alterado', v_anterior, p_novo_status, v_motivo, p_usuario_id
    );
    return v_pedido;
  end;
  $$;

  create or replace function public.registrar_acao_pedido(
    p_pedido_id uuid,
    p_acao text,
    p_usuario_id uuid,
    p_detalhe jsonb default '{}'::jsonb
  ) returns public.pecas_procuradas
  language plpgsql
  security invoker
  set search_path = ''
  as $$
  declare
    v_pedido public.pecas_procuradas;
    v_anterior text;
    v_novo text;
    v_motivo text := nullif(btrim(coalesce(p_detalhe->>'motivo', '')), '');
    v_proxima_acao timestamptz;
  begin
    if p_usuario_id is null then raise exception 'Usuário responsável é obrigatório'; end if;
    select * into v_pedido from public.pecas_procuradas where id = p_pedido_id for update;
    if v_pedido.id is null then raise exception 'Pedido não encontrado'; end if;
    v_anterior := v_pedido.status;
    v_novo := v_anterior;
    v_proxima_acao := v_pedido.proxima_acao_em;

    case p_acao
      when 'iniciar_busca' then
        if v_anterior not in ('nova', 'aguardando') then raise exception 'Ação inválida para o estado atual'; end if;
        v_novo := 'em_busca';
      when 'cliente_avisado' then
        if v_anterior <> 'peca_disponivel' then raise exception 'Ação inválida para o estado atual'; end if;
        v_novo := 'aguardando_cliente';
        v_proxima_acao := null;
      when 'aguardando_resposta' then
        if v_anterior <> 'aguardando_cliente' then raise exception 'Ação inválida para o estado atual'; end if;
        v_proxima_acao := now() + interval '48 hours';
      when 'vai_buscar' then
        if v_anterior <> 'aguardando_cliente' then raise exception 'Ação inválida para o estado atual'; end if;
        v_proxima_acao := null;
      when 'cliente_desistiu' then
        if v_anterior not in ('peca_disponivel', 'aguardando_cliente') then raise exception 'Ação inválida para o estado atual'; end if;
        v_novo := 'cliente_desistiu';
      when 'nao_quer_mais' then
        if v_anterior <> 'aguardando_cliente' then raise exception 'Ação inválida para o estado atual'; end if;
        v_novo := 'cliente_desistiu';
      when 'marcar_nao_encontrada' then
        if v_anterior not in ('nova', 'em_busca', 'aguardando') then raise exception 'Ação inválida para o estado atual'; end if;
        v_novo := 'nao_encontrada';
      when 'cancelar' then
        if v_anterior not in ('nova', 'em_busca', 'peca_disponivel', 'aguardando_cliente', 'aguardando') then
          raise exception 'Ação inválida para o estado atual';
        end if;
        v_novo := 'cancelada';
      when 'reabrir' then
        if v_anterior not in ('nao_encontrada', 'cliente_desistiu', 'cancelada') then raise exception 'Ação inválida para o estado atual'; end if;
        v_novo := 'em_busca';
        v_proxima_acao := null;
      else
        raise exception 'Ação de pedido inválida';
    end case;

    if v_novo in ('nao_encontrada', 'cliente_desistiu', 'cancelada') and v_motivo is null then
      raise exception 'Informe o motivo para encerrar o pedido';
    end if;

    update public.pecas_procuradas
    set
      status = v_novo,
      ultima_acao = p_acao,
      ultima_acao_em = now(),
      proxima_acao_em = v_proxima_acao,
      encerrada_em = case
        when v_novo in ('nao_encontrada', 'cliente_desistiu', 'cancelada') then now()
        when p_acao = 'reabrir' then null
        else encerrada_em
      end
    where id = p_pedido_id
    returning * into v_pedido;

    insert into public.pecas_procuradas_eventos (
      pedido_id, tipo, estado_anterior, estado_novo, acao, motivo, detalhe, criado_por
    ) values (
      p_pedido_id,
      'acao_registrada',
      v_anterior,
      v_novo,
      p_acao,
      v_motivo,
      coalesce(p_detalhe, '{}'::jsonb) - 'motivo',
      p_usuario_id
    );
    return v_pedido;
  end;
  $$;

  -- 8. Correção administrativa da origem ---------------------------------------
  create or replace function public.corrigir_origem_cliente(
    p_cliente_id uuid,
    p_nova_origem text,
    p_usuario_id uuid,
    p_motivo text
  ) returns public.clientes
  language plpgsql
  security invoker
  set search_path = ''
  as $$
  declare
    v_cliente public.clientes;
    v_origem_anterior text;
    v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
  begin
    if p_usuario_id is null then raise exception 'Usuário responsável é obrigatório'; end if;
    if p_nova_origem not in ('whatsapp', 'facebook', 'mercado_livre', 'instagram', 'indicacao', 'balcao', 'redes_sociais', 'outro') then
      raise exception 'Origem inválida';
    end if;
    if v_motivo is null then raise exception 'Motivo da correção é obrigatório'; end if;

    select * into v_cliente from public.clientes where id = p_cliente_id for update;
    if v_cliente.id is null then raise exception 'Cliente não encontrado'; end if;
    v_origem_anterior := v_cliente.origem;

    update public.clientes set origem = p_nova_origem where id = p_cliente_id returning * into v_cliente;
    insert into public.clientes_eventos (cliente_id, tipo, detalhe, criado_por)
    values (
      p_cliente_id,
      'origem_corrigida',
      pg_catalog.jsonb_build_object('de', v_origem_anterior, 'para', p_nova_origem, 'motivo', v_motivo),
      p_usuario_id
    );
    return v_cliente;
  end;
  $$;

  -- 9. Privilégios das RPCs -----------------------------------------------------
  revoke all on function public.definir_moto_principal(uuid, uuid) from public, anon, authenticated;
  revoke all on function public.registrar_cliente_com_pedido(jsonb, jsonb, uuid) from public, anon, authenticated;
  revoke all on function public.transicionar_pedido_busca(uuid, text, uuid, text, uuid) from public, anon, authenticated;
  revoke all on function public.registrar_acao_pedido(uuid, text, uuid, jsonb) from public, anon, authenticated;
  revoke all on function public.corrigir_origem_cliente(uuid, text, uuid, text) from public, anon, authenticated;

  grant execute on function public.definir_moto_principal(uuid, uuid) to service_role;
  grant execute on function public.registrar_cliente_com_pedido(jsonb, jsonb, uuid) to service_role;
  grant execute on function public.transicionar_pedido_busca(uuid, text, uuid, text, uuid) to service_role;
  grant execute on function public.registrar_acao_pedido(uuid, text, uuid, jsonb) to service_role;
  grant execute on function public.corrigir_origem_cliente(uuid, text, uuid, text) to service_role;

  notify pgrst, 'reload schema';
  commit;
