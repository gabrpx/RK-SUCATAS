-- Reparo operacional executado em 2026-10-22.
--
-- Contexto: algumas peças tinham estoque.quantidade maior que o número de
-- fichas ativas em estoque_unidades. O frontend representava a diferença com
-- unidades virtuais, exibindo "Sem ficha individual". As imagens gerais das
-- peças continuavam preservadas em estoque.imagens.
--
-- Este bloco é idempotente: sincronizar_unidades_estoque só cria as fichas
-- ativas que estiverem faltando. Ele não copia fotos gerais para uma unidade
-- específica, pois isso afirmaria incorretamente que todas as peças físicas
-- foram fotografadas individualmente. A UI usa essas fotos como referência.

begin;

do $$
declare
  item record;
begin
  for item in
    select e.id, e.quantidade
    from estoque e
    left join (
      select estoque_id, count(*) filter (
        where vendida_em is null and arquivada_em is null
      ) as fichas_ativas
      from estoque_unidades
      group by estoque_id
    ) u on u.estoque_id = e.id
    where e.ativo is distinct from false
      and coalesce(u.fichas_ativas, 0) < greatest(e.quantidade, 0)
  loop
    perform sincronizar_unidades_estoque(item.id, item.quantidade);
  end loop;
end $$;

commit;

-- Verificação esperada: zero linhas.
select e.id, e.codigo, e.quantidade, coalesce(u.fichas_ativas, 0) as fichas_ativas
from estoque e
left join (
  select estoque_id, count(*) filter (
    where vendida_em is null and arquivada_em is null
  ) as fichas_ativas
  from estoque_unidades
  group by estoque_id
) u on u.estoque_id = e.id
where e.ativo is distinct from false
  and coalesce(u.fichas_ativas, 0) < greatest(e.quantidade, 0);
