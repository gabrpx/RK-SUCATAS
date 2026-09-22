import { Router } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { exigirPermissao } from '../../../middleware/auth.js';

const VER = exigirPermissao('estoque.ver');
const EDITAR = exigirPermissao('estoque.editar');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface LocalInput {
  codigo: string;
  deposito: string;
  zona: string;
  prateleira: string;
  secao: string;
  descricao?: string | null;
}

export function validarLocalInput(value: Partial<LocalInput>): string | null {
  const campos = [
    ['codigo', 'código'], ['deposito', 'depósito'], ['zona', 'zona'],
    ['prateleira', 'prateleira'], ['secao', 'seção'],
  ] as const;
  for (const [campo, rotulo] of campos) {
    if (typeof value[campo] !== 'string' || !value[campo].trim()) return `Informe ${rotulo} do local.`;
    if (value[campo].trim().length > 32) return `${rotulo} deve ter até 32 caracteres.`;
  }
  if (value.descricao != null && (typeof value.descricao !== 'string' || value.descricao.length > 240)) {
    return 'Descrição deve ter até 240 caracteres.';
  }
  return null;
}

export interface ReservaInput {
  responsavel: string | null;
  clienteId: string | null;
  reservadaAte: string;
}

const RESERVA_MAX_DIAS = 30;

// Cliente cadastrado é opcional: com cliente_id, o nome pode vir vazio (o
// banco usa o nome do cadastro); sem cliente_id, o nome livre é obrigatório
// (cliente de balcão sem cadastro).
export function validarReservaInput(body: unknown, agora = Date.now()): { erro: string } | { dados: ReservaInput } {
  const valor = (body ?? {}) as Record<string, unknown>;
  const clienteBruto = valor.cliente_id;
  if (clienteBruto != null && (typeof clienteBruto !== 'string' || !UUID.test(clienteBruto))) {
    return { erro: 'Cliente inválido.' };
  }
  const clienteId = typeof clienteBruto === 'string' ? clienteBruto : null;
  const responsavelBruto = valor.responsavel;
  if (responsavelBruto != null && typeof responsavelBruto !== 'string') return { erro: 'Nome do responsável inválido.' };
  const responsavel = typeof responsavelBruto === 'string' && responsavelBruto.trim() ? responsavelBruto.trim() : null;
  if (!clienteId && (!responsavel || responsavel.length < 2)) {
    return { erro: 'Escolha um cliente cadastrado ou informe o nome de quem reservou.' };
  }
  if (responsavel && (responsavel.length < 2 || responsavel.length > 120)) {
    return { erro: 'O nome de quem reservou deve ter de 2 a 120 caracteres.' };
  }
  const ate = valor.reservada_ate;
  const ateMs = typeof ate === 'string' ? Date.parse(ate) : NaN;
  if (!Number.isFinite(ateMs)) return { erro: 'Informe a data de vencimento da reserva.' };
  if (ateMs <= agora) return { erro: 'O vencimento da reserva precisa ser no futuro.' };
  if (ateMs > agora + RESERVA_MAX_DIAS * 86_400_000) return { erro: `A reserva pode durar no máximo ${RESERVA_MAX_DIAS} dias.` };
  return { dados: { responsavel, clienteId, reservadaAte: new Date(ateMs).toISOString() } };
}

const RESERVAS_COM_CLIENTE = 'id, unidade_id, responsavel, reservada_ate, criada_em, cliente_id, cliente:clientes(id, nome, telefone)';
const RESERVAS_SEM_CLIENTE = 'id, unidade_id, responsavel, reservada_ate, criada_em';

function erroBanco(error: { code?: string; message?: string }) {
  if (error.code === '23505') return { status: 409, error: 'Este local ou vínculo já existe.' };
  if (error.code === '23503') return { status: 400, error: 'Local ou categoria não encontrado.' };
  if (error.code === '42P01' || error.code === 'PGRST205' || error.code === '42703') {
    return { status: 503, error: 'A organização física ainda não foi instalada no banco.' };
  }
  return { status: 500, error: error.message || 'Falha ao salvar organização do estoque.' };
}

