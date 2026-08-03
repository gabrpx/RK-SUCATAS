// CRUD do estoque de peças. Cada linha carrega a categoria e o modelo de moto
// já resolvidos via join, pra UI não precisar cruzar os lookups na mão.
import { Router } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { excluirImagemPorUrl } from '../../services/storageService.js';
import { categoriaExigeNota } from '../../features/estoque/categoriaMotor.js';
import { getDescendantIds as getDescendantIdsCategoria } from '../../features/categorias/categoriaTree.js';
import { getDescendantIds as getDescendantIdsMoto } from '../../features/motos/motoTree.js';
import type { Categoria } from '../../types/catalog.js';
import type { Promocao } from '../../features/promocoes/types.js';
import { autorizar } from '../../../middleware/auth.js';

// GET fica aberto pra Eloisa (estoque_leitura, só consulta); toda escrita
// (criar/editar/excluir/ações em massa) é admin/equipe only.
const LEITURA = autorizar('admin', 'equipe', 'estoque_leitura');
const ESCRITA = autorizar('admin', 'equipe');

const SELECT_COM_JOINS = '*, categoria:categorias(id, nome), modelo_moto:modelos_moto(id, nome, ano)';

// As fichas de unidade (migration_014) vêm numa consulta separada, e não como
// join no select acima, de propósito: enquanto a migração não roda em
// produção a tabela não existe, e um join pra tabela inexistente derruba a
// listagem inteira do estoque. Assim a aba continua funcionando normalmente
// e as avarias simplesmente aparecem vazias até a migração ser aplicada.
async function anexarUnidades(supabase: SupabaseClient, itens: any[] | null): Promise<any[]> {
  const lista = itens ?? [];
  if (lista.length === 0) return lista;

  // Sem filtro por id: a tabela só tem linha pra unidade sinalizada, então é
  // pequena por construção — e evita montar um `in(...)` com milhares de ids.
  const { data, error } = await supabase.from('estoque_unidades').select('*');

  if (error) {
    // 42P01 = tabela não existe; PGRST205 = PostgREST ainda não a conhece.
    if (error.code === '42P01' || error.code === 'PGRST205') {
      console.warn('⚠️ Tabela estoque_unidades ausente — rode supabase/migration_014_unidades_avaria.sql pra habilitar as avarias.');
    } else {
      console.error('Erro ao buscar unidades de estoque:', error);
    }
    return lista.map((item) => ({ ...item, unidades: [] }));
  }

  const porEstoque = new Map<string, any[]>();
  for (const unidade of data ?? []) {
    const atual = porEstoque.get(unidade.estoque_id) ?? [];
    atual.push(unidade);
    porEstoque.set(unidade.estoque_id, atual);
  }

  return lista.map((item) => ({ ...item, unidades: porEstoque.get(item.id) ?? [] }));
}

// Precisão da promoção quando mais de uma bate no mesmo item: peça
// específica vence modelo de moto, que vence categoria, que vence global.
const ESPECIFICIDADE_PROMOCAO: Record<Promocao['escopo'], number> = { peca: 0, modelo_moto: 1, categoria: 2, global: 3 };

function calcularValorPromocional(valorOriginal: number, promo: Promocao): number {
  const bruto = promo.tipo_desconto === 'percentual' ? valorOriginal * (1 - Number(promo.valor) / 100) : valorOriginal - Number(promo.valor);
  return Math.max(0, Math.round(bruto * 100) / 100);
}

