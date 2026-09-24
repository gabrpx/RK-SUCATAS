-- =============================================================================
-- RK Sucatas — Migração 069: baixa automática de unidade, edição atômica e
-- registro de fotos enviadas
-- =============================================================================
-- Aplicar SOMENTE depois da 068 (usa estoque_unidade_eventos e a autoria).
-- Depois de aplicar, rode docs/validacao-estoque-069.sql (termina em rollback).
--
-- NÃO reescreve registrar_venda nem cancelar_venda. Tudo aqui entra por
-- triggers e RPCs novas, na mesma transação da venda/cancelamento:
--
-- 1. Baixa automática (decisão do usuário em 24/09/2026): uma venda de peça
--    inteira registrada SEM unidade (loja antiga, Mercado Livre, orçamento)
--    baixava só estoque.quantidade e deixava a ficha física "sobrando" no
--    novo estoque. Agora, logo depois do insert em vendas, a unidade livre
--    mais antiga (não arquivada, sem reserva vigente) recebe vendida_em e a
--    baixa fica marcada "para conferir". Cancelar a venda devolve exatamente
--    a mesma unidade. Só baixa o que estiver sobrando em relação à
--    quantidade. Unidade vinculada a variação de anúncio do Mercado Livre
--    fica por último (o ML vende aquela ficha específica). Venda de
--    COMPONENTE que esgota uma unidade continua sem ficha definida: a sobra
--    aparece na conferência ("fichas sobrando") para a equipe apontar.
-- 2. conferir_baixa_automatica: a equipe confirma a unidade escolhida ou
--    troca pela que realmente saiu, com autoria. baixar_ficha_excedente
--    resolve as fichas que sobraram de vendas ANTIGAS (antes desta migration):
--    marca como vendida a ficha que já saiu, sem mexer na quantidade.
-- 3. editar_unidade_estoque: preço, nota, fotos, endereço e origem numa única
--    transação (antes eram duas chamadas HTTP; a segunda podia falhar).
-- 4. estoque_fotos_enviadas: registro persistente dos uploads do novo estoque,
--    para descartar arquivos órfãos mesmo depois de reiniciar o servidor.
--    A limpeza (24 h) roda no backend, que é quem apaga no Storage.
-- =============================================================================
begin;

-- 0. Novos tipos de evento na linha do tempo ---------------------------------
alter table estoque_unidade_eventos drop constraint if exists estoque_unidade_eventos_tipo_check;
alter table estoque_unidade_eventos add constraint estoque_unidade_eventos_tipo_check check (tipo in (
  'arquivada', 'restaurada', 'endereco_alterado', 'editada',
  'baixa_automatica', 'baixa_conferida', 'baixa_corrigida', 'baixa_desfeita', 'baixa_excedente'
));

-- A troca de endereço feita por editar_unidade_estoque passa a registrar o
-- autor: a RPC grava o usuário em variáveis locais da transação e o trigger
-- (criado na 068) lê daqui. O PATCH simples continua gravando sem autor.
create or replace function registrar_evento_endereco_unidade() returns trigger
language plpgsql set search_path = public as $$
begin
  insert into estoque_unidade_eventos (unidade_id, tipo, detalhe, usuario_id, usuario_nome)
  values (new.id, 'endereco_alterado', jsonb_build_object(
    'de', (select codigo from estoque_locais where id = old.endereco_id),
    'para', (select codigo from estoque_locais where id = new.endereco_id)
  ),
  nullif(current_setting('rk.usuario_id', true), '')::uuid,
  nullif(current_setting('rk.usuario_nome', true), ''));
  return new;
end;
$$;

-- 1. Baixa automática ---------------------------------------------------------
create table estoque_baixas_automaticas (
  id uuid primary key default gen_random_uuid(),
  venda_id uuid not null references vendas(id) on delete cascade,
  unidade_id uuid not null references estoque_unidades(id) on delete cascade,
  estoque_id uuid not null references estoque(id) on delete cascade,
  criada_em timestamptz not null default now(),
  conferida_em timestamptz,
  conferida_por uuid,
  conferida_por_nome text,
  unique (venda_id, unidade_id)
);
create index idx_baixas_automaticas_pendentes on estoque_baixas_automaticas(estoque_id) where conferida_em is null;
create index idx_baixas_automaticas_unidade on estoque_baixas_automaticas(unidade_id);
alter table estoque_baixas_automaticas enable row level security;
revoke all on estoque_baixas_automaticas from anon, authenticated;