export function estoqueOrganizacaoRouter(supabase: SupabaseClient) {
  const router = Router();

  router.get('/locais', VER, async (_req, res) => {
    const reservasAtivas = (colunas: string) => supabase.from('estoque_reservas').select(colunas)
      .is('liberada_em', null).gt('reservada_ate', new Date().toISOString());
    const [locais, categorias, reservasComCliente] = await Promise.all([
      supabase.from('estoque_locais').select('*').order('deposito').order('zona').order('codigo'),
      supabase.from('estoque_local_categorias').select('local_id, categoria_id, prioridade'),
      reservasAtivas(RESERVAS_COM_CLIENTE),
    ]);
    // Enquanto a migration_067 (cliente_id) não estiver aplicada, a coluna e o
    // relacionamento não existem: cai para a leitura sem cliente em vez de
    // derrubar a tela inteira de organização.
    const semColunaCliente = reservasComCliente.error && ['42703', 'PGRST200', 'PGRST204'].includes(reservasComCliente.error.code ?? '');
    const reservas = semColunaCliente ? await reservasAtivas(RESERVAS_SEM_CLIENTE) : reservasComCliente;
    const error = locais.error || categorias.error || reservas.error;
    if (error) {
      const falha = erroBanco(error);
      return res.status(falha.status).json({ success: false, error: falha.error });
    }
    res.json({ success: true, data: { locais: locais.data ?? [], categorias: categorias.data ?? [], reservas: reservas.data ?? [] } });
  });

  router.post('/unidades/:unidadeId/reservas', EDITAR, async (req, res) => {
    const { unidadeId } = req.params;
    if (!UUID.test(unidadeId)) return res.status(400).json({ success: false, error: 'Unidade inválida.' });
    const validacao = validarReservaInput(req.body);
    if ('erro' in validacao) return res.status(400).json({ success: false, error: validacao.erro });
    const { responsavel, clienteId, reservadaAte } = validacao.dados;
    // p_cliente_id só é enviado quando existe: a chamada sem cliente continua
    // compatível com a assinatura de 3 argumentos (antes da migration_067).
    const { data, error } = await supabase.rpc('reservar_unidade_estoque', {
      p_unidade_id: unidadeId, p_responsavel: responsavel ?? '', p_ate: reservadaAte,
      ...(clienteId ? { p_cliente_id: clienteId } : {}),
    });
    if (error) return res.status(409).json({ success: false, error: error.message });
    return res.status(201).json({ success: true, data });
  });

  router.post('/reservas/:reservaId/liberar', EDITAR, async (req, res) => {
    if (!UUID.test(req.params.reservaId)) return res.status(400).json({ success: false, error: 'Reserva inválida.' });
    const { data, error } = await supabase.rpc('liberar_reserva_estoque', { p_reserva_id: req.params.reservaId });
    if (error) return res.status(409).json({ success: false, error: error.message });
    return res.json({ success: true, data });
  });

  router.post('/unidades/:unidadeId/arquivar', EDITAR, async (req, res) => {
    if (!UUID.test(req.params.unidadeId) || typeof req.body?.motivo !== 'string' || req.body.motivo.trim().length < 3 || req.body.motivo.trim().length > 240) {
      return res.status(400).json({ success: false, error: 'Informe a unidade e um motivo de 3 a 240 caracteres.' });
    }
    const { data, error } = await supabase.rpc('arquivar_unidade_estoque', { p_unidade_id: req.params.unidadeId, p_motivo: req.body.motivo.trim() });
    if (error) return res.status(409).json({ success: false, error: error.message });
    return res.json({ success: true, data });
  });

  router.post('/unidades/:unidadeId/restaurar', EDITAR, async (req, res) => {
    if (!UUID.test(req.params.unidadeId)) return res.status(400).json({ success: false, error: 'Unidade inválida.' });
    const { data, error } = await supabase.rpc('restaurar_unidade_estoque', { p_unidade_id: req.params.unidadeId });
    if (error) return res.status(409).json({ success: false, error: error.message });
    return res.json({ success: true, data });
  });

  router.post('/locais', EDITAR, async (req, res) => {
    const erro = validarLocalInput(req.body ?? {});
    if (erro) return res.status(400).json({ success: false, error: erro });
    const { codigo, deposito, zona, prateleira, secao, descricao } = req.body as LocalInput;
    const { data, error } = await supabase.from('estoque_locais').insert({
      codigo: codigo.trim().toUpperCase(), deposito: deposito.trim(), zona: zona.trim(),
      prateleira: prateleira.trim(), secao: secao.trim(), descricao: descricao?.trim() || null,
    }).select('*').single();
    if (error) {
      const falha = erroBanco(error);
      return res.status(falha.status).json({ success: false, error: falha.error });
    }
    res.status(201).json({ success: true, data });
  });

  router.post('/locais/:localId/categorias/:categoriaId', EDITAR, async (req, res) => {
    const { localId, categoriaId } = req.params;
    if (!UUID.test(localId) || !UUID.test(categoriaId)) return res.status(400).json({ success: false, error: 'Local ou categoria inválido.' });
    const { data, error } = await supabase.from('estoque_local_categorias')
      .insert({ local_id: localId, categoria_id: categoriaId }).select('*').single();
    if (error) {
      const falha = erroBanco(error);
      return res.status(falha.status).json({ success: false, error: falha.error });
    }
    res.status(201).json({ success: true, data });
  });

  router.delete('/locais/:localId/categorias/:categoriaId', EDITAR, async (req, res) => {
    const { localId, categoriaId } = req.params;
    if (!UUID.test(localId) || !UUID.test(categoriaId)) return res.status(400).json({ success: false, error: 'Local ou categoria inválido.' });
    const { error } = await supabase.from('estoque_local_categorias').delete()
      .eq('local_id', localId).eq('categoria_id', categoriaId);
    if (error) {
      const falha = erroBanco(error);
      return res.status(falha.status).json({ success: false, error: falha.error });
    }
    res.json({ success: true });
  });

  router.patch('/unidades/:unidadeId', EDITAR, async (req, res) => {
    const { unidadeId } = req.params;
    if (!UUID.test(unidadeId)) return res.status(400).json({ success: false, error: 'Unidade inválida.' });
    const enderecoId = req.body?.endereco_id;
    if (enderecoId !== undefined && enderecoId !== null && !UUID.test(enderecoId)) {
      return res.status(400).json({ success: false, error: 'Escolha um local cadastrado.' });
    }
    if (req.body?.origem_identificacao !== undefined && req.body?.origem_identificacao !== null &&
      (typeof req.body.origem_identificacao !== 'string' || req.body.origem_identificacao.length > 240)) {
      return res.status(400).json({ success: false, error: 'Origem deve ter até 240 caracteres.' });
    }
    const payload: Record<string, string | null> = {};
    if (enderecoId !== undefined) payload.endereco_id = enderecoId;
    if (req.body?.origem_identificacao !== undefined) payload.origem_identificacao = req.body.origem_identificacao?.trim() || null;
    if (!Object.keys(payload).length) return res.status(400).json({ success: false, error: 'Nenhuma alteração informada.' });

    const { data: unidade, error: erroUnidade } = await supabase.from('estoque_unidades')
      .select('id, vendida_em, arquivada_em').eq('id', unidadeId).maybeSingle();
    if (erroUnidade) {
      const falha = erroBanco(erroUnidade);
      return res.status(falha.status).json({ success: false, error: falha.error });
    }
    if (!unidade) return res.status(404).json({ success: false, error: 'Unidade não encontrada.' });
    if (unidade.vendida_em || unidade.arquivada_em) return res.status(409).json({ success: false, error: 'Unidade vendida ou arquivada não pode ser movida.' });

    if (enderecoId) {
      const { data: local, error: erroLocal } = await supabase.from('estoque_locais')
        .select('id').eq('id', enderecoId).eq('ativo', true).maybeSingle();
      if (erroLocal) {
        const falha = erroBanco(erroLocal);
        return res.status(falha.status).json({ success: false, error: falha.error });
      }
      if (!local) return res.status(400).json({ success: false, error: 'Local inativo ou inexistente.' });
    }
    const { data, error } = await supabase.from('estoque_unidades').update(payload)
      .eq('id', unidadeId).is('vendida_em', null).is('arquivada_em', null).select('*').maybeSingle();
    if (error) {
      const falha = erroBanco(error);
      return res.status(falha.status).json({ success: false, error: falha.error });
    }
    if (!data) return res.status(409).json({ success: false, error: 'A unidade mudou enquanto você editava. Atualize a tela.' });
    res.json({ success: true, data });
  });

  return router;
}
