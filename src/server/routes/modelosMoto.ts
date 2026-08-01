// CRUD da tabela "modelos_moto" — árvore de profundidade livre via parent_id
// (adjacency list): Marca (raiz) > Cilindrada (filho) > Modelo (neto, com
// ano). Backend só expõe a lista plana; montar a árvore, achar descendentes
// etc. é responsabilidade do utilitário compartilhado em
// src/features/motos/motoTree.ts.
import { Router } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { mensagemErroExclusao } from '../dbErrors.js';
import { getDescendantIds, ehDescendenteOuIgual } from '../../features/motos/motoTree.js';
import type { ModeloMoto } from '../../types/catalog.js';

const MSG_NOME_DUPLICADO = 'Já existe um modelo com esse nome neste nível.';
const MSG_PAI_INVALIDO = 'Modelo pai inválido.';

export function modelosMotoRouter(supabase: SupabaseClient) {
  const router = Router();

  async function listarTodos(): Promise<ModeloMoto[]> {
    const { data, error } = await supabase.from('modelos_moto').select('id, nome, parent_id, ordem, ano');
    if (error) throw error;
    return (data || []) as ModeloMoto[];
  }

  // Busca (case-insensitive, trim) um filho com esse nome sob `parentId`;
  // cria se não existir. Usado por POST /rapido pra achar-ou-criar a marca e
  // a cilindrada sem duplicar nós quando o usuário digita "honda" depois de
  // já existir "Honda".
  async function acharOuCriarNo(nome: string, parentId: string | null): Promise<ModeloMoto> {
    const nomeAlvo = nome.trim();
    let query = supabase.from('modelos_moto').select('*');
    query = parentId ? query.eq('parent_id', parentId) : query.is('parent_id', null);
    const { data: irmaos, error: erroBusca } = await query;
    if (erroBusca) throw erroBusca;

    const existente = (irmaos || []).find((m: any) => m.nome.trim().toLowerCase() === nomeAlvo.toLowerCase());
    if (existente) return existente as ModeloMoto;

    const totalIrmaos = (irmaos || []).length;
    const { data: criado, error: erroCriar } = await supabase
      .from('modelos_moto')
      .insert([{ nome: nomeAlvo, parent_id: parentId, ordem: totalIrmaos }])
      .select()
      .single();
    if (erroCriar) throw erroCriar;
    return criado as ModeloMoto;
  }

  router.get('/', async (_req, res) => {
    try {
      const { data, error } = await supabase.from('modelos_moto').select('*').order('ordem');
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.post('/', async (req, res) => {
    try {
      const nome = String(req.body?.nome || '').trim();
      if (!nome) return res.status(400).json({ success: false, error: 'Nome é obrigatório' });
      const parent_id = req.body?.parent_id || null;
      const ano = req.body?.ano ? String(req.body.ano).trim() : null;

      // Novo nó entra no fim da lista de irmãos, não disputando ordem=0 com um já existente.
      let query = supabase.from('modelos_moto').select('id', { count: 'exact', head: true });
      query = parent_id ? query.eq('parent_id', parent_id) : query.is('parent_id', null);
      const { count: totalIrmaos } = await query;

      const { data, error } = await supabase
        .from('modelos_moto')
        .insert([{ nome, parent_id, ano, ordem: totalIrmaos ?? 0 }])
        .select()
        .single();
      if (error) {
        if (error.code === '23505') return res.status(409).json({ success: false, error: MSG_NOME_DUPLICADO });
        if (error.code === '23503') return res.status(400).json({ success: false, error: MSG_PAI_INVALIDO });
        throw error;
      }
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Atalho de cadastro rápido: marca + cilindrada (opcional) + nome + ano.
  // Acha-ou-cria a marca e a cilindrada, depois insere a moto como filha do
  // nó mais específico dos dois. Retorna os três nós (novos ou reaproveitados)
  // pro frontend atualizar o estado local sem duplicar.
  router.post('/rapido', async (req, res) => {
    try {
      const marcaNome = String(req.body?.marca || '').trim();
      const cilindradaNome = req.body?.cilindrada ? String(req.body.cilindrada).trim() : '';
      const nome = String(req.body?.nome || '').trim();
      const ano = req.body?.ano ? String(req.body.ano).trim() : null;

      if (!marcaNome) return res.status(400).json({ success: false, error: 'Marca é obrigatória' });
      if (!nome) return res.status(400).json({ success: false, error: 'Nome do modelo é obrigatório' });

      const marca = await acharOuCriarNo(marcaNome, null);
      const cilindrada = cilindradaNome ? await acharOuCriarNo(cilindradaNome, marca.id) : null;
      const parentDaMoto = cilindrada ? cilindrada.id : marca.id;

      const totalIrmaos = await supabase.from('modelos_moto').select('id', { count: 'exact', head: true }).eq('parent_id', parentDaMoto);

      const { data: moto, error } = await supabase
        .from('modelos_moto')
        .insert([{ nome, parent_id: parentDaMoto, ano, ordem: totalIrmaos.count ?? 0 }])
        .select()
        .single();
      if (error) {
        if (error.code === '23505') return res.status(409).json({ success: false, error: MSG_NOME_DUPLICADO });
        throw error;
      }

      res.json({ success: true, data: { marca, cilindrada, moto } });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.put('/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const atualizacao: Partial<Pick<ModeloMoto, 'nome' | 'parent_id' | 'ano'>> = {};

      if (req.body?.nome !== undefined) {
        const nome = String(req.body.nome).trim();
        if (!nome) return res.status(400).json({ success: false, error: 'Nome é obrigatório' });
        atualizacao.nome = nome;
      }

      if (req.body?.ano !== undefined) {
        atualizacao.ano = req.body.ano ? String(req.body.ano).trim() : null;
      }

      if (req.body?.parent_id !== undefined) {
        const novoParentId: string | null = req.body.parent_id || null;
        if (novoParentId) {
          const modelos = await listarTodos();
          if (ehDescendenteOuIgual(id, novoParentId, modelos)) {
            return res.status(400).json({
              success: false,
              error: 'Não é possível mover um modelo para dentro dele mesmo ou de um sub-nível dele.',
            });
          }
        }
        atualizacao.parent_id = novoParentId;
      }

      if (Object.keys(atualizacao).length === 0) {
        return res.status(400).json({ success: false, error: 'Nada para atualizar' });
      }

      const { data, error } = await supabase.from('modelos_moto').update(atualizacao).eq('id', id).select().single();
      if (error) {
        if (error.code === '23505') return res.status(409).json({ success: false, error: MSG_NOME_DUPLICADO });
        if (error.code === '23503') return res.status(400).json({ success: false, error: MSG_PAI_INVALIDO });
        throw error;
      }
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.patch('/reordenar', async (req, res) => {
    try {
      const ids: string[] = Array.isArray(req.body?.ids) ? req.body.ids : [];
      if (ids.length === 0) return res.status(400).json({ success: false, error: 'Lista de ids vazia' });

      for (let i = 0; i < ids.length; i++) {
        const { error } = await supabase.from('modelos_moto').update({ ordem: i }).eq('id', ids[i]);
        if (error) throw error;
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.delete('/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const modelos = await listarTodos();
      const idsDaSubarvore = getDescendantIds(id, modelos);

      const [{ count: countEstoque, error: erroEstoque }, { count: countVendas, error: erroVendas }] = await Promise.all([
        supabase.from('estoque').select('id', { count: 'exact', head: true }).in('modelo_moto_id', idsDaSubarvore),
        supabase.from('vendas').select('id', { count: 'exact', head: true }).in('modelo_moto_id', idsDaSubarvore),
      ]);
      if (erroEstoque) throw erroEstoque;
      if (erroVendas) throw erroVendas;

      const total = (countEstoque || 0) + (countVendas || 0);
      if (total > 0) {
        return res.status(409).json({
          success: false,
          error: `Não é possível excluir: existem ${countEstoque || 0} peça(s) e ${countVendas || 0} venda(s) usando este modelo ou seus sub-níveis.`,
        });
      }

      const { error } = await supabase.from('modelos_moto').delete().in('id', idsDaSubarvore);
      if (error) {
        return res.status(error.code === '23503' ? 409 : 500).json({ success: false, error: mensagemErroExclusao(error, 'peças ou vendas') });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}
