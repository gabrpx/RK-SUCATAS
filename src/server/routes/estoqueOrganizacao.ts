import { Router } from 'express';
import multer from 'multer';
import type { SupabaseClient } from '@supabase/supabase-js';
import { exigirPermissao } from '../../../middleware/auth.js';
import type { AuthenticatedRequest } from '../../../middleware/auth.js';
import { excluirImagemPorUrl, uploadImagem } from '../../services/storageService.js';

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
  valorSinal: number;
  formaPagamentoId: string;
}

export const RESERVA_MAX_DIAS = 30;
const DIA_MS = 86_400_000;
// A duração é calculada AQUI, no servidor, como dias × 24 h a partir de agora
// — a mesma regra do banco (`p_ate <= now() + interval '30 days'`). A folga de
// 1 minuto só absorve a diferença de relógio entre API e Postgres no limite
// de 30 dias; a UI mostra o vencimento devolvido pela API.
const FOLGA_RELOGIO_MS = 60_000;

export function vencimentoReserva(dias: number, agora = Date.now()) {
  return new Date(agora + dias * DIA_MS - (dias === RESERVA_MAX_DIAS ? FOLGA_RELOGIO_MS : 0)).toISOString();
}

// Cliente cadastrado é opcional: com cliente_id, o nome pode vir vazio (o
// banco usa o nome do cadastro); sem cliente_id, o nome livre é obrigatório
// (cliente de balcão sem cadastro). O sinal (migration_068) é obrigatório: a
// conferência de 20% do preço fica no banco, que conhece o preço vigente.
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
  const dias = valor.dias;
  if (typeof dias !== 'number' || !Number.isInteger(dias) || dias < 1 || dias > RESERVA_MAX_DIAS) {
    return { erro: `O prazo da reserva deve ser de 1 a ${RESERVA_MAX_DIAS} dias.` };
  }
  const valorSinal = valor.valor_sinal;
  if (typeof valorSinal !== 'number' || !Number.isFinite(valorSinal) || valorSinal <= 0) {
    return { erro: 'Informe o valor do sinal pago (mínimo de 20% do preço).' };
  }
  const forma = valor.forma_pagamento_id;
  if (typeof forma !== 'string' || !UUID.test(forma)) return { erro: 'Informe a forma de pagamento do sinal.' };
  return { dados: { responsavel, clienteId, reservadaAte: vencimentoReserva(dias, agora), valorSinal: Math.round(valorSinal * 100) / 100, formaPagamentoId: forma } };
}

export interface LocalAtualizacao {
  descricao?: string | null;
  ativo?: boolean;
  codigo?: string;
}

export function validarAtualizacaoLocal(body: unknown): { erro: string } | { dados: LocalAtualizacao } {
  const valor = (body ?? {}) as Record<string, unknown>;
  const dados: LocalAtualizacao = {};
  if (valor.codigo !== undefined) {
    if (typeof valor.codigo !== 'string' || valor.codigo.trim().length < 2 || valor.codigo.trim().length > 32) return { erro: 'O código deve ter de 2 a 32 caracteres.' };
    dados.codigo = valor.codigo.trim().toUpperCase();
  }
  if (valor.descricao !== undefined) {
    if (valor.descricao !== null && (typeof valor.descricao !== 'string' || valor.descricao.length > 240)) return { erro: 'Descrição deve ter até 240 caracteres.' };
    dados.descricao = typeof valor.descricao === 'string' ? valor.descricao.trim() || null : null;
  }
  if (valor.ativo !== undefined) {
    if (typeof valor.ativo !== 'boolean') return { erro: 'Estado do local inválido.' };
    dados.ativo = valor.ativo;
  }
  if (!Object.keys(dados).length) return { erro: 'Nenhuma alteração informada.' };
  return { dados };
}

export type TipoEventoHistorico = 'cadastrada' | 'endereco' | 'reservada' | 'reserva_liberada' | 'reserva_vencida' | 'arquivada' | 'restaurada' | 'vendida';

export interface EventoHistorico {
  tipo: TipoEventoHistorico;
  em: string;
  titulo: string;
  detalhe: string | null;
  /** null = o banco não registrou quem fez (eventos anteriores à migration_068). */
  autor: string | null;
}

interface UnidadeHistoricoRow { criado_em?: string | null; organizada_em?: string | null; vendida_em?: string | null; arquivada_em?: string | null; motivo_arquivamento?: string | null }
interface ReservaHistoricoRow { criada_em: string; reservada_ate: string; liberada_em: string | null; motivo_liberacao: string | null; responsavel: string; valor_sinal?: number | null; criada_por_nome?: string | null; liberada_por_nome?: string | null }
interface EventoRow { tipo: string; criado_em: string; detalhe: Record<string, unknown> | null; usuario_nome: string | null }

