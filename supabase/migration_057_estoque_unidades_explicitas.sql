-- =============================================================================
-- RK Sucatas — Migração 057: unidades físicas sempre explícitas
-- =============================================================================
-- Rode isso no editor SQL do Supabase (schema.sql + migrations 002 a 056,
-- incluindo migration_014_unidades_avaria.sql, migration_024_condicao_nota_
-- unidade.sql e migration_038_vendas_unidade.sql já aplicadas).
--
-- Problema: estoque_unidades (migration_014) só ganhava linha pra uma
-- unidade "diferente" das outras — uma peça com 5 unidades idênticas tinha
-- zero fichas. O novo modal de família (ver
-- docs/superpowers/specs/2026-09-02-estoque-familias-de-peca-design.md)
-- mostra um card por unidade física, inclusive as sem diferença nenhuma —
-- então toda unidade física passa a precisar da própria linha.
--
-- Solução: sincronizar_unidades_estoque(p_estoque_id, p_quantidade_alvo)
-- garante que existam exatamente p_quantidade_alvo linhas em
-- estoque_unidades pra aquela peça:
--   - se faltar, cria unidades EM BRANCO (valor/fotos/condicao_nota nulos,
--     avaria false, apelido null) — exibem foto/preço/nota da peça-mãe por
--     herança (mesma lógica de valorDaUnidade/condicaoNotaDaUnidade que já
--     existe em src/features/estoque/valorEstoque.ts), sem precisar
--     preencher nada. Só o formulário manual "Registrar unidade" (fora
--     deste plano) exige foto/preço próprios — essa sincronização
--     automática nunca passa por ali.
--   - se sobrar, apaga só unidades em branco (sem vendida_em, sem apelido,
--     sem avaria, sem valor/condicao_nota/fotos próprios), das mais
--     recentes pras mais antigas. Nunca apaga unidade com dado próprio ou
--     já vendida — se não sobrar unidade em branco suficiente, levanta
--     exceção pedindo que o usuário exclua a unidade certa antes.
--
-- Chamada pelo backend (src/server/routes/estoque.ts) toda vez que
-- POST/PUT/PATCH /api/estoque ou /api/estoque/bulk-update-quantidade grava
-- quantidade — nunca chamada direto pelo frontend.
-- =============================================================================

create or replace function sincronizar_unidades_estoque(p_estoque_id uuid, p_quantidade_alvo int)
returns void as $$
declare
  v_atual int;
  v_faltando int;
  v_sobrando int;
  v_em_branco_disponivel int;
begin
  select count(*) into v_atual from estoque_unidades where estoque_id = p_estoque_id;

  if v_atual < p_quantidade_alvo then
    v_faltando := p_quantidade_alvo - v_atual;
    insert into estoque_unidades (estoque_id, avaria)
    select p_estoque_id, false from generate_series(1, v_faltando);
  elsif v_atual > p_quantidade_alvo then
    v_sobrando := v_atual - p_quantidade_alvo;

    select count(*) into v_em_branco_disponivel
    from estoque_unidades
    where estoque_id = p_estoque_id
      and vendida_em is null
      and apelido is null
      and avaria = false
      and avaria_descricao is null
      and valor is null
      and condicao_nota is null
      and fotos = '[]'::jsonb;

    if v_em_branco_disponivel < v_sobrando then
      raise exception 'Reduza a quantidade excluindo unidades específicas primeiro: só % unidade(s) em branco disponível(is), % precisa(m) sair', v_em_branco_disponivel, v_sobrando;
    end if;

    delete from estoque_unidades
    where id in (
      select id from estoque_unidades
      where estoque_id = p_estoque_id
        and vendida_em is null
        and apelido is null
        and avaria = false
        and avaria_descricao is null
        and valor is null
        and condicao_nota is null
        and fotos = '[]'::jsonb
      order by criado_em desc
      limit v_sobrando
    );
  end if;
end;
$$ language plpgsql;

-- Backfill: cria as unidades em branco faltantes pra todo o estoque já
-- cadastrado — cada peça passa a ter exatamente `quantidade` linhas em
-- estoque_unidades (as fichas que já existiam, mais as que faltavam em
-- branco). Rode isso com cautela: teste num dump/projeto de staging antes
-- de aplicar em produção (ver spec, seção "Modelo de dados").
do $$
declare
  r record;
begin
  for r in select id, quantidade from estoque where quantidade > 0 loop
    perform sincronizar_unidades_estoque(r.id, r.quantidade);
  end loop;
end $$;

NOTIFY pgrst, 'reload schema';
