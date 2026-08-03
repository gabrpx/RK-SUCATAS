// CRUD do estoque de peças. Cada linha carrega a categoria e o modelo de moto
// já resolvidos via join, pra UI não precisar cruzar os lookups na mão.
import { Router } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { excluirImagemPorUrl } from '../../services/storageService.js';
import { categoriaExigeNota } from '../../features/estoque/categoriaMotor.js';
import type { Categoria } from '../../types/catalog.js';
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

const CAMPOS_EDITAVEIS = [
  'nome',
  'categoria_id',
  'modelo_moto_id',
  'condicao',
  'nota_cadastro',
  'ano',
  'valor',
  'quantidade',
  'imagem_url',
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
      res.json({ success: true, data: await anexarUnidades(supabase, data) });
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
      res.json({ success: true, data: comUnidades });
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
      res.json({ success: true, data: { ...data, unidades: [] } });
    } catch (error: any) {
      console.error('Erro ao criar item de estoque:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Compartilhado por PUT/PATCH: se imagem_url está mudando, apaga a imagem
  // antiga do Storage depois de confirmar a troca — nunca deixa órfã.
  const atualizarItem = async (req: any, res: any) => {
    try {
      const payload = montarPayload(req.body);
      let imagemAntiga: string | null = null;

      if (payload.imagem_url !== undefined) {
        const { data: atual } = await supabase.from('estoque').select('imagem_url').eq('id', req.params.id).single();
        if (atual && atual.imagem_url !== payload.imagem_url) imagemAntiga = atual.imagem_url;
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

      if (imagemAntiga) excluirImagemPorUrl(imagemAntiga).catch((e) => console.error('Erro ao limpar imagem antiga:', e));

      // Sem isso o item volta pro frontend sem as fichas de unidade e o aviso
      // de avaria some da lista até o próximo refresh.
      const [comUnidades] = await anexarUnidades(supabase, [data]);
      res.json({ success: true, data: comUnidades });
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
      const { data: item } = await supabase.from('estoque').select('imagem_url').eq('id', req.params.id).single();
      const { error } = await supabase.from('estoque').delete().eq('id', req.params.id);
      if (error) throw error;

      if (item?.imagem_url) excluirImagemPorUrl(item.imagem_url).catch((e) => console.error('Erro ao limpar imagem:', e));

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
      const { data: itens } = await supabase.from('estoque').select('imagem_url').in('id', ids);
      const { error } = await supabase.from('estoque').delete().in('id', ids);
      if (error) throw error;

      for (const item of itens || []) {
        if (item.imagem_url) excluirImagemPorUrl(item.imagem_url).catch((e) => console.error('Erro ao limpar imagem:', e));
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
      // item usa pra imagem_url, pra não acumular arquivo órfão.
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
