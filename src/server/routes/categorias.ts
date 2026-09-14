// CRUD da tabela de apoio "categorias" — árvore de profundidade livre via
// parent_id (adjacency list). Backend só expõe a lista plana; montar a
// árvore, achar descendentes etc. é responsabilidade do utilitário
// compartilhado em src/features/categorias/categoriaTree.ts.
import { Router } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { mensagemErroExclusao } from '../dbErrors.js';
import { getDescendantIds, ehDescendenteOuIgual } from '../../features/categorias/categoriaTree.js';
import type { Categoria } from '../../types/catalog.js';
import { exigirPermissao } from '../../../middleware/auth.js';

const MSG_NOME_DUPLICADO = 'Já existe uma categoria com esse nome neste nível.';
const MSG_PAI_INVALIDO = 'Categoria pai inválida.';

// Categorias são dado de referência (o frontend usa pra montar filtros/nomes
// em várias telas), então o GET fica aberto a qualquer usuário autenticado.
// A escrita (criar/renomear/mover/reordenar/excluir) é da tela de Configurações.
const ESCRITA = exigirPermissao('configuracoes.gerenciar_categorias');

export function categoriasRouter(supabase: SupabaseClient) {
  const router = Router();

  async function listarTodas(): Promise<Categoria[]> {
    const { data, error } = await supabase.from('categorias').select('id, nome, parent_id, ordem');
    if (error) throw error;
    return (data || []) as Categoria[];
  }

  router.get('/', async (_req, res) => {
    try {
      const { data, error } = await supabase.from('categorias').select('*').order('ordem');
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.post('/', ESCRITA, async (req, res) => {
    try {
      const nome = String(req.body?.nome || '').trim();
      if (!nome) return res.status(400).json({ success: false, error: 'Nome é obrigatório' });
      const parent_id = req.body?.parent_id || null;

      // Novo nó entra no fim da lista de irmãos, não disputando ordem=0 com um já existente.
      let query = supabase.from('categorias').select('id', { count: 'exact', head: true });
      query = parent_id ? query.eq('parent_id', parent_id) : query.is('parent_id', null);
      const { count: totalIrmaos } = await query;

      const { data, error } = await supabase
        .from('categorias')
        .insert([{ nome, parent_id, ordem: totalIrmaos ?? 0 }])
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

  router.put('/:id', ESCRITA, async (req, res) => {
    try {
      const { id } = req.params;
      const atualizacao: Partial<Pick<Categoria, 'nome' | 'parent_id'>> & { mercadolivre_categoria_id_padrao?: string | null } = {};

      if (req.body?.nome !== undefined) {
        const nome = String(req.body.nome).trim();
        if (!nome) return res.status(400).json({ success: false, error: 'Nome é obrigatório' });
        atualizacao.nome = nome;
      }

      if (req.body?.parent_id !== undefined) {
        const novoParentId: string | null = req.body.parent_id || null;
        if (novoParentId) {
          const categorias = await listarTodas();
          if (ehDescendenteOuIgual(id, novoParentId, categorias)) {
            return res.status(400).json({
              success: false,
              error: 'Não é possível mover uma categoria para dentro dela mesma ou de uma subcategoria dela.',
            });
          }
        }
        atualizacao.parent_id = novoParentId;
      }

      // Categoria do Mercado Livre memorizada como sugestão pra próxima peça
      // desta mesma categoria interna (migration_043) — nunca uma trava, só
      // pré-preenche. Coluna nova: se a migração ainda não rodou, ignora sem
      // quebrar o resto da atualização (nome/parent_id continuam salvando).
      if (req.body?.mercadolivre_categoria_id_padrao !== undefined) {
        atualizacao.mercadolivre_categoria_id_padrao = req.body.mercadolivre_categoria_id_padrao || null;
      }

      if (Object.keys(atualizacao).length === 0) {
        return res.status(400).json({ success: false, error: 'Nada para atualizar' });
      }

      let { data, error } = await supabase.from('categorias').update(atualizacao).eq('id', id).select().single();
      if (error && (error.code === '42703' || error.code === 'PGRST204') && 'mercadolivre_categoria_id_padrao' in atualizacao) {
        console.warn('⚠️ Coluna categorias.mercadolivre_categoria_id_padrao ausente — rode supabase/migration_043_mercadolivre_publicacao.sql. Salvando o restante sem ela.');
        const { mercadolivre_categoria_id_padrao, ...semColunaNova } = atualizacao;
        ({ data, error } = await supabase.from('categorias').update(semColunaNova).eq('id', id).select().single());
      }
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

  router.patch('/reordenar', ESCRITA, async (req, res) => {
    try {
      const ids: string[] = Array.isArray(req.body?.ids) ? req.body.ids : [];
      if (ids.length === 0) return res.status(400).json({ success: false, error: 'Lista de ids vazia' });

      for (let i = 0; i < ids.length; i++) {
        const { error } = await supabase.from('categorias').update({ ordem: i }).eq('id', ids[i]);
        if (error) throw error;
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.delete('/:id', ESCRITA, async (req, res) => {
    try {
      const { id } = req.params;
      const categorias = await listarTodas();
      const idsDaSubarvore = getDescendantIds(id, categorias);

      const { count, error: erroContagem } = await supabase
        .from('estoque')
        .select('id', { count: 'exact', head: true })
        .in('categoria_id', idsDaSubarvore);
      if (erroContagem) throw erroContagem;

      if (count && count > 0) {
        return res.status(409).json({
          success: false,
          error: `Não é possível excluir: existem ${count} peça(s) usando esta categoria ou suas subcategorias.`,
        });
      }

      const { error } = await supabase.from('categorias').delete().in('id', idsDaSubarvore);
      if (error) {
        return res.status(error.code === '23503' ? 409 : 500).json({ success: false, error: mensagemErroExclusao(error, 'peças') });
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}