create function baixar_unidades_venda_sem_ficha() returns trigger
language plpgsql set search_path = public as $$
declare
  v_quantidade int;
  v_livres int;
  v_alvo int;
  v_unidade_id uuid;
begin
  -- Venda de componente não tira a unidade inteira; venda com unidade já
  -- baixou a ficha certa; item avulso não tem ficha.
  if new.estoque_id is null or new.unidade_id is not null or new.componente_vendido is not null then
    return new;
  end if;

  -- registrar_venda já travou esta linha; o lock aqui é inofensivo e protege
  -- inserts de venda feitos por outro caminho.
  select quantidade into v_quantidade from estoque where id = new.estoque_id for update;
  select count(*) into v_livres from estoque_unidades
    where estoque_id = new.estoque_id and vendida_em is null and arquivada_em is null;

  -- Só baixa o que ficou sobrando: se as fichas já estavam abaixo da
  -- quantidade (dado antigo), nada é marcado.
  v_alvo := least(new.quantidade, greatest(v_livres - coalesce(v_quantidade, 0), 0));
  if v_alvo = 0 then return new; end if;

  -- A tabela de variações do ML (migration_043) pode não existir em todo
  -- ambiente: consulta dinâmica só quando ela está lá.
  for v_unidade_id in execute format($q$
    select u.id from estoque_unidades u
    where u.estoque_id = $1 and u.vendida_em is null and u.arquivada_em is null
      and not exists (
        select 1 from estoque_reservas r
        where r.unidade_id = u.id and r.liberada_em is null and r.reservada_ate > now()
      )
    order by %s u.criado_em, u.sku nulls last, u.id
    limit $2
    for update of u
  $q$, case when to_regclass('public.estoque_anuncios_ml_variacoes') is not null
      then 'exists (select 1 from estoque_anuncios_ml_variacoes v where v.unidade_id = u.id),'
      else '' end)
    using new.estoque_id, v_alvo
  loop
    update estoque_unidades set vendida_em = now() where id = v_unidade_id;
    insert into estoque_baixas_automaticas (venda_id, unidade_id, estoque_id)
      values (new.id, v_unidade_id, new.estoque_id);
    insert into estoque_unidade_eventos (unidade_id, tipo, detalhe)
      values (v_unidade_id, 'baixa_automatica', jsonb_build_object(
        'venda_id', new.id, 'nome_item', new.nome_item, 'data_venda', new.data));
  end loop;
  return new;
end;
$$;
create trigger trg_baixar_unidades_venda_sem_ficha
  after insert on vendas
  for each row execute function baixar_unidades_venda_sem_ficha();

-- Cancelamento: cancelar_venda devolve a quantidade e apaga a venda. Antes do
-- delete, a unidade baixada automaticamente volta a ficar disponível. Se o
-- delete falhar (ex.: fiado com recebimento), tudo volta junto.
create function desfazer_baixa_automatica_venda() returns trigger
language plpgsql set search_path = public as $$
declare
  v_unidade_id uuid;
  v_teve_baixa boolean := false;
  v_quantidade int;
  v_livres int;
begin
  for v_unidade_id in
    select b.unidade_id from estoque_baixas_automaticas b where b.venda_id = old.id
  loop
    v_teve_baixa := true;
    update estoque_unidades set vendida_em = null where id = v_unidade_id and vendida_em is not null;
    insert into estoque_unidade_eventos (unidade_id, tipo, detalhe)
      values (v_unidade_id, 'baixa_desfeita', jsonb_build_object('venda_id', old.id, 'nome_item', old.nome_item));
  end loop;

  -- Venda sem baixa automática (anterior à 069, ou de componente que esgotou
  -- a unidade): cancelar_venda já devolveu a quantidade. Se a equipe tinha
  -- apontado a ficha que saiu (baixar_ficha_excedente), ela volta também —
  -- a mais recente primeiro — para fichas e quantidade continuarem iguais.
  if not v_teve_baixa and old.estoque_id is not null then
    select quantidade into v_quantidade from estoque where id = old.estoque_id for update;
    select count(*) into v_livres from estoque_unidades
      where estoque_id = old.estoque_id and vendida_em is null and arquivada_em is null;
    if coalesce(v_quantidade, 0) > v_livres then
      for v_unidade_id in
        select u.id from estoque_unidades u
        join lateral (select max(e.criado_em) as em from estoque_unidade_eventos e
                      where e.unidade_id = u.id and e.tipo = 'baixa_excedente') ev on ev.em is not null
        where u.estoque_id = old.estoque_id and u.vendida_em is not null and u.arquivada_em is null
          and not exists (select 1 from vendas v where v.unidade_id = u.id and v.id <> old.id)
          and not exists (select 1 from estoque_baixas_automaticas b where b.unidade_id = u.id)
        order by ev.em desc
        limit v_quantidade - v_livres
        for update of u
      loop
        update estoque_unidades set vendida_em = null where id = v_unidade_id;
        insert into estoque_unidade_eventos (unidade_id, tipo, detalhe)
          values (v_unidade_id, 'baixa_desfeita', jsonb_build_object('venda_id', old.id, 'nome_item', old.nome_item, 'origem', 'ficha_sobrando'));
      end loop;
    end if;
  end if;
  return old;
