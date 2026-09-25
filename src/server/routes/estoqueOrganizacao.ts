import { Router } from 'express';
import { EventEmitter } from 'node:events';
import multer from 'multer';
import type { SupabaseClient } from '@supabase/supabase-js';
import { exigirAlguma, exigirPermissao, temPermissao } from '../../../middleware/auth.js';
import type { AuthenticatedRequest } from '../../../middleware/auth.js';
import { excluirImagemPorUrl, uploadImagem } from '../../services/storageService.js';

const VER = exigirPermissao('estoque.ver');
const EDITAR = exigirPermissao('estoque.editar');
const CRIAR = exigirPermissao('estoque.criar');
const CRIAR_OU_EDITAR = exigirAlguma('estoque.criar', 'estoque.editar');
/** Quem só tem "criar" pode completar a ficha recém-gerada de uma peça nova. */
const JANELA_FICHA_NOVA_MS = 15 * 60 * 1000;
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

/** Campos que o novo estoque grava numa ficha (criação ou edição). */
export interface UnidadePayload {
  valor?: number | null;
  condicao_nota?: number | null;
  fotos?: string[];
  endereco_id?: string | null;
  origem_identificacao?: string | null;
}

const MAX_FOTOS_UNIDADE = 10;

// Mesmas regras da RPC editar_unidade_estoque (migration_069), repetidas aqui
// para responder 400 com mensagem clara antes de chegar ao banco. Chave
// ausente = não altera na edição; null = preço ainda não definido.
export function validarUnidadePayload(body: unknown, modo: 'criar' | 'editar'): { erro: string } | { dados: UnidadePayload } {
  const valor = (body ?? {}) as Record<string, unknown>;
  const dados: UnidadePayload = {};
  if (valor.valor !== undefined || modo === 'criar') {
    const preco = valor.valor;
    if (preco == null || preco === '') dados.valor = null;
    else if (typeof preco !== 'number' || !Number.isFinite(preco) || preco <= 0) return { erro: 'Informe um preço de venda maior que zero.' };
    else dados.valor = Math.round(preco * 100) / 100;
  }
  if (valor.condicao_nota !== undefined) {
    const nota = valor.condicao_nota;
    if (nota === null) dados.condicao_nota = null;
    else if (typeof nota !== 'number' || !Number.isInteger(nota) || nota < 1 || nota > 10) return { erro: 'Nota da condição deve ficar entre 1 e 10.' };
    else dados.condicao_nota = nota;
  }
  if (valor.fotos !== undefined) {
    const fotos = valor.fotos;
    if (!Array.isArray(fotos) || fotos.length > MAX_FOTOS_UNIDADE || fotos.some((url) => typeof url !== 'string' || !/^https?:\/\//.test(url))) {
      return { erro: `Envie até ${MAX_FOTOS_UNIDADE} fotos por unidade.` };
    }
    dados.fotos = fotos as string[];
  }
  if (valor.endereco_id !== undefined) {
    const endereco = valor.endereco_id;
    if (endereco !== null && (typeof endereco !== 'string' || !UUID.test(endereco))) return { erro: 'Escolha um local cadastrado.' };
    dados.endereco_id = endereco as string | null;
  }
  if (valor.origem_identificacao !== undefined) {
    const origem = valor.origem_identificacao;
    if (origem !== null && (typeof origem !== 'string' || origem.length > 240)) return { erro: 'Origem deve ter até 240 caracteres.' };
    dados.origem_identificacao = typeof origem === 'string' ? origem.trim() || null : null;
  }
  if (!Object.keys(dados).length) return { erro: 'Nenhuma alteração informada.' };
  return { dados };
}

export type TipoEventoHistorico = 'cadastrada' | 'endereco' | 'reservada' | 'reserva_liberada' | 'reserva_vencida' | 'arquivada' | 'restaurada' | 'vendida'
  | 'editada' | 'baixa_automatica' | 'baixa_conferida' | 'baixa_corrigida' | 'baixa_desfeita' | 'baixa_excedente';

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

function grauDaNota(nota: unknown) {
  if (typeof nota !== 'number') return 'sem nota';
  return nota >= 8 ? 'A' : nota >= 5 ? 'B' : 'C';
}

// Resume o detalhe do evento 'editada' (migration_069): {campo: {de, para}}.
export function descreverEdicao(detalhe: Record<string, unknown>): string | null {
  const partes: string[] = [];
  const mudanca = (campo: string) => (detalhe[campo] ?? null) as { de?: unknown; para?: unknown } | null;
  const valor = mudanca('valor');
  if (valor) partes.push(`Preço ${valor.de == null ? 'herdado' : brl(Number(valor.de))} → ${valor.para == null ? 'herdado' : brl(Number(valor.para))}`);
  const nota = mudanca('condicao_nota');
  if (nota) partes.push(`Condição ${grauDaNota(nota.de)} → ${grauDaNota(nota.para)}`);
  const origem = mudanca('origem');
  if (origem) partes.push(origem.para ? `Origem: ${String(origem.para)}` : 'Origem removida');
  const fotos = mudanca('fotos');
  if (fotos) partes.push(`Fotos: ${Number(fotos.de ?? 0)} → ${Number(fotos.para ?? 0)}`);
  return partes.length ? partes.join(' · ') : null;
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
      } else if (evento.tipo === 'editada') {
        lista.push({ tipo: 'editada', em: evento.criado_em, titulo: 'Ficha editada', detalhe: descreverEdicao(detalhe), autor: evento.usuario_nome });
      } else if (evento.tipo === 'baixa_automatica') {
        const item = typeof detalhe.nome_item === 'string' ? detalhe.nome_item : 'a peça';
        lista.push({ tipo: 'baixa_automatica', em: evento.criado_em, titulo: 'Baixa automática — conferir', detalhe: `Venda de ${item} registrada sem escolher a unidade; o sistema baixou esta.`, autor: null });
      } else if (evento.tipo === 'baixa_conferida') {
        lista.push({ tipo: 'baixa_conferida', em: evento.criado_em, titulo: 'Baixa conferida', detalhe: 'Equipe confirmou que foi esta unidade que saiu.', autor: evento.usuario_nome });
      } else if (evento.tipo === 'baixa_corrigida') {
        const devolvida = detalhe.papel === 'devolvida';
        lista.push({ tipo: 'baixa_corrigida', em: evento.criado_em, titulo: devolvida ? 'Baixa corrigida: voltou ao estoque' : 'Baixa corrigida: esta foi a vendida', detalhe: devolvida ? 'A venda era de outra unidade da mesma peça.' : 'Trocada na conferência da baixa automática.', autor: evento.usuario_nome });
      } else if (evento.tipo === 'baixa_excedente') {
        lista.push({ tipo: 'baixa_excedente', em: evento.criado_em, titulo: 'Baixada: já tinha saído', detalhe: 'Ficha que sobrou de uma venda antiga registrada sem unidade.', autor: evento.usuario_nome });
      } else if (evento.tipo === 'baixa_desfeita') {
        lista.push({ tipo: 'baixa_desfeita', em: evento.criado_em, titulo: 'Venda cancelada: unidade devolvida', detalhe: null, autor: null });
      }
    }
    if (unidade.organizada_em && !eventos.some((evento) => evento.tipo === 'endereco_alterado')) {
      lista.push({ tipo: 'endereco', em: unidade.organizada_em, titulo: 'Endereço definido', detalhe: 'Definido no cadastro', autor: null });
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

// Com a migration_069, o registro também fica no banco (estoque_fotos_enviadas):
// sobrevive a reinício do servidor. Foto não usada em nenhuma peça/unidade
// depois de 24 h é apagada do Storage pela limpeza abaixo.
export const FOTO_ORFA_MS = 24 * 60 * 60 * 1000;
const LIMPEZA_INTERVALO_MS = 60 * 60 * 1000;

/** Regra do registro persistente: mesmo usuário e dentro das 24 h. */
export function registroPermiteDescarte(registro: { usuario_id: string | null; enviada_em: string } | null, usuarioId: string, agora = Date.now()) {
  return Boolean(registro && registro.usuario_id === usuarioId && agora - Date.parse(registro.enviada_em) <= FOTO_ORFA_MS);
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
  /** migration_069: baixa automática, edição atômica e registro de fotos. */
  baixaAutomatica: boolean;
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
  const atualizacoes = new EventEmitter();
  atualizacoes.setMaxListeners(0);
  if (typeof supabase.channel === 'function') {
    supabase.channel('rk-estoque-atualizacoes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'estoque' }, () => atualizacoes.emit('mudanca'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'estoque_unidades' }, () => atualizacoes.emit('mudanca'))
      .subscribe((status, error) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') console.error('Falha na conexão de atualizações do estoque:', error?.message ?? status);
      });
  }

  // Detecção de schema por leitura sem linhas (limit 0): barata e sem efeito.
  // Resultado positivo é memorizado — uma migration aplicada não "desaplica".
  const recursosConfirmados: RecursosOrganizacao = { clienteNaReserva: false, reservaComSinal: false, baixaAutomatica: false };
  async function detectarRecursos(): Promise<RecursosOrganizacao> {
    if (!recursosConfirmados.clienteNaReserva) {
      const { error } = await supabase.from('estoque_reservas').select('cliente_id').limit(0);
      recursosConfirmados.clienteNaReserva = !error;
    }
    if (!recursosConfirmados.reservaComSinal) {
      const { error } = await supabase.from('estoque_reservas').select('valor_sinal').limit(0);
      recursosConfirmados.reservaComSinal = !error;
    }
    if (!recursosConfirmados.baixaAutomatica) {
      const { error } = await supabase.from('estoque_baixas_automaticas').select('id').limit(0);
      recursosConfirmados.baixaAutomatica = !error;
    }
    return { ...recursosConfirmados };
  }

  /** true = usada; false = livre; null = não deu para conferir (nada é apagado). */
  async function fotoEmUso(url: string): Promise<boolean | null> {
    if ((await detectarRecursos()).baixaAutomatica) {
      // migration_069: procura em todas as colunas de peça/unidade e anúncios.
      const { data, error } = await supabase.rpc('foto_estoque_em_uso', { p_url: url });
      return error ? null : Boolean(data);
    }
    // Sem a 069: jsonb precisa do literal JSON no operador "cs" do PostgREST.
    const [emUnidade, emPeca, emCapa] = await Promise.all([
      supabase.from('estoque_unidades').select('id').filter('fotos', 'cs', JSON.stringify([url])).limit(1),
      supabase.from('estoque').select('id').filter('imagens', 'cs', JSON.stringify([url])).limit(1),
      supabase.from('estoque').select('id').eq('imagem_url', url).limit(1),
    ]);
    if (emUnidade.error || emPeca.error || emCapa.error) return null;
    return Boolean(emUnidade.data?.length || emPeca.data?.length || emCapa.data?.length);
  }

  let ultimaLimpeza = 0;
  async function limparFotosOrfas(agora = Date.now()) {
    if (agora - ultimaLimpeza < LIMPEZA_INTERVALO_MS) return;
    ultimaLimpeza = agora;
    if (!(await detectarRecursos()).baixaAutomatica) return;
    const { data, error } = await supabase.from('estoque_fotos_enviadas').select('url')
      .lt('enviada_em', new Date(agora - FOTO_ORFA_MS).toISOString()).limit(50);
    if (error || !data) return;
    for (const { url } of data as { url: string }[]) {
      const emUso = await fotoEmUso(url);
      if (emUso === null) continue;
      if (!emUso) await excluirImagemPorUrl(url).catch((falha) => console.error('Erro ao apagar foto órfã:', falha));
      await supabase.from('estoque_fotos_enviadas').delete().eq('url', url);
    }
  }

  async function podeDescartarRegistrada(url: string, usuarioId: string) {
    if (podeDescartarFoto(url, usuarioId)) return true;
    if (!(await detectarRecursos()).baixaAutomatica) return false;
    const { data } = await supabase.from('estoque_fotos_enviadas').select('usuario_id, enviada_em').eq('url', url).maybeSingle();
    return registroPermiteDescarte(data as { usuario_id: string | null; enviada_em: string } | null, usuarioId);
  }

  async function autorDaRequisicao(req: AuthenticatedRequest) {
    const usuario = req.usuario;
    if (!usuario) return { id: null as string | null, nome: null as string | null };
    const { data } = await supabase.from('usuarios').select('nome_exibicao').eq('id', usuario.id).maybeSingle();
    return { id: usuario.id, nome: (data as { nome_exibicao?: string } | null)?.nome_exibicao ?? usuario.username };
  }

  // O navegador recebe apenas um aviso para atualizar a consulta pela API;
  // nenhuma linha ou dado do banco é transmitido pelo canal em tempo real.
  router.get('/eventos', VER, (_req, res) => {
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    res.write('event: conectado\ndata: {}\n\n');

    const enviarMudanca = () => {
      if (!res.destroyed) res.write('event: estoque-atualizado\ndata: {}\n\n');
    };
    atualizacoes.on('mudanca', enviarMudanca);
    const heartbeat = setInterval(() => {
      if (!res.destroyed) res.write(': keep-alive\n\n');
    }, 20_000);
    res.on('close', () => {
      clearInterval(heartbeat);
      atualizacoes.off('mudanca', enviarMudanca);
    });
  });

  router.get('/locais', VER, async (_req, res) => {
    const recursos = await detectarRecursos();
    const colunas = recursos.reservaComSinal ? RESERVAS_COM_SINAL : recursos.clienteNaReserva ? RESERVAS_COM_CLIENTE : RESERVAS_BASE;
    const [locais, categorias, reservas, baixas] = await Promise.all([
      supabase.from('estoque_locais').select('*').order('deposito').order('zona').order('codigo'),
      supabase.from('estoque_local_categorias').select('local_id, categoria_id, prioridade'),
      supabase.from('estoque_reservas').select(colunas).is('liberada_em', null).gt('reservada_ate', new Date().toISOString()),
      recursos.baixaAutomatica
        ? supabase.from('estoque_baixas_automaticas')
          .select('id, venda_id, unidade_id, estoque_id, criada_em, venda:vendas(data, nome_item, cliente_nome, valor_total)')
          .is('conferida_em', null).order('criada_em', { ascending: false }).limit(200)
        : Promise.resolve({ data: [], error: null }),
    ]);
    const error = locais.error || categorias.error || reservas.error || baixas.error;
    if (error) {
      const falha = erroBanco(error);
      return res.status(falha.status).json({ success: false, error: falha.error });
    }
    res.json({ success: true, data: { locais: locais.data ?? [], categorias: categorias.data ?? [], reservas: reservas.data ?? [], baixasPendentes: baixas.data ?? [], recursos } });
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

  router.post('/fotos', CRIAR_OU_EDITAR, (req: AuthenticatedRequest, res) => {
    uploadFoto.single('imagem')(req, res, async (err) => {
      if (err) return res.status(400).json({ success: false, error: err.message });
      if (!req.file) return res.status(400).json({ success: false, error: 'Nenhum arquivo enviado' });
      try {
        const url = await uploadImagem(req.file.buffer, req.file.originalname, req.file.mimetype);
        const usuarioId = req.usuario?.id ?? 'anonimo';
        registrarUploadRecente(url, usuarioId);
        if ((await detectarRecursos()).baixaAutomatica) {
          const { error } = await supabase.from('estoque_fotos_enviadas').insert({ url, usuario_id: usuarioId });
          if (error) console.error('Erro ao registrar foto enviada:', error);
        }
        res.json({ success: true, url });
        void limparFotosOrfas().catch((falha) => console.error('Erro na limpeza de fotos órfãs:', falha));
      } catch (error) {
        res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Falha ao enviar a foto.' });
      }
    });
  });

  // Descarta fotos enviadas por /fotos que não chegaram a ser gravadas em
  // nenhuma peça/unidade (cadastro que falhou depois do upload).
  router.post('/fotos/descartar', CRIAR_OU_EDITAR, async (req: AuthenticatedRequest, res) => {
    const urls: unknown = req.body?.urls;
    if (!Array.isArray(urls) || urls.length > 20 || urls.some((url) => typeof url !== 'string')) {
      return res.status(400).json({ success: false, error: 'Informe até 20 fotos para descartar.' });
    }
    const usuarioId = req.usuario?.id ?? 'anonimo';
    const descartadas: string[] = [];
    for (const url of urls as string[]) {
      if (!(await podeDescartarRegistrada(url, usuarioId))) continue;
      if ((await fotoEmUso(url)) !== false) continue;
      await excluirImagemPorUrl(url);
      uploadsRecentes.delete(url);
      if (recursosConfirmados.baixaAutomatica) await supabase.from('estoque_fotos_enviadas').delete().eq('url', url);
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

  // Conferência da baixa automática (migration_069): confirma a unidade que o
  // sistema escolheu ou troca pela que realmente saiu. A RPC valida tudo.
  router.post('/baixas/:baixaId/conferir', EDITAR, async (req: AuthenticatedRequest, res) => {
    const { baixaId } = req.params;
    const correta = req.body?.unidade_correta_id ?? null;
    if (!UUID.test(baixaId) || (correta !== null && (typeof correta !== 'string' || !UUID.test(correta)))) {
      return res.status(400).json({ success: false, error: 'Baixa ou unidade inválida.' });
    }
    if (!(await detectarRecursos()).baixaAutomatica) {
      return res.status(409).json({ success: false, error: 'Conferência de baixa ainda não instalada no banco (migration 069 pendente).' });
    }
    const autor = await autorDaRequisicao(req);
    const { data, error } = await supabase.rpc('conferir_baixa_automatica', {
      p_baixa_id: baixaId, p_unidade_correta_id: correta, p_usuario_id: autor.id, p_usuario_nome: autor.nome,
    });
    if (error) return res.status(/não encontrada/i.test(error.message) ? 404 : 409).json({ success: false, error: error.message });
    return res.json({ success: true, data });
  });

  // Ficha que sobrou de venda antiga (antes da 069): marca como vendida sem
  // mexer na quantidade. A RPC recusa quando não há sobra.
  router.post('/unidades/:unidadeId/baixar-excedente', EDITAR, async (req: AuthenticatedRequest, res) => {
    const { unidadeId } = req.params;
    if (!UUID.test(unidadeId)) return res.status(400).json({ success: false, error: 'Unidade inválida.' });
    if (!(await detectarRecursos()).baixaAutomatica) {
      return res.status(409).json({ success: false, error: 'Conferência de estoque ainda não instalada no banco (migration 069 pendente).' });
    }
    const autor = await autorDaRequisicao(req);
    const { data, error } = await supabase.rpc('baixar_ficha_excedente', { p_unidade_id: unidadeId, p_usuario_id: autor.id, p_usuario_nome: autor.nome });
    if (error) return res.status(409).json({ success: false, error: error.message });
    return res.json({ success: true, data });
  });

  async function localAtivo(enderecoId: string | null | undefined) {
    if (!enderecoId) return { ok: true as const };
    const { data, error } = await supabase.from('estoque_locais').select('id').eq('id', enderecoId).eq('ativo', true).maybeSingle();
    if (error) return { ok: false as const, ...erroBanco(error) };
    if (!data) return { ok: false as const, status: 400, error: 'Local inativo ou inexistente.' };
    return { ok: true as const };
  }

  // Cadastro de unidade de peça existente numa única transação: ficha,
  // preço, nota, fotos, endereço e origem (adicionar_unidade_estoque, 065).
  router.post('/pecas/:pecaId/unidades', CRIAR, async (req, res) => {
    const { pecaId } = req.params;
    if (!UUID.test(pecaId)) return res.status(400).json({ success: false, error: 'Peça inválida.' });
    const validacao = validarUnidadePayload(req.body, 'criar');
    if ('erro' in validacao) return res.status(400).json({ success: false, error: validacao.erro });
    const local = await localAtivo(validacao.dados.endereco_id);
    if ('error' in local) return res.status(local.status).json({ success: false, error: local.error });
    const { data, error } = await supabase.rpc('adicionar_unidade_estoque', { p_estoque_id: pecaId, p_payload: validacao.dados });
    if (error) {
      if (FUNCAO_AUSENTE.includes(error.code ?? '')) {
        return res.status(503).json({ success: false, error: 'Atualize o banco com a migration de organização antes de cadastrar novas unidades.' });
      }
      return res.status(409).json({ success: false, error: error.message });
    }
    return res.status(201).json({ success: true, data });
  });

  // Edição da ficha numa única transação (editar_unidade_estoque, 069). Sem a
  // 069, cai num UPDATE único condicionado a "não vendida e não arquivada" —
  // também atômico, só sem o registro de autoria.
  router.post('/unidades/:unidadeId/editar', async (req: AuthenticatedRequest, res) => {
    const podeEditar = temPermissao(req.usuario, 'estoque.editar');
    if (!podeEditar && !temPermissao(req.usuario, 'estoque.criar')) {
      return res.status(403).json({ success: false, error: 'Acesso negado: você não tem permissão para esta ação' });
    }
    const { unidadeId } = req.params;
    if (!UUID.test(unidadeId)) return res.status(400).json({ success: false, error: 'Unidade inválida.' });
    const validacao = validarUnidadePayload(req.body, 'editar');
    if ('erro' in validacao) return res.status(400).json({ success: false, error: validacao.erro });
    const dados = validacao.dados;
    const { data: antes, error: erroLeitura } = await supabase.from('estoque_unidades').select('fotos, criado_em').eq('id', unidadeId).maybeSingle();
    if (erroLeitura) {
      const falha = erroBanco(erroLeitura);
      return res.status(falha.status).json({ success: false, error: falha.error });
    }
    if (!antes) return res.status(404).json({ success: false, error: 'Unidade não encontrada.' });
    // Só "criar": completa a ficha que a peça nova acabou de gerar, nada além.
    const criadaEm = Date.parse(String((antes as { criado_em?: string }).criado_em ?? ''));
    if (!podeEditar && !(Date.now() - criadaEm <= JANELA_FICHA_NOVA_MS)) {
      return res.status(403).json({ success: false, error: 'Acesso negado: editar unidades exige permissão de edição do estoque.' });
    }

    let resultado: { data: unknown; error: { code?: string; message?: string } | null };
    if ((await detectarRecursos()).baixaAutomatica) {
      const autor = await autorDaRequisicao(req);
      resultado = await supabase.rpc('editar_unidade_estoque', {
        p_unidade_id: unidadeId, p_payload: dados, p_usuario_id: autor.id, p_usuario_nome: autor.nome,
      });
      if (resultado.error) return res.status(409).json({ success: false, error: resultado.error.message });
    } else {
      const local = await localAtivo(dados.endereco_id);
      if ('error' in local) return res.status(local.status).json({ success: false, error: local.error });
      resultado = await supabase.from('estoque_unidades').update(dados)
        .eq('id', unidadeId).is('vendida_em', null).is('arquivada_em', null).select('*').maybeSingle();
      if (resultado.error) {
        const falha = erroBanco(resultado.error);
        return res.status(falha.status).json({ success: false, error: falha.error });
      }
      if (!resultado.data) return res.status(409).json({ success: false, error: 'Unidade vendida ou arquivada não pode ser editada.' });
    }
    // Foto retirada da ficha sai do Storage (mesma regra das rotas antigas),
    // desde que nenhuma outra peça/unidade use o mesmo arquivo.
    if (dados.fotos) {
      const removidas = ((antes as { fotos?: string[] | null }).fotos ?? []).filter((url) => !dados.fotos!.includes(url));
      for (const url of removidas) {
        if ((await fotoEmUso(url)) === false) excluirImagemPorUrl(url).catch((falha) => console.error('Erro ao limpar foto da unidade:', falha));
      }
    }
    return res.json({ success: true, data: resultado.data });
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
