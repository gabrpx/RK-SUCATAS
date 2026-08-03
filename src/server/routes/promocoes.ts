// CRUD de promoções. O cálculo de "qual promoção vale pra essa peça agora" é
// feito em estoque.ts (na listagem/detalhe do estoque), não aqui — esta rota
// só cuida do cadastro. Edição fica restrita a valor/prazo/descrição/ativo:
// mudar escopo, alvo ou tipo de desconto é uma promoção diferente, então o
// fluxo esperado é encerrar (ou excluir, se nunca ficou ativa) e criar outra
// — mesmo espírito do PATCH de vendas.ts, que também não deixa editar o que
// mudaria a natureza do registro.
import { Router } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';

const ESCOPOS = ['peca', 'modelo_moto', 'categoria', 'global'] as const;
const TIPOS_DESCONTO = ['percentual', 'valor_fixo'] as const;

function parseData(valor: unknown): string | null {
  if (!valor) return null;
  const data = new Date(valor as string);
  return Number.isNaN(data.getTime()) ? null : data.toISOString();
}

export function promocoesRouter(supabase: SupabaseClient) {
  const router = Router();

  router.get('/', async (_req, res) => {
    try {
      const { data, error } = await supabase.from('promocoes').select('*').order('criado_em', { ascending: false });
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Erro ao listar promoções:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.post('/', async (req, res) => {
    try {
      const escopo = String(req.body?.escopo || '');
      if (!ESCOPOS.includes(escopo as any)) {
        return res.status(400).json({ success: false, error: 'Escopo inválido' });
      }

      const tipo_desconto = String(req.body?.tipo_desconto || '');
      if (!TIPOS_DESCONTO.includes(tipo_desconto as any)) {
        return res.status(400).json({ success: false, error: 'Tipo de desconto inválido' });
      }

      const valor = Number(req.body?.valor);
      if (!Number.isFinite(valor) || valor <= 0) {
        return res.status(400).json({ success: false, error: 'O valor do desconto precisa ser maior que zero' });
      }
      if (tipo_desconto === 'percentual' && valor > 100) {
        return res.status(400).json({ success: false, error: 'Desconto percentual não pode passar de 100%' });
      }

      const alvo_id = escopo === 'global' ? null : req.body?.alvo_id || null;
      if (escopo !== 'global' && !alvo_id) {
        return res.status(400).json({ success: false, error: 'Selecione o alvo da promoção' });
      }

      const data_inicio = parseData(req.body?.data_inicio) ?? new Date().toISOString();
      const data_fim = parseData(req.body?.data_fim);
      if (data_fim && data_fim <= data_inicio) {
        return res.status(400).json({ success: false, error: 'A data de término precisa ser depois do início' });
      }

      const payload = {
        escopo,
        alvo_id,
        tipo_desconto,
        valor,
        descricao: req.body?.descricao ? String(req.body.descricao).trim() : null,
        data_inicio,
        data_fim,
        ativo: true,
      };

      const { data, error } = await supabase.from('promocoes').insert([payload]).select('*').single();
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Erro ao criar promoção:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.patch('/:id', async (req, res) => {
    try {
      const atualizacao: Record<string, any> = {};

      if (req.body?.ativo !== undefined) atualizacao.ativo = Boolean(req.body.ativo);
      if (req.body?.descricao !== undefined) atualizacao.descricao = req.body.descricao ? String(req.body.descricao).trim() : null;

      if (req.body?.valor !== undefined) {
        const valor = Number(req.body.valor);
        if (!Number.isFinite(valor) || valor <= 0) {
          return res.status(400).json({ success: false, error: 'O valor do desconto precisa ser maior que zero' });
        }
        atualizacao.valor = valor;
      }

      // data_fim explicitamente null = "encerrar agora" ou "remover prazo",
      // então precisa do próprio corpo decidir, não dá pra usar parseData
      // (que trataria null e string inválida do mesmo jeito).
      if (req.body?.data_fim !== undefined) {
        atualizacao.data_fim = req.body.data_fim ? parseData(req.body.data_fim) : null;
      }

      if (Object.keys(atualizacao).length === 0) {
        return res.status(400).json({ success: false, error: 'Nada para atualizar' });
      }

      const { data, error } = await supabase.from('promocoes').update(atualizacao).eq('id', req.params.id).select('*').single();
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Erro ao atualizar promoção:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.delete('/:id', async (req, res) => {
    try {
      const { error } = await supabase.from('promocoes').delete().eq('id', req.params.id);
      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      console.error('Erro ao excluir promoção:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}