// Calcula, pra cada item, se há promoção vigente agora (sem job/cron — só
// compara a janela de datas no momento da consulta) e anexa `promocao_ativa`
// com o valor já calculado. Escopo modelo_moto/categoria vale pro alvo E
// toda a subárvore abaixo dele (ex: promoção na "CG 150" cobre também
// "Carburada", "Mix" e "Injetada" — mesma lógica de compatibilidade usada em
// todo o resto do catálogo). Mesma degradação graciosa de anexarUnidades:
// enquanto a migration_018 não roda em produção, a tabela não existe e o
// estoque continua funcionando normalmente, só sem promoções.
async function anexarPromocoes(supabase: SupabaseClient, itens: any[]): Promise<any[]> {
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

const CAMPOS_EDITAVEIS = [
  'nome',
  'categoria_id',
  'modelo_moto_id',
  'condicao',
  'condicao_nota',
  'nota_cadastro',
  'ano',
  'valor',
  'quantidade',
  'imagens',
  'descricao',
  'ativo',
  'componentes',
  'anuncio_ml_url',
  'anuncio_fb_url',
] as const;

function montarPayload(body: any) {
  const payload: Record<string, any> = {};
  for (const campo of CAMPOS_EDITAVEIS) {
    if (body[campo] !== undefined) payload[campo] = body[campo];
  }
  if (payload.valor !== undefined) payload.valor = Number(payload.valor) || 0;
  if (payload.quantidade !== undefined) payload.quantidade = Math.max(0, Number(payload.quantidade) || 0);
  if (payload.condicao_nota !== undefined) {
    const nota = payload.condicao_nota === null || payload.condicao_nota === '' ? null : Number(payload.condicao_nota);
    payload.condicao_nota = nota === null || !Number.isFinite(nota) ? null : Math.min(10, Math.max(1, Math.round(nota)));
  }
  if (payload.imagens !== undefined) {
    payload.imagens = Array.isArray(payload.imagens) ? payload.imagens.map((u: any) => String(u)).filter(Boolean) : [];
  }
  // Lista de nomes de partes em que o item pode ser desmembrado na venda —
  // null quando vazia, pra "item comum" continuar sem nenhum campo extra.
  if (payload.componentes !== undefined) {
    const lista = Array.isArray(payload.componentes) ? payload.componentes.map((c: any) => String(c).trim()).filter(Boolean) : [];
    payload.componentes = lista.length > 0 ? lista : null;
  }
  return payload;
}

// Peças de Motor (ou subcategoria dela) exigem informar se têm nota fiscal
// pra cadastro — mesma regra de src/features/estoque/categoriaMotor.ts,
// aplicada aqui pra não depender só da validação do frontend.
async function validarNotaCadastro(supabase: SupabaseClient, categoriaId: string | null, notaCadastro: unknown): Promise<string | null> {
  if (!categoriaId) return null;
  const { data: categorias, error } = await supabase.from('categorias').select('id, nome, parent_id, ordem');
  if (error) throw error;
  if (!categoriaExigeNota(categoriaId, (categorias || []) as Categoria[])) return null;
  if (notaCadastro !== 'com_nota' && notaCadastro !== 'sem_nota') {
    return 'Para peças de Motor, selecione "Com nota pra cadastro" ou "Sem nota pra cadastro"';
  }
  return null;
}

export function estoqueRouter(supabase: SupabaseClient) {
  const router = Router();

  router.get('/', LEITURA, async (_req, res) => {
    try {
      const { data, error } = await supabase.from('estoque').select(SELECT_COM_JOINS).order('criado_em', { ascending: false });
      if (error) throw error;
      const comUnidades = await anexarUnidades(supabase, data);
      res.json({ success: true, data: await anexarPromocoes(supabase, comUnidades) });
    } catch (error: any) {
      console.error('Erro ao listar estoque:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.get('/:id', LEITURA, async (req, res) => {
    try {
      const { data, error } = await supabase.from('estoque').select(SELECT_COM_JOINS).eq('id', req.params.id).single();
      if (error) throw error;
      const [comUnidades] = await anexarUnidades(supabase, [data]);
      const [comPromocao] = await anexarPromocoes(supabase, [comUnidades]);
      res.json({ success: true, data: comPromocao });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.post('/', ESCRITA, async (req, res) => {
    try {
      const nome = String(req.body?.nome || '').trim();
      if (!nome) return res.status(400).json({ success: false, error: 'Nome da peça é obrigatório' });
      if (!['original', 'paralela'].includes(req.body?.condicao)) {
        return res.status(400).json({ success: false, error: 'Condição deve ser "original" ou "paralela"' });
      }

      const payload: Record<string, any> = { ...montarPayload(req.body), nome };
      const erroNota = await validarNotaCadastro(supabase, payload.categoria_id ?? null, payload.nota_cadastro);
      if (erroNota) return res.status(400).json({ success: false, error: erroNota });

      const { data, error } = await supabase.from('estoque').insert([payload]).select(SELECT_COM_JOINS).single();
      if (error) throw error;
      const [comPromocao] = await anexarPromocoes(supabase, [{ ...data, unidades: [] }]);
      res.json({ success: true, data: comPromocao });
    } catch (error: any) {
      console.error('Erro ao criar item de estoque:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Compartilhado por PUT/PATCH: fotos removidas da galeria saem do Storage
  // depois de confirmar a troca — nunca deixa arquivo órfão (mesma lógica já
  // usada pelas fotos de unidade, ver montarPayloadUnidade abaixo).
  const atualizarItem = async (req: any, res: any) => {
    try {
      const payload = montarPayload(req.body);
      let imagensRemovidas: string[] = [];

      if (payload.imagens !== undefined) {
        const { data: atual } = await supabase.from('estoque').select('imagens').eq('id', req.params.id).single();
        const antigas: string[] = atual?.imagens ?? [];
        imagensRemovidas = antigas.filter((url) => !payload.imagens.includes(url));
      }

      if (payload.categoria_id !== undefined || payload.nota_cadastro !== undefined) {
        const { data: atual } = await supabase.from('estoque').select('categoria_id, nota_cadastro').eq('id', req.params.id).single();
        const categoriaId = payload.categoria_id !== undefined ? payload.categoria_id : atual?.categoria_id ?? null;
        const notaCadastro = payload.nota_cadastro !== undefined ? payload.nota_cadastro : atual?.nota_cadastro ?? null;
        const erroNota = await validarNotaCadastro(supabase, categoriaId, notaCadastro);
        if (erroNota) return res.status(400).json({ success: false, error: erroNota });
      }

      const { data, error } = await supabase.from('estoque').update(payload).eq('id', req.params.id).select(SELECT_COM_JOINS).single();
      if (error) throw error;

      for (const url of imagensRemovidas) {
        excluirImagemPorUrl(url).catch((e) => console.error('Erro ao limpar imagem antiga:', e));
      }

      // Sem isso o item volta pro frontend sem as fichas de unidade e o aviso
      // de avaria some da lista até o próximo refresh.
      const [comUnidades] = await anexarUnidades(supabase, [data]);
      const [comPromocao] = await anexarPromocoes(supabase, [comUnidades]);
      res.json({ success: true, data: comPromocao });
    } catch (error: any) {
      console.error('Erro ao atualizar item de estoque:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  };

  router.put('/:id', ESCRITA, atualizarItem);
  // PATCH usa a mesma lógica do PUT — a diferença semântica (parcial vs total)
  // já é garantida por montarPayload só incluir os campos enviados.
  router.patch('/:id', ESCRITA, atualizarItem);

  router.delete('/:id', ESCRITA, async (req, res) => {
    try {
      const { data: item } = await supabase.from('estoque').select('imagens').eq('id', req.params.id).single();
      const { error } = await supabase.from('estoque').delete().eq('id', req.params.id);
      if (error) throw error;

      for (const url of item?.imagens ?? []) {
        excluirImagemPorUrl(url).catch((e) => console.error('Erro ao limpar imagem:', e));
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error('Erro ao excluir item de estoque:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.post('/bulk-delete', ESCRITA, async (req, res) => {
    try {
      const ids: string[] = req.body?.ids || [];
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ success: false, error: 'ids inválidos' });
      }
      const { data: itens } = await supabase.from('estoque').select('imagens').in('id', ids);
      const { error } = await supabase.from('estoque').delete().in('id', ids);
      if (error) throw error;

      for (const item of itens || []) {
        for (const url of item.imagens ?? []) {
          excluirImagemPorUrl(url).catch((e) => console.error('Erro ao limpar imagem:', e));
        }
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error('Erro no bulk-delete de estoque:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ==========================================================================
  // Unidades físicas com avaria (ver supabase/migration_014_unidades_avaria.sql)
  // ==========================================================================
  // Aninhadas no item porque uma ficha de unidade não existe fora dele. As
  // rotas têm dois segmentos, então nunca colidem com GET/PUT/DELETE '/:id'.

  function montarPayloadUnidade(body: any) {
    const payload: Record<string, any> = {};
    if (body?.apelido !== undefined) payload.apelido = String(body.apelido).trim() || null;
    if (body?.avaria !== undefined) payload.avaria = Boolean(body.avaria);
    if (body?.avaria_descricao !== undefined) payload.avaria_descricao = String(body.avaria_descricao).trim() || null;
    if (body?.fotos !== undefined) {
      payload.fotos = Array.isArray(body.fotos) ? body.fotos.map((f: any) => String(f)).filter(Boolean) : [];
    }
    // Distingue "não mandou o campo" de "mandou vazio pra voltar ao preço da
    // peça" — null aqui significa herdar estoque.valor, não zero.
    if (body?.valor !== undefined) {
      const numero = body.valor === null || body.valor === '' ? null : Number(body.valor);
      payload.valor = numero === null || Number.isNaN(numero) ? null : Math.max(0, numero);
    }
    return payload;
  }

  router.get('/:id/unidades', LEITURA, async (req, res) => {
    try {
      const { data, error } = await supabase.from('estoque_unidades').select('*').eq('estoque_id', req.params.id).order('criado_em');
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Erro ao listar unidades:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.post('/:id/unidades', ESCRITA, async (req, res) => {
    try {
      const { data: item, error: erroItem } = await supabase.from('estoque').select('id, quantidade').eq('id', req.params.id).maybeSingle();
      if (erroItem) throw erroItem;
      if (!item) return res.status(404).json({ success: false, error: 'Peça não encontrada' });

      // Não faz sentido ter mais fichas de unidade do que unidades físicas —
      // seriam fichas de peças que não estão mais na loja.
      const { count, error: erroContagem } = await supabase
        .from('estoque_unidades')
        .select('id', { count: 'exact', head: true })
        .eq('estoque_id', req.params.id);
      if (erroContagem) throw erroContagem;

      if ((count ?? 0) >= item.quantidade) {
        return res.status(400).json({
          success: false,
          error: `Esta peça tem ${item.quantidade} unidade(s) em estoque e já ${count} ficha(s) cadastrada(s). Aumente a quantidade ou revise as fichas existentes.`,
        });
      }

      const payload = { ...montarPayloadUnidade(req.body), estoque_id: req.params.id };
      const { data, error } = await supabase.from('estoque_unidades').insert(payload).select('*').single();
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Erro ao criar unidade:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.patch('/:id/unidades/:unidadeId', ESCRITA, async (req, res) => {
    try {
      const payload = montarPayloadUnidade(req.body);

      // Foto removida da ficha some do Storage também — mesma regra que o
      // item usa pra imagens, pra não acumular arquivo órfão.
      let fotosRemovidas: string[] = [];
      if (payload.fotos !== undefined) {
        const { data: atual } = await supabase.from('estoque_unidades').select('fotos').eq('id', req.params.unidadeId).single();
        const antigas: string[] = atual?.fotos ?? [];
        fotosRemovidas = antigas.filter((url) => !payload.fotos.includes(url));
      }

      const { data, error } = await supabase
        .from('estoque_unidades')
        .update(payload)
        .eq('id', req.params.unidadeId)
        .eq('estoque_id', req.params.id)
        .select('*')
        .single();
      if (error) throw error;

      for (const url of fotosRemovidas) {
        excluirImagemPorUrl(url).catch((e) => console.error('Erro ao limpar foto de avaria:', e));
      }

      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Erro ao atualizar unidade:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.delete('/:id/unidades/:unidadeId', ESCRITA, async (req, res) => {
    try {
      const { data: unidade } = await supabase.from('estoque_unidades').select('fotos').eq('id', req.params.unidadeId).single();

      const { error } = await supabase.from('estoque_unidades').delete().eq('id', req.params.unidadeId).eq('estoque_id', req.params.id);
      if (error) throw error;

      for (const url of unidade?.fotos ?? []) {
        excluirImagemPorUrl(url).catch((e) => console.error('Erro ao limpar foto de avaria:', e));
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error('Erro ao excluir unidade:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.post('/bulk-update-categoria', ESCRITA, async (req, res) => {
    try {
      const ids: string[] = req.body?.ids || [];
      const categoria_id: string = req.body?.categoria_id;
      if (!Array.isArray(ids) || ids.length === 0 || !categoria_id) {
        return res.status(400).json({ success: false, error: 'ids e categoria_id são obrigatórios' });
      }
      const { error } = await supabase.from('estoque').update({ categoria_id }).in('id', ids);
      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      console.error('Erro no bulk-update-categoria de estoque:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Ajuste relativo de quantidade (delta pode ser negativo), usado pelos
  // botões +1/-1 em lote na UI.
  router.post('/bulk-update-quantidade', ESCRITA, async (req, res) => {
    try {
      const ids: string[] = req.body?.ids || [];
      const delta: number = Number(req.body?.delta) || 0;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ success: false, error: 'ids inválidos' });
      }

      const { data: itens, error: fetchError } = await supabase.from('estoque').select('id, quantidade').in('id', ids);
      if (fetchError) throw fetchError;

      for (const item of itens || []) {
        const novaQuantidade = Math.max(0, Number(item.quantidade) + delta);
        const { error: updateError } = await supabase.from('estoque').update({ quantidade: novaQuantidade }).eq('id', item.id);
        if (updateError) throw updateError;
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error('Erro no bulk-update-quantidade de estoque:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}