end;
$$;
create trigger trg_desfazer_baixa_automatica_venda
  before delete on vendas
  for each row execute function desfazer_baixa_automatica_venda();

create function conferir_baixa_automatica(
  p_baixa_id uuid,
  p_unidade_correta_id uuid default null,
  p_usuario_id uuid default null,
  p_usuario_nome text default null
) returns estoque_baixas_automaticas
language plpgsql security invoker set search_path = public as $$
declare
  v_baixa estoque_baixas_automaticas;
  v_estoque_id uuid;
  v_vendida_em timestamptz;
  v_correta estoque_unidades;
  v_nome text := nullif(btrim(coalesce(p_usuario_nome, '')), '');
begin
  select estoque_id into v_estoque_id from estoque_baixas_automaticas where id = p_baixa_id;
  if v_estoque_id is null then raise exception 'Baixa automática não encontrada'; end if;
  -- Mesma ordem de locks das outras RPCs: estoque, depois fichas.
  perform 1 from estoque where id = v_estoque_id for update;
  select * into v_baixa from estoque_baixas_automaticas where id = p_baixa_id for update;
  -- A venda pode ter sido cancelada enquanto esperávamos o lock.
  if v_baixa.id is null then raise exception 'Baixa automática não encontrada: a venda foi cancelada'; end if;
  if v_baixa.conferida_em is not null then raise exception 'Esta baixa já foi conferida'; end if;

  if p_unidade_correta_id is not null and p_unidade_correta_id <> v_baixa.unidade_id then
    select * into v_correta from estoque_unidades where id = p_unidade_correta_id for update;
    if v_correta.id is null then raise exception 'Unidade não encontrada'; end if;
    if v_correta.estoque_id <> v_baixa.estoque_id then raise exception 'A unidade escolhida é de outra peça'; end if;
    if v_correta.vendida_em is not null or v_correta.arquivada_em is not null then
      raise exception 'A unidade escolhida já foi vendida ou arquivada';
    end if;
    select vendida_em into v_vendida_em from estoque_unidades where id = v_baixa.unidade_id for update;
    -- Devolve a escolhida pelo sistema e baixa a que realmente saiu, com a
    -- mesma data da venda. A reserva vigente é barrada pelo trigger da 066.
    update estoque_unidades set vendida_em = null where id = v_baixa.unidade_id;
    update estoque_unidades set vendida_em = coalesce(v_vendida_em, now()) where id = p_unidade_correta_id;
    insert into estoque_unidade_eventos (unidade_id, tipo, detalhe, usuario_id, usuario_nome) values
      (v_baixa.unidade_id, 'baixa_corrigida', jsonb_build_object('papel', 'devolvida', 'venda_id', v_baixa.venda_id), p_usuario_id, v_nome),
      (p_unidade_correta_id, 'baixa_corrigida', jsonb_build_object('papel', 'baixada', 'venda_id', v_baixa.venda_id), p_usuario_id, v_nome);
    update estoque_baixas_automaticas
      set unidade_id = p_unidade_correta_id, conferida_em = now(), conferida_por = p_usuario_id, conferida_por_nome = v_nome
      where id = p_baixa_id returning * into v_baixa;
  else
    insert into estoque_unidade_eventos (unidade_id, tipo, detalhe, usuario_id, usuario_nome)
      values (v_baixa.unidade_id, 'baixa_conferida', jsonb_build_object('venda_id', v_baixa.venda_id), p_usuario_id, v_nome);
    update estoque_baixas_automaticas
      set conferida_em = now(), conferida_por = p_usuario_id, conferida_por_nome = v_nome
      where id = p_baixa_id returning * into v_baixa;
  end if;
  return v_baixa;
end;
$$;

