// Motor de preço promocional — movido de src/server/routes/estoque.ts pra
// aqui sem mudar a lógica, porque a reconciliação de preço do módulo Mercado
// Livre (src/services/mercadolivreSync.ts) precisa exatamente da mesma conta
// que já decide o preço promocional na tela de Estoque. Duplicar essa conta
// em dois lugares arriscaria divergir (funcionário vê um valor, anúncio no ML
// mostra outro).
import type { SupabaseClient } from '@supabase/supabase-js';
import { getDescendantIds as getDescendantIdsCategoria } from '../categorias/categoriaTree.js';
import { getDescendantIds as getDescendantIdsMoto } from '../motos/motoTree.js';
import type { Categoria } from '../../types/catalog.js';
import type { Promocao } from './types.js';

// Precisão da promoção quando mais de uma bate no mesmo item: peça
// específica vence modelo de moto, que vence categoria, que vence global.
const ESPECIFICIDADE_PROMOCAO: Record<Promocao['escopo'], number> = { peca: 0, modelo_moto: 1, categoria: 2, global: 3 };

export function calcularValorPromocional(valorOriginal: number, promo: Promocao): number {
  const bruto = promo.tipo_desconto === 'percentual' ? valorOriginal * (1 - Number(promo.valor) / 100) : valorOriginal - Number(promo.valor);
  return Math.max(0, Math.round(bruto * 100) / 100);
}

// Calcula, pra cada item, se há promoção vigente agora (sem job/cron — só
// compara a janela de datas no momento da consulta) e anexa `promocao_ativa`
// com o valor já calculado. Escopo modelo_moto/categoria vale pro alvo E
// toda a subárvore abaixo dele (ex: promoção na "CG 150" cobre também
// "Carburada", "Mix" e "Injetada" — mesma lógica de compatibilidade usada em
// todo o resto do catálogo). Mesma degradação graciosa de anexarUnidades
// (ver estoque.ts): enquanto a migration_018 não roda em produção, a tabela
// não existe e o estoque continua funcionando normalmente, só sem promoções.
export async function anexarPromocoes(supabase: SupabaseClient, itens: any[]): Promise<any[]> {
  if (itens.length === 0) return itens;

  const agora = new Date().toISOString();
  const { data: promocoesData, error } = await supabase.from('promocoes').select('*').eq('ativo', true).lte('data_inicio', agora);

  if (error) {
    if (error.code === '42P01' || error.code === 'PGRST205') {
      console.warn('⚠️ Tabela promocoes ausente — rode supabase/migration_018_promocoes.sql pra habilitar promoções.');
    } else {
      console.error('Erro ao buscar promoções:', error);
    }
    return itens.map((item) => ({ ...item, promocao_ativa: null }));
  }

  const vigentes = ((promocoesData ?? []) as Promocao[]).filter((p) => !p.data_fim || p.data_fim >= agora);
  if (vigentes.length === 0) return itens.map((item) => ({ ...item, promocao_ativa: null }));

  const precisaCategorias = vigentes.some((p) => p.escopo === 'categoria');
  const precisaModelos = vigentes.some((p) => p.escopo === 'modelo_moto');

  const [categorias, modelos] = await Promise.all([
    precisaCategorias
      ? supabase
          .from('categorias')
          .select('id, parent_id')
          .then((r) => (r.data ?? []) as Categoria[])
      : Promise.resolve([] as Categoria[]),
    precisaModelos
      ? supabase
          .from('modelos_moto')
          .select('id, parent_id')
          .then((r) => (r.data ?? []) as any[])
      : Promise.resolve([] as any[]),
  ]);

  // Pré-computa, uma vez só por promoção (não por item), o conjunto de ids
  // que ela cobre — alvo + subárvore inteira abaixo dele.
  const idsCobertosPorPromocao = new Map<string, Set<string>>();
  vigentes.forEach((p) => {
    if (p.escopo === 'modelo_moto' && p.alvo_id) idsCobertosPorPromocao.set(p.id, new Set(getDescendantIdsMoto(p.alvo_id, modelos)));
    if (p.escopo === 'categoria' && p.alvo_id) idsCobertosPorPromocao.set(p.id, new Set(getDescendantIdsCategoria(p.alvo_id, categorias)));
  });

  const encontrarMelhorPromocao = (item: any): Promocao | null => {
    let melhor: Promocao | null = null;
    for (const p of vigentes) {
      const bate =
        p.escopo === 'peca'
          ? p.alvo_id === item.id
          : p.escopo === 'modelo_moto'
          ? !!item.modelo_moto_id && !!idsCobertosPorPromocao.get(p.id)?.has(item.modelo_moto_id)
          : p.escopo === 'categoria'
          ? !!item.categoria_id && !!idsCobertosPorPromocao.get(p.id)?.has(item.categoria_id)
          : true; // global

      if (!bate) continue;
      if (!melhor || ESPECIFICIDADE_PROMOCAO[p.escopo] < ESPECIFICIDADE_PROMOCAO[melhor.escopo] || (ESPECIFICIDADE_PROMOCAO[p.escopo] === ESPECIFICIDADE_PROMOCAO[melhor.escopo] && p.criado_em > melhor.criado_em)) {
        melhor = p;
      }
    }
    return melhor;
  };

  return itens.map((item) => {
    const promo = encontrarMelhorPromocao(item);
    if (!promo) return { ...item, promocao_ativa: null };
    const valor_original = Number(item.valor) || 0;
    return {
      ...item,
      promocao_ativa: {
        id: promo.id,
        escopo: promo.escopo,
        tipo_desconto: promo.tipo_desconto,
        valor: promo.valor,
        valor_original,
        valor_promocional: calcularValorPromocional(valor_original, promo),
        data_fim: promo.data_fim,
        descricao: promo.descricao,
      },
    };
  });
}