function brl(valor: number) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Monta a linha do tempo a partir do que o banco persiste. Quando a tabela de
// eventos (068) existe, ela é a fonte de arquivar/restaurar/endereço; sem
// ela, usa as colunas da unidade (só o último valor de cada uma).
export function montarHistoricoUnidade(unidade: UnidadeHistoricoRow, reservas: ReservaHistoricoRow[], eventos: EventoRow[] | null, agora = Date.now()): EventoHistorico[] {
  const lista: EventoHistorico[] = [];
  if (unidade.criado_em) lista.push({ tipo: 'cadastrada', em: unidade.criado_em, titulo: 'Ficha criada', detalhe: null, autor: null });
  for (const reserva of reservas) {
    lista.push({
      tipo: 'reservada', em: reserva.criada_em, titulo: `Reservada para ${reserva.responsavel}`,
      detalhe: reserva.valor_sinal != null ? `Sinal de ${brl(Number(reserva.valor_sinal))}` : 'Sem sinal registrado (anterior à regra de 20%)',
      autor: reserva.criada_por_nome ?? null,
    });
    if (reserva.liberada_em) {
      const expirada = reserva.motivo_liberacao === 'Expirada';
      lista.push({ tipo: expirada ? 'reserva_vencida' : 'reserva_liberada', em: reserva.liberada_em, titulo: expirada ? 'Reserva vencida' : 'Reserva liberada', detalhe: reserva.motivo_liberacao, autor: expirada ? null : reserva.liberada_por_nome ?? null });
    } else if (Date.parse(reserva.reservada_ate) <= agora) {
      lista.push({ tipo: 'reserva_vencida', em: reserva.reservada_ate, titulo: 'Reserva vencida', detalhe: 'Prazo encerrado sem liberação manual', autor: null });
    }
  }
  if (eventos) {
    for (const evento of eventos) {
      const detalhe = evento.detalhe ?? {};
      if (evento.tipo === 'endereco_alterado') {
        const de = typeof detalhe.de === 'string' ? detalhe.de : null;
        const para = typeof detalhe.para === 'string' ? detalhe.para : null;
        lista.push({ tipo: 'endereco', em: evento.criado_em, titulo: para ? `Guardada em ${para}` : 'Endereço removido', detalhe: de ? `Antes: ${de}` : null, autor: evento.usuario_nome });
      } else if (evento.tipo === 'arquivada') {
        lista.push({ tipo: 'arquivada', em: evento.criado_em, titulo: 'Arquivada', detalhe: typeof detalhe.motivo === 'string' ? detalhe.motivo : null, autor: evento.usuario_nome });
      } else if (evento.tipo === 'restaurada') {
        lista.push({ tipo: 'restaurada', em: evento.criado_em, titulo: 'Restaurada ao estoque ativo', detalhe: null, autor: evento.usuario_nome });
      }
    }
  } else {
    if (unidade.organizada_em) lista.push({ tipo: 'endereco', em: unidade.organizada_em, titulo: 'Endereço definido', detalhe: 'Último endereço registrado', autor: null });
    if (unidade.arquivada_em) lista.push({ tipo: 'arquivada', em: unidade.arquivada_em, titulo: 'Arquivada', detalhe: unidade.motivo_arquivamento ?? null, autor: null });
  }
  if (unidade.vendida_em) lista.push({ tipo: 'vendida', em: unidade.vendida_em, titulo: 'Vendida', detalhe: null, autor: null });
  return lista.sort((a, b) => Date.parse(b.em) - Date.parse(a.em));
}

// Registro em memória dos arquivos enviados por este endpoint: o descarte só
// apaga o que o MESMO usuário enviou há pouco e que nenhuma peça/unidade usa.
// Reiniciar o servidor apenas perde o registro (o arquivo fica, nada quebra).
const UPLOAD_TTL_MS = 60 * 60 * 1000;
const uploadsRecentes = new Map<string, { usuarioId: string; em: number }>();

export function podeDescartarFoto(url: string, usuarioId: string, agora = Date.now()) {
  const registro = uploadsRecentes.get(url);
  return Boolean(registro && registro.usuarioId === usuarioId && agora - registro.em <= UPLOAD_TTL_MS);
}

export function registrarUploadRecente(url: string, usuarioId: string, agora = Date.now()) {
  for (const [chave, registro] of uploadsRecentes) if (agora - registro.em > UPLOAD_TTL_MS) uploadsRecentes.delete(chave);
  uploadsRecentes.set(url, { usuarioId, em: agora });
}