-- Fichas que sobraram de vendas antigas sem unidade (antes da 069): a peça tem
-- mais fichas livres do que a quantidade. A equipe aponta qual já saiu; a
-- ficha recebe vendida_em e a quantidade NÃO muda (ela já tinha sido baixada
-- pela venda antiga). Só funciona enquanto houver sobra.
create function baixar_ficha_excedente(
  p_unidade_id uuid,
  p_usuario_id uuid default null,
  p_usuario_nome text default null
) returns estoque_unidades
language plpgsql security invoker set search_path = public as $$
declare
  v_estoque_id uuid;
  v_quantidade int;
  v_livres int;
  v_unidade estoque_unidades;
begin
  select estoque_id into v_estoque_id from estoque_unidades where id = p_unidade_id;
  if v_estoque_id is null then raise exception 'Unidade não encontrada'; end if;
  select quantidade into v_quantidade from estoque where id = v_estoque_id for update;
  select * into v_unidade from estoque_unidades where id = p_unidade_id for update;
  if v_unidade.vendida_em is not null or v_unidade.arquivada_em is not null then
    raise exception 'Unidade já vendida ou arquivada';
  end if;
  select count(*) into v_livres from estoque_unidades
    where estoque_id = v_estoque_id and vendida_em is null and arquivada_em is null;
  if v_livres <= coalesce(v_quantidade, 0) then
    raise exception 'Esta peça não tem fichas sobrando: a quantidade já bate com as unidades';
  end if;
  update estoque_unidades set vendida_em = now() where id = p_unidade_id returning * into v_unidade;
  insert into estoque_unidade_eventos (unidade_id, tipo, detalhe, usuario_id, usuario_nome)
    values (p_unidade_id, 'baixa_excedente', jsonb_build_object('quantidade', v_quantidade, 'fichas_livres_antes', v_livres),
      p_usuario_id, nullif(btrim(coalesce(p_usuario_nome, '')), ''));
  return v_unidade;
end;
$$;

-- 2. Edição atômica da unidade -----------------------------------------------
-- p_payload aceita as chaves valor, condicao_nota, fotos, endereco_id e
-- origem_identificacao. Chave ausente = mantém; chave com null = limpa.
create function editar_unidade_estoque(
  p_unidade_id uuid,
  p_payload jsonb,
  p_usuario_id uuid default null,
  p_usuario_nome text default null
) returns estoque_unidades
language plpgsql security invoker set search_path = public as $$
declare
  v_estoque_id uuid;
  v_atual estoque_unidades;
  v_nova estoque_unidades;
  v_valor numeric;
  v_nota smallint;
  v_fotos jsonb;
  v_endereco uuid;
  v_origem text;
  v_mudancas jsonb := '{}'::jsonb;
  v_nome text := nullif(btrim(coalesce(p_usuario_nome, '')), '');
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Nenhuma alteração informada';
  end if;
  select estoque_id into v_estoque_id from estoque_unidades where id = p_unidade_id;
  if v_estoque_id is null then raise exception 'Unidade não encontrada'; end if;
  perform 1 from estoque where id = v_estoque_id for update;
  select * into v_atual from estoque_unidades where id = p_unidade_id for update;
  if v_atual.vendida_em is not null or v_atual.arquivada_em is not null then
    raise exception 'Unidade vendida ou arquivada não pode ser editada';
  end if;

  v_valor := v_atual.valor;
  if p_payload ? 'valor' then
    v_valor := nullif(p_payload->>'valor', '')::numeric;
    if v_valor is not null and v_valor <= 0 then raise exception 'Informe um preço de venda maior que zero'; end if;
  end if;

  v_nota := v_atual.condicao_nota;
  if p_payload ? 'condicao_nota' then
    v_nota := nullif(p_payload->>'condicao_nota', '')::smallint;
    if v_nota is not null and v_nota not between 1 and 10 then raise exception 'Nota da condição deve ficar entre 1 e 10'; end if;
  end if;

  v_fotos := v_atual.fotos;
  if p_payload ? 'fotos' then
    v_fotos := coalesce(p_payload->'fotos', '[]'::jsonb);
    if jsonb_typeof(v_fotos) <> 'array' or jsonb_array_length(v_fotos) > 10 then
      raise exception 'Envie no máximo 10 fotos por unidade';
    end if;
  end if;

  v_endereco := v_atual.endereco_id;
  if p_payload ? 'endereco_id' then
    v_endereco := nullif(p_payload->>'endereco_id', '')::uuid;
    if v_endereco is not null and not exists (select 1 from estoque_locais where id = v_endereco and ativo) then
      raise exception 'Local inativo ou inexistente';
    end if;
  end if;

  v_origem := v_atual.origem_identificacao;
  if p_payload ? 'origem_identificacao' then
    v_origem := nullif(btrim(coalesce(p_payload->>'origem_identificacao', '')), '');
    if length(v_origem) > 240 then raise exception 'Origem deve ter até 240 caracteres'; end if;
  end if;

  if v_valor is distinct from v_atual.valor then
    v_mudancas := v_mudancas || jsonb_build_object('valor', jsonb_build_object('de', v_atual.valor, 'para', v_valor));
  end if;
  if v_nota is distinct from v_atual.condicao_nota then
    v_mudancas := v_mudancas || jsonb_build_object('condicao_nota', jsonb_build_object('de', v_atual.condicao_nota, 'para', v_nota));
  end if;
  if v_fotos is distinct from v_atual.fotos then
    v_mudancas := v_mudancas || jsonb_build_object('fotos', jsonb_build_object('de', jsonb_array_length(coalesce(v_atual.fotos, '[]'::jsonb)), 'para', jsonb_array_length(v_fotos)));
  end if;
  if v_origem is distinct from v_atual.origem_identificacao then
    v_mudancas := v_mudancas || jsonb_build_object('origem', jsonb_build_object('de', v_atual.origem_identificacao, 'para', v_origem));
  end if;

  -- Autor do evento de endereço (trigger da 068, atualizado acima).
  perform set_config('rk.usuario_id', coalesce(p_usuario_id::text, ''), true);
  perform set_config('rk.usuario_nome', coalesce(v_nome, ''), true);

  update estoque_unidades set
    valor = v_valor, condicao_nota = v_nota, fotos = v_fotos,
    endereco_id = v_endereco, origem_identificacao = v_origem
  where id = p_unidade_id returning * into v_nova;

  perform set_config('rk.usuario_id', '', true);
  perform set_config('rk.usuario_nome', '', true);

  if v_mudancas <> '{}'::jsonb then
    insert into estoque_unidade_eventos (unidade_id, tipo, detalhe, usuario_id, usuario_nome)
      values (p_unidade_id, 'editada', v_mudancas, p_usuario_id, v_nome);
  end if;
  return v_nova;
