// src/server/routes/estoqueFamilias.ts
// CRUD de famílias de peça (migration_056) — agrupam N fichas de estoque
// sob um nome comum. Ver
// docs/superpowers/specs/2026-09-02-estoque-familias-de-peca-design.md.
import { Router } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { exigirPermissao } from '../../../middleware/auth.js';

const VER = exigirPermissao('estoque.ver');
const CRIAR = exigirPermissao('estoque.criar');
const EDITAR = exigirPermissao('estoque.editar');
const DELETAR = exigirPermissao('estoque.deletar');

// Só extrai/normaliza os campos presentes no body — não valida nome
// obrigatório aqui, porque PATCH parcial pode não mandar nome nenhum.
// Cada rota que precisa exigir nome (POST, e PUT/PATCH quando o campo vem)
// valida isso na própria mão, mesmo padrão de montarPayload em estoque.ts.
export function montarPayloadFamilia(body: any): Record<string, any> {
  const payload: Record<string, any> = {};
  if (body?.nome !== undefined) payload.nome = String(body.nome).trim();
  if (body?.categoria_id !== undefined) payload.categoria_id = body.categoria_id || null;
  if (body?.descricao !== undefined) payload.descricao = body.descricao ? String(body.descricao).trim() || null : null;
  if (body?.imagem_url !== undefined) payload.imagem_url = body.imagem_url || null;
  return payload;
}

export function estoqueFamiliasRouter(supabase: SupabaseClient) {
  const router = Router();

  router.get('/', VER, async (_req, res) => {
    try {
      const { data, error } = await supabase.from('estoque_familias').select('*').order('nome');
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Erro ao listar famílias de estoque:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.post('/', CRIAR, async (req, res) => {
    try {
      const payload = montarPayloadFamilia(req.body);
      if (!payload.nome) return res.status(400).json({ success: false, error: 'Nome da família é obrigatório' });

      const { data, error } = await supabase.from('estoque_familias').insert([payload]).select('*').single();
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Erro ao criar família de estoque:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  const atualizarFamilia = async (req: any, res: any) => {
    try {
      const payload = montarPayloadFamilia(req.body);
      if (payload.nome !== undefined && !payload.nome) {
        return res.status(400).json({ success: false, error: 'Nome da família é obrigatório' });
      }

      const { data, error } = await supabase.from('estoque_familias').update(payload).eq('id', req.params.id).select('*').single();
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Erro ao atualizar família de estoque:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  };

  router.put('/:id', EDITAR, atualizarFamilia);
  router.patch('/:id', EDITAR, atualizarFamilia);

  router.delete('/:id', DELETAR, async (req, res) => {
    try {
      // Bloqueia exclusão se qualquer ficha da família já tiver unidade
      // vendida — preserva histórico de venda (ver spec, rodapé "Excluir").
      const { data: fichas, error: erroFichas } = await supabase.from('estoque').select('id').eq('familia_id', req.params.id);
      if (erroFichas) throw erroFichas;

      const idsFichas = (fichas ?? []).map((f: any) => f.id);
      if (idsFichas.length > 0) {
        const { count, error: erroVendidas } = await supabase
          .from('estoque_unidades')
          .select('id', { count: 'exact', head: true })
          .in('estoque_id', idsFichas)
          .not('vendida_em', 'is', null);

        if (erroVendidas && erroVendidas.code !== '42P01' && erroVendidas.code !== 'PGRST205') {
          throw erroVendidas;
        }
        if (!erroVendidas && (count ?? 0) > 0) {
          return res.status(409).json({
            success: false,
            error: 'Esta família tem unidade(s) já vendida(s) — desvincule as peças em vez de excluir, pra preservar o histórico de venda.',
          });
        }
      }

      const { error } = await supabase.from('estoque_familias').delete().eq('id', req.params.id);
      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      console.error('Erro ao excluir família de estoque:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}