const TIPOS_FOTO = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const uploadFoto = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!TIPOS_FOTO.includes(file.mimetype)) return cb(new Error('Formato de imagem não suportado (use JPG, PNG, WEBP ou GIF)'));
    cb(null, true);
  },
});

const RESERVAS_BASE = 'id, unidade_id, responsavel, reservada_ate, criada_em';
const RESERVAS_COM_CLIENTE = `${RESERVAS_BASE}, cliente_id, cliente:clientes(id, nome, telefone)`;
const RESERVAS_COM_SINAL = `${RESERVAS_COM_CLIENTE}, valor_sinal, preco_referencia, forma_pagamento_sinal_id, criada_por_nome`;
const COLUNA_AUSENTE = ['42703', 'PGRST200', 'PGRST204', '42P01', 'PGRST205'];
// Assinatura de RPC inexistente (migration nova ainda não aplicada).
const FUNCAO_AUSENTE = ['PGRST202', '42883'];

export interface RecursosOrganizacao {
  /** migration_067: cliente cadastrado vinculado à reserva. */
  clienteNaReserva: boolean;
  /** migration_068: sinal obrigatório, autoria e linha do tempo de eventos. */
  reservaComSinal: boolean;
}

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

  // Detecção de schema por leitura sem linhas (limit 0): barata e sem efeito.
  // Resultado positivo é memorizado — uma migration aplicada não "desaplica".
  const recursosConfirmados: RecursosOrganizacao = { clienteNaReserva: false, reservaComSinal: false };
  async function detectarRecursos(): Promise<RecursosOrganizacao> {
    if (!recursosConfirmados.clienteNaReserva) {
      const { error } = await supabase.from('estoque_reservas').select('cliente_id').limit(0);
      recursosConfirmados.clienteNaReserva = !error;
    }
    if (!recursosConfirmados.reservaComSinal) {
      const { error } = await supabase.from('estoque_reservas').select('valor_sinal').limit(0);
      recursosConfirmados.reservaComSinal = !error;
    }
    return { ...recursosConfirmados };
  }

  async function autorDaRequisicao(req: AuthenticatedRequest) {
    const usuario = req.usuario;
    if (!usuario) return { id: null as string | null, nome: null as string | null };
    const { data } = await supabase.from('usuarios').select('nome_exibicao').eq('id', usuario.id).maybeSingle();
    return { id: usuario.id, nome: (data as { nome_exibicao?: string } | null)?.nome_exibicao ?? usuario.username };
  }

  router.get('/locais', VER, async (_req, res) => {
    const recursos = await detectarRecursos();
    const colunas = recursos.reservaComSinal ? RESERVAS_COM_SINAL : recursos.clienteNaReserva ? RESERVAS_COM_CLIENTE : RESERVAS_BASE;
    const [locais, categorias, reservas] = await Promise.all([
      supabase.from('estoque_locais').select('*').order('deposito').order('zona').order('codigo'),
      supabase.from('estoque_local_categorias').select('local_id, categoria_id, prioridade'),
      supabase.from('estoque_reservas').select(colunas).is('liberada_em', null).gt('reservada_ate', new Date().toISOString()),
    ]);
    const error = locais.error || categorias.error || reservas.error;
    if (error) {
      const falha = erroBanco(error);
      return res.status(falha.status).json({ success: false, error: falha.error });
    }
    res.json({ success: true, data: { locais: locais.data ?? [], categorias: categorias.data ?? [], reservas: reservas.data ?? [], recursos } });
  });

  router.get('/unidades/:unidadeId/historico', VER, async (req, res) => {
    const { unidadeId } = req.params;
    if (!UUID.test(unidadeId)) return res.status(400).json({ success: false, error: 'Unidade inválida.' });
    const recursos = await detectarRecursos();
    const colunasReserva = recursos.reservaComSinal
      ? 'criada_em, reservada_ate, liberada_em, motivo_liberacao, responsavel, valor_sinal, criada_por_nome, liberada_por_nome'
      : 'criada_em, reservada_ate, liberada_em, motivo_liberacao, responsavel';
    const [unidade, reservas, eventos] = await Promise.all([
      supabase.from('estoque_unidades').select('criado_em, organizada_em, vendida_em, arquivada_em, motivo_arquivamento').eq('id', unidadeId).maybeSingle(),
      supabase.from('estoque_reservas').select(colunasReserva).eq('unidade_id', unidadeId),
      recursos.reservaComSinal
        ? supabase.from('estoque_unidade_eventos').select('tipo, criado_em, detalhe, usuario_nome').eq('unidade_id', unidadeId)
        : Promise.resolve({ data: null, error: null }),
    ]);
    const error = unidade.error || reservas.error || (eventos.error && !COLUNA_AUSENTE.includes(eventos.error.code ?? '') ? eventos.error : null);
    if (error) {
      const falha = erroBanco(error);
      return res.status(falha.status).json({ success: false, error: falha.error });
    }
    if (!unidade.data) return res.status(404).json({ success: false, error: 'Unidade não encontrada.' });
    const linhaDoTempo = montarHistoricoUnidade(unidade.data, (reservas.data ?? []) as unknown as ReservaHistoricoRow[], eventos.error ? null : (eventos.data as EventoRow[] | null));
    res.json({ success: true, data: { eventos: linhaDoTempo, autoriaRegistrada: recursos.reservaComSinal } });
  });

  router.post('/fotos', EDITAR, (req: AuthenticatedRequest, res) => {
    uploadFoto.single('imagem')(req, res, async (err) => {
      if (err) return res.status(400).json({ success: false, error: err.message });
      if (!req.file) return res.status(400).json({ success: false, error: 'Nenhum arquivo enviado' });
      try {
        const url = await uploadImagem(req.file.buffer, req.file.originalname, req.file.mimetype);
        registrarUploadRecente(url, req.usuario?.id ?? 'anonimo');
        res.json({ success: true, url });
      } catch (error) {
        res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Falha ao enviar a foto.' });
      }
    });
  });

  // Descarta fotos enviadas por /fotos que não chegaram a ser gravadas em
  // nenhuma peça/unidade (cadastro que falhou depois do upload).
  router.post('/fotos/descartar', EDITAR, async (req: AuthenticatedRequest, res) => {
    const urls: unknown = req.body?.urls;
    if (!Array.isArray(urls) || urls.length > 20 || urls.some((url) => typeof url !== 'string')) {
      return res.status(400).json({ success: false, error: 'Informe até 20 fotos para descartar.' });
    }
    const usuarioId = req.usuario?.id ?? 'anonimo';
    const descartadas: string[] = [];
    for (const url of urls as string[]) {
      if (!podeDescartarFoto(url, usuarioId)) continue;
      const [emUnidade, emPeca] = await Promise.all([
        supabase.from('estoque_unidades').select('id').contains('fotos', [url]).limit(1),
        supabase.from('estoque').select('id').contains('imagens', [url]).limit(1),
      ]);
      if (emUnidade.error || emPeca.error || emUnidade.data?.length || emPeca.data?.length) continue;
      await excluirImagemPorUrl(url);
      uploadsRecentes.delete(url);
      descartadas.push(url);
    }
    res.json({ success: true, data: { descartadas } });
  });

  router.post('/unidades/:unidadeId/reservas', EDITAR, async (req: AuthenticatedRequest, res) => {
    const { unidadeId } = req.params;
    if (!UUID.test(unidadeId)) return res.status(400).json({ success: false, error: 'Unidade inválida.' });
    const validacao = validarReservaInput(req.body);
    if ('erro' in validacao) return res.status(400).json({ success: false, error: validacao.erro });
    const recursos = await detectarRecursos();
    // Regra do usuário (23/09/2026): reserva só existe com sinal registrado.
    // Sem a migration_068 o banco não tem onde guardar o sinal, então a
    // reserva real fica bloqueada — nunca cai num caminho sem sinal.
    if (!recursos.reservaComSinal) {
      return res.status(409).json({ success: false, error: 'Reserva com sinal ainda não instalada no banco (migrations 067 e 068 pendentes). Nenhuma reserva foi criada.' });
    }
    const { responsavel, clienteId, reservadaAte, valorSinal, formaPagamentoId } = validacao.dados;
    const autor = await autorDaRequisicao(req);
    const { data, error } = await supabase.rpc('reservar_unidade_estoque', {
      p_unidade_id: unidadeId, p_responsavel: responsavel ?? '', p_ate: reservadaAte,
      p_cliente_id: recursos.clienteNaReserva ? clienteId : null,
      p_valor_sinal: valorSinal, p_forma_pagamento_id: formaPagamentoId,
      p_usuario_id: autor.id, p_usuario_nome: autor.nome,
    });
    if (error) return res.status(409).json({ success: false, error: error.message });
    return res.status(201).json({ success: true, data });
  });

  // Chama a versão da 068 (com autoria); se a assinatura ainda não existir no
  // banco, repete com a assinatura original da 066 — a operação continua
  // funcionando, só sem registrar quem fez.
  async function rpcComAutoria(req: AuthenticatedRequest, funcao: string, argumentos: Record<string, unknown>) {
    const autor = await autorDaRequisicao(req);
    const resposta = await supabase.rpc(funcao, { ...argumentos, p_usuario_id: autor.id, p_usuario_nome: autor.nome });
    if (resposta.error && FUNCAO_AUSENTE.includes(resposta.error.code ?? '')) return supabase.rpc(funcao, argumentos);
    return resposta;
  }

  router.post('/reservas/:reservaId/liberar', EDITAR, async (req: AuthenticatedRequest, res) => {
    if (!UUID.test(req.params.reservaId)) return res.status(400).json({ success: false, error: 'Reserva inválida.' });
    const { data, error } = await rpcComAutoria(req, 'liberar_reserva_estoque', { p_reserva_id: req.params.reservaId });
    if (error) return res.status(409).json({ success: false, error: error.message });
    return res.json({ success: true, data });
  });

  router.post('/unidades/:unidadeId/arquivar', EDITAR, async (req: AuthenticatedRequest, res) => {
    if (!UUID.test(req.params.unidadeId) || typeof req.body?.motivo !== 'string' || req.body.motivo.trim().length < 3 || req.body.motivo.trim().length > 240) {
      return res.status(400).json({ success: false, error: 'Informe a unidade e um motivo de 3 a 240 caracteres.' });
    }
    const { data, error } = await rpcComAutoria(req, 'arquivar_unidade_estoque', { p_unidade_id: req.params.unidadeId, p_motivo: req.body.motivo.trim() });
    if (error) return res.status(409).json({ success: false, error: error.message });
    return res.json({ success: true, data });
  });

  router.post('/unidades/:unidadeId/restaurar', EDITAR, async (req: AuthenticatedRequest, res) => {
    if (!UUID.test(req.params.unidadeId)) return res.status(400).json({ success: false, error: 'Unidade inválida.' });
    const { data, error } = await rpcComAutoria(req, 'restaurar_unidade_estoque', { p_unidade_id: req.params.unidadeId });
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

  router.patch('/locais/:localId', EDITAR, async (req, res) => {
    const { localId } = req.params;
    if (!UUID.test(localId)) return res.status(400).json({ success: false, error: 'Local inválido.' });
    const validacao = validarAtualizacaoLocal(req.body);
    if ('erro' in validacao) return res.status(400).json({ success: false, error: validacao.erro });
    if (validacao.dados.ativo === false) {
      // Decisão do usuário (23/09/2026): local com peças não é desativado;
      // nenhuma unidade pode ficar apontando para um endereço escondido.
      const { count, error: erroContagem } = await supabase.from('estoque_unidades').select('id', { count: 'exact', head: true })
        .eq('endereco_id', localId).is('vendida_em', null).is('arquivada_em', null);
      if (erroContagem) {
        const falha = erroBanco(erroContagem);
        return res.status(falha.status).json({ success: false, error: falha.error });
      }
      if (count) return res.status(409).json({ success: false, error: `Mova ${count === 1 ? 'a unidade guardada' : `as ${count} unidades guardadas`} neste local antes de desativá-lo.` });
    }
    const { data, error } = await supabase.from('estoque_locais').update(validacao.dados).eq('id', localId).select('*').maybeSingle();
    if (error) {
      const falha = erroBanco(error);
      return res.status(falha.status).json({ success: false, error: falha.error });
    }
    if (!data) return res.status(404).json({ success: false, error: 'Local não encontrado.' });
    res.json({ success: true, data });
  });

  router.patch('/locais/:localId/categorias/:categoriaId', EDITAR, async (req, res) => {
    const { localId, categoriaId } = req.params;
    if (!UUID.test(localId) || !UUID.test(categoriaId)) return res.status(400).json({ success: false, error: 'Local ou categoria inválido.' });
    const prioridade = req.body?.prioridade;
    if (!Number.isInteger(prioridade) || prioridade < 1 || prioridade > 3) return res.status(400).json({ success: false, error: 'Prioridade deve ser 1, 2 ou 3.' });
    const { data, error } = await supabase.from('estoque_local_categorias').update({ prioridade })
      .eq('local_id', localId).eq('categoria_id', categoriaId).select('*').maybeSingle();
    if (error) {
      const falha = erroBanco(error);
      return res.status(falha.status).json({ success: false, error: falha.error });
    }
    if (!data) return res.status(404).json({ success: false, error: 'Vínculo não encontrado.' });
    res.json({ success: true, data });
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