end;
$$;

-- 3. Registro persistente de fotos enviadas ----------------------------------
-- foto_estoque_em_uso: procura a URL em qualquer coluna de estoque e de
-- estoque_unidades (fotos, imagens, imagem_url…) e nas tabelas de anúncio
-- quando existirem. A limpeza só apaga arquivo que ninguém usa.
create function foto_estoque_em_uso(p_url text) returns boolean
language plpgsql stable set search_path = public as $$
declare v_tabela text; v_usada boolean;
begin
  if p_url is null or p_url = '' then return false; end if;
  if exists (select 1 from estoque_unidades u where strpos(to_jsonb(u)::text, p_url) > 0)
     or exists (select 1 from estoque e where strpos(to_jsonb(e)::text, p_url) > 0) then
    return true;
  end if;
  foreach v_tabela in array array['estoque_anuncios_ml', 'estoque_anuncios_ml_variacoes', 'estoque_anuncios_shopee'] loop
    if to_regclass('public.' || v_tabela) is not null then
      execute format('select exists (select 1 from %I t where strpos(to_jsonb(t)::text, $1) > 0)', v_tabela) into v_usada using p_url;
      if v_usada then return true; end if;
    end if;
  end loop;
  return false;
end;
$$;

create table estoque_fotos_enviadas (
  url text primary key,
  usuario_id text,
  enviada_em timestamptz not null default now()
);
create index idx_estoque_fotos_enviadas_data on estoque_fotos_enviadas(enviada_em);
alter table estoque_fotos_enviadas enable row level security;
revoke all on estoque_fotos_enviadas from anon, authenticated;

revoke all on function
  conferir_baixa_automatica(uuid, uuid, uuid, text),
  baixar_ficha_excedente(uuid, uuid, text),
  editar_unidade_estoque(uuid, jsonb, uuid, text),
  foto_estoque_em_uso(text)
from public, anon, authenticated;
grant execute on function
  conferir_baixa_automatica(uuid, uuid, uuid, text),
  baixar_ficha_excedente(uuid, uuid, text),
  editar_unidade_estoque(uuid, jsonb, uuid, text),
  foto_estoque_em_uso(text)
to service_role;

notify pgrst, 'reload schema';
commit;
