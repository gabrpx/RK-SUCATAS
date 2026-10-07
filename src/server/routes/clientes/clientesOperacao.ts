import { Router, type Response } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuthenticatedRequest } from '../../../../middleware/auth.js';
import { exigirAlguma, exigirPermissao, temPermissao } from '../../../../middleware/auth.js';
import {
  ORIGENS_CLIENTE,
  normalizarInstagram,
  normalizarTelefone,
  validarClienteInput,
  validarPedidoInput,
} from './clientesValidacao.js';

type Registro = Record<string, unknown>;

const ERROS_CAPABILITY_AUSENTE = new Set(['42P01', '42703', 'PGRST204', 'PGRST205']);
const STATUS_ATIVOS = ['nova', 'em_busca', 'peca_disponivel', 'aguardando_cliente', 'aguardando'];
const STATUS_PEDIDO = new Set([
  ...STATUS_ATIVOS,
  'vendida',
  'nao_encontrada',
  'cliente_desistiu',
  'cancelada',
  'atendida',
]);
const ACOES_PEDIDO = new Set([
  'iniciar_busca',
  'cliente_avisado',
  'cliente_desistiu',
  'aguardando_resposta',
  'vai_buscar',
  'nao_quer_mais',
  'marcar_nao_encontrada',
  'cancelar',
  'reabrir',
]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function objeto(value: unknown): Registro {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Registro) : {};
}

function stringLimitada(value: unknown, limite: number): string {
  return typeof value === 'string' ? value.trim().slice(0, limite) : '';
}

function erroCodigo(error: unknown): string | null {
  return typeof error === 'object' && error !== null && 'code' in error ? String((error as { code?: unknown }).code ?? '') : null;
}

function erroCapabilityAusente(error: unknown): boolean {
  const codigo = erroCodigo(error);
  if (codigo !== null) return ERROS_CAPABILITY_AUSENTE.has(codigo);
  // Alguns projetos Supabase respondem a colunas opcionais ainda ausentes com
  // HTTP 400 e apenas `{ message: '' }`, sem preservar o código do Postgres.
  // Esta função é usada somente nas sondagens de módulos futuros do resumo.
  const registro = objeto(error);
  return Object.keys(registro).length === 1 && registro.message === '';
}

function registrarErro(contexto: string, error: unknown): void {
  console.error(contexto, { code: erroCodigo(error) ?? 'UNKNOWN' });
}

function cursorCodificar(row: Registro): string {
  return Buffer.from(JSON.stringify({ criado_em: row.criado_em, id: row.id }), 'utf8').toString('base64url');
}

function cursorDecodificar(raw: unknown): { criado_em: string; id: string } | null {
  const texto = stringLimitada(raw, 500);
  if (!texto) return null;
  try {
    const value = JSON.parse(Buffer.from(texto, 'base64url').toString('utf8')) as unknown;
    const parsed = objeto(value);
    const criadoEm = stringLimitada(parsed.criado_em, 40);
    const id = stringLimitada(parsed.id, 60);
    if (!criadoEm || !Number.isFinite(Date.parse(criadoEm)) || !UUID.test(id)) return null;
    return { criado_em: criadoEm, id };
  } catch {
    return null;
  }
}

function limparBuscaAproximada(value: unknown): string {
  return stringLimitada(value, 120).replace(/[%_,()."']/g, ' ').replace(/\s+/g, ' ').trim();
}

function payloadMoto(input: unknown): Registro | undefined {
  const moto = objeto(input);
  const permitido: Registro = {};
  for (const campo of ['modelo_moto_id', 'modelo_texto', 'placa', 'chassi', 'ano', 'cor', 'observacoes']) {
    const valor = stringLimitada(moto[campo], campo === 'observacoes' ? 1000 : 160);
    if (valor) permitido[campo] = valor;
  }
  return Object.keys(permitido).length > 0 ? permitido : undefined;
}

function respostaValidacao(res: Response, erros: string[]) {
  return res.status(400).json({ success: false, error: erros.join('. '), details: erros });
}

export function clientesOperacaoRouter(supabase: SupabaseClient) {
  const router = Router();
  const VER = exigirPermissao('clientes.ver');
  const EDITAR = exigirPermissao('clientes.editar');
  const ADMINISTRAR = exigirPermissao('clientes.administrar');
  const CRIAR_OU_EDITAR = exigirAlguma('clientes.criar', 'clientes.editar');

  router.get('/resumo', VER, async (_req, res) => {
    try {
      const consultas = await Promise.all([
        supabase.from('clientes').select('id', { count: 'exact', head: true }),
        supabase
          .from('pecas_procuradas')
          .select('id, cliente_id, status, criado_em, prometido_para, proxima_acao_em, responsavel_id')
          .in('status', STATUS_ATIVOS),
        supabase
          .from('clientes_eventos')
          .select('tipo', { count: 'exact', head: true })
          .in('tipo', ['duplicidade_sugerida', 'duplicidade_reutilizada', 'duplicidade_confirmada_separada']),
        supabase
          .from('tarefas')
          .select('id', { count: 'exact', head: true })
          .in('visita_status', ['agendada', 'confirmada', 'reagendada'])
          .lt('prazo', new Date().toISOString()),
        supabase
          .from('estoque_reservas')
          .select('id', { count: 'exact', head: true })
          .not('decisao_pendente_em', 'is', null),
        supabase.from('pecas_procuradas_matches').select('id', { count: 'exact', head: true }),
      ]);

      const [clientes, pedidosRaw, duplicidadesRaw, visitasRaw, reservasRaw, matchesRaw] = consultas;
      if (clientes.error) throw clientes.error;
      const pedidos = pedidosRaw.error
        ? erroCapabilityAusente(pedidosRaw.error) ? { disponivel: false, data: [] } : (() => { throw pedidosRaw.error; })()
        : { disponivel: true, data: pedidosRaw.data ?? [] };
      const duplicidades = duplicidadesRaw.error
        ? erroCapabilityAusente(duplicidadesRaw.error) ? { disponivel: false, data: [] } : (() => { throw duplicidadesRaw.error; })()
        : { disponivel: true, data: duplicidadesRaw.data ?? [] };
      const visitas = visitasRaw.error
        ? erroCapabilityAusente(visitasRaw.error) ? { disponivel: false, data: [] } : (() => { throw visitasRaw.error; })()
        : { disponivel: true, data: visitasRaw.data ?? [] };
      const reservas = reservasRaw.error
        ? erroCapabilityAusente(reservasRaw.error) ? { disponivel: false, data: [] } : (() => { throw reservasRaw.error; })()
        : { disponivel: true, data: reservasRaw.data ?? [] };
      const matches = matchesRaw.error
        ? erroCapabilityAusente(matchesRaw.error) ? { disponivel: false, data: [] } : (() => { throw matchesRaw.error; })()
        : { disponivel: true, data: matchesRaw.data ?? [] };

      const porStatus = (pedidos.data as Registro[]).reduce<Record<string, number>>((acc, pedido) => {
        const status = String(pedido.status ?? 'desconhecido');
        acc[status] = (acc[status] ?? 0) + 1;
        return acc;
      }, {});
      const agora = Date.now();
      const porIdade = (pedidos.data as Registro[]).reduce<{
        ate_2_dias: number;
        de_3_a_7_dias: number;
        mais_de_7_dias: number;
      }>(
        (acc, pedido) => {
          const criadaEm = Date.parse(String(pedido.criado_em ?? ''));
          if (!Number.isFinite(criadaEm)) return acc;
          const dias = Math.max(0, Math.floor((agora - criadaEm) / 86_400_000));
          if (dias <= 2) acc.ate_2_dias += 1;
          else if (dias <= 7) acc.de_3_a_7_dias += 1;
          else acc.mais_de_7_dias += 1;
          return acc;
        },
        { ate_2_dias: 0, de_3_a_7_dias: 0, mais_de_7_dias: 0 }
      );
      const semResposta48h = (pedidos.data as Registro[]).filter((pedido) => {
        if (pedido.status !== 'aguardando_cliente') return false;
        const proxima = Date.parse(String(pedido.proxima_acao_em ?? ''));
        return Number.isFinite(proxima) && proxima <= agora;
      }).length;

      res.json({
        success: true,
        data: {
          total_clientes: clientes.count ?? 0,
          pedidos_por_status: porStatus,
          pendencias_por_idade: porIdade,
          respostas_acima_48h: semResposta48h,
          reservas_sem_decisao: reservasRaw.count ?? 0,
          visitas_vencidas: visitasRaw.count ?? 0,
          decisoes_duplicidade: duplicidadesRaw.count ?? 0,
          capabilities: {
            base: pedidos.disponivel && duplicidades.disponivel,
            visitas: visitas.disponivel,
            reservas: reservas.disponivel,
            matches: matches.disponivel,
          },
          visitas: visitas.data,
          reservas: reservas.data,
          matches: matches.data,
        },
      });
    } catch (error) {
      registrarErro('Erro ao carregar resumo operacional de clientes', error);
      res.status(500).json({ success: false, error: 'Não foi possível carregar o resumo de clientes' });
    }
  });

  router.get('/clientes', VER, async (req, res) => {
    try {
      const limite = Math.min(100, Math.max(1, Number(req.query.limit) || 30));
      const cursor = cursorDecodificar(req.query.cursor);
      if (req.query.cursor && !cursor) return respostaValidacao(res, ['Cursor inválido']);

      const responsavel = stringLimitada(req.query.responsavel, 60);
      const somenteSemPendencias = req.query.semPendencias === 'true';
      const relacaoPedidos = responsavel ? 'pedidos:pecas_procuradas!inner' : 'pedidos:pecas_procuradas';
      const relacaoAtivas = somenteSemPendencias
        ? ', pedidos_ativas:pecas_procuradas!left(id)'
        : '';
      let query: any = supabase
        .from('clientes')
        .select(
          'id, nome, telefone, instagram_usuario, preferencia_contato, origem, cidade, estado, ativo, banido, criado_em, atualizado_em, ' +
          'motos:clientes_motos(id, modelo_moto_id, modelo_texto, ano, principal, modelo_moto:modelos_moto(id, nome, ano)), ' +
          `${relacaoPedidos}(id, descricao, status, responsavel_id, prometido_para, proxima_acao_em, criado_em)` +
          relacaoAtivas
        )
        .order('criado_em', { ascending: false })
        .order('id', { ascending: false })
        .limit(limite + 1);

      const cidade = stringLimitada(req.query.cidade, 120);
      const origem = stringLimitada(req.query.origem, 40);
      const busca = limparBuscaAproximada(req.query.busca);
      if (cidade) query = query.eq('cidade', cidade);
      if (origem) query = query.eq('origem', origem);
      if (responsavel) query = query.eq('pedidos.responsavel_id', responsavel);
      if (req.query.ativo === 'true') query = query.eq('ativo', true);
      if (req.query.ativo === 'false') query = query.eq('ativo', false);
      if (busca) query = query.or(`nome.ilike.%${busca}%,telefone.ilike.%${busca}%,instagram_usuario.ilike.%${busca}%,cidade.ilike.%${busca}%`);
      if (req.query.cadastroIncompleto === 'true') {
        query = query.or('and(telefone.is.null,instagram_usuario.is.null),cidade.is.null,estado.is.null,origem.is.null');
      }
      if (somenteSemPendencias) {
        query = query.in('pedidos_ativas.status', STATUS_ATIVOS).is('pedidos_ativas', null);
      }
      if (cursor) query = query.or(`criado_em.lt.${cursor.criado_em},and(criado_em.eq.${cursor.criado_em},id.lt.${cursor.id})`);

      const { data, error } = await query;
      if (error) throw error;
      const linhas = ((data ?? []) as Registro[]);
      const temMais = linhas.length > limite;
      const itens = linhas.slice(0, limite);
      res.json({
        success: true,
        data: {
          itens,
          proximo_cursor: temMais && itens.length > 0 ? cursorCodificar(itens[itens.length - 1]) : null,
        },
      });
    } catch (error) {
      registrarErro('Erro ao listar clientes operacionais', error);
      res.status(500).json({ success: false, error: 'Não foi possível listar os clientes' });
    }
  });

  router.get('/clientes/:clienteId', VER, async (req, res) => {
    if (!UUID.test(req.params.clienteId)) return respostaValidacao(res, ['Cliente inválido']);
    try {
      const [cliente, eventos] = await Promise.all([
        supabase
          .from('clientes')
          .select(
            '*, notas:clientes_notas(*, autor:usuarios(id, nome_exibicao)), ' +
            'motos:clientes_motos(*, modelo_moto:modelos_moto(id, nome, ano)), ' +
            'pecas_procuradas:pecas_procuradas(*, categoria:categorias(id, nome), modelo_moto:modelos_moto(id, nome, ano)), ' +
            'comprovantes_pix:comprovantes_pix(*, venda:vendas(id, nome_item, data))'
          )
          .eq('id', req.params.clienteId)
          .maybeSingle(),
        supabase.from('clientes_eventos').select('id, tipo, detalhe, criado_por, criado_em').eq('cliente_id', req.params.clienteId).order('criado_em', { ascending: false }),
      ]);
      if (cliente.error) throw cliente.error;
      if (!cliente.data) return res.status(404).json({ success: false, error: 'Cliente não encontrado' });
      if (eventos.error && !erroCapabilityAusente(eventos.error)) throw eventos.error;
      res.json({ success: true, data: { ...(cliente.data as unknown as Registro), eventos: eventos.data ?? [] } });
    } catch (error) {
      registrarErro('Erro ao buscar cliente operacional', error);
      res.status(500).json({ success: false, error: 'Não foi possível carregar o cliente' });
    }
  });

  router.post('/duplicidades', CRIAR_OU_EDITAR, async (req, res) => {
    try {
      const body = objeto(req.body);
      const telefone = normalizarTelefone(body.telefone);
      const instagram = normalizarInstagram(body.instagram_usuario);
      const nome = limparBuscaAproximada(body.nome);
      if (!telefone && !instagram && nome.length < 2) return respostaValidacao(res, ['Informe nome, WhatsApp ou Instagram']);

      const colunas = 'id, nome, telefone, instagram_usuario, cidade, estado, ativo';
      const consultas: Array<{ criterio: string; promise: PromiseLike<{ data: unknown[] | null; error: unknown }> }> = [];
      if (telefone) consultas.push({ criterio: 'whatsapp', promise: supabase.from('clientes').select(colunas).eq('telefone', telefone).limit(10) });
      if (instagram) consultas.push({ criterio: 'instagram', promise: supabase.from('clientes').select(colunas).ilike('instagram_usuario', instagram).limit(10) });
      if (nome.length >= 2) consultas.push({ criterio: 'nome', promise: supabase.from('clientes').select(colunas).ilike('nome', `%${nome}%`).limit(10) });

      const resultados = await Promise.all(consultas.map(async ({ criterio, promise }) => ({ criterio, resultado: await promise })));
      const candidatos = new Map<string, Registro & { criterios: string[] }>();
      for (const { criterio, resultado } of resultados) {
        if (resultado.error) throw resultado.error;
        for (const raw of resultado.data ?? []) {
          const candidato = objeto(raw);
          const id = String(candidato.id ?? '');
          if (!id) continue;
          const atual = candidatos.get(id) ?? { ...candidato, criterios: [] };
          if (!atual.criterios.includes(criterio)) atual.criterios.push(criterio);
          candidatos.set(id, atual);
        }
      }
      res.json({ success: true, data: [...candidatos.values()] });
    } catch (error) {
      registrarErro('Erro ao procurar duplicidades de cliente', error);
      res.status(500).json({ success: false, error: 'Não foi possível verificar cadastros semelhantes' });
    }
  });

  router.post('/clientes', exigirPermissao('clientes.criar'), async (req, res) => {
    const validacao = validarClienteInput(req.body);
    if (validacao.ok === false) return respostaValidacao(res, validacao.erros);
    try {
      const { data, error } = await supabase.from('clientes').insert(validacao.valor).select('*').single();
      if (error) throw error;
      res.status(201).json({ success: true, data });
    } catch (error) {
      registrarErro('Erro ao criar cliente operacional', error);
      res.status(500).json({ success: false, error: 'Não foi possível cadastrar o cliente' });
    }
  });

  router.patch('/clientes/:clienteId', EDITAR, async (req, res) => {
    if (!UUID.test(req.params.clienteId)) return respostaValidacao(res, ['Cliente inválido']);
    try {
      const { data: atual, error: erroBusca } = await supabase.from('clientes').select('*').eq('id', req.params.clienteId).maybeSingle();
      if (erroBusca) throw erroBusca;
      if (!atual) return res.status(404).json({ success: false, error: 'Cliente não encontrado' });
      const body = objeto(req.body);
      if (body.origem !== undefined && body.origem !== (atual as Registro).origem) {
        return respostaValidacao(res, ['Correção de origem usa a ação administrativa própria']);
      }
      const validacao = validarClienteInput({ ...(atual as Registro), ...body, id: req.params.clienteId });
      if (validacao.ok === false) return respostaValidacao(res, validacao.erros);
      const { id: _id, ...payload } = validacao.valor;
      const { data, error } = await supabase.from('clientes').update(payload).eq('id', req.params.clienteId).select('*').maybeSingle();
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error) {
      registrarErro('Erro ao editar cliente operacional', error);
      res.status(500).json({ success: false, error: 'Não foi possível atualizar o cliente' });
    }
  });

  router.patch('/clientes/:clienteId/origem', ADMINISTRAR, async (req: AuthenticatedRequest, res) => {
    const origem = stringLimitada(req.body?.origem, 40);
    const motivo = stringLimitada(req.body?.motivo, 500);
    const erros: string[] = [];
    if (!UUID.test(req.params.clienteId)) erros.push('Cliente inválido');
    if (!ORIGENS_CLIENTE.includes(origem as (typeof ORIGENS_CLIENTE)[number])) erros.push('Origem inválida');
    if (motivo.length < 3) erros.push('Motivo da correção é obrigatório');
    if (erros.length > 0) return respostaValidacao(res, erros);
    try {
      const { data, error } = await supabase.rpc('corrigir_origem_cliente', {
        p_cliente_id: req.params.clienteId,
        p_nova_origem: origem,
        p_usuario_id: req.usuario!.id,
        p_motivo: motivo,
      });
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error) {
      registrarErro('Erro ao corrigir origem do cliente', error);
      res.status(500).json({ success: false, error: 'Não foi possível corrigir a origem' });
    }
  });

  router.post('/pedidos', CRIAR_OU_EDITAR, async (req: AuthenticatedRequest, res) => {
    const body = objeto(req.body);
    const clienteRaw = objeto(body.cliente);
    const pedidoRaw = objeto(body.pedido);
    const cliente = validarClienteInput(clienteRaw);
    const pedido = validarPedidoInput({ ...pedidoRaw, responsavel_id: pedidoRaw.responsavel_id ?? req.usuario?.id });
    if (cliente.ok === false || pedido.ok === false) {
      return respostaValidacao(res, [
        ...(cliente.ok === false ? cliente.erros : []),
        ...(pedido.ok === false ? pedido.erros : []),
      ]);
    }

    const clienteExistente = Boolean(cliente.valor.id);
    if (clienteExistente && !temPermissao(req.usuario, 'clientes.editar')) {
      return res.status(403).json({ success: false, error: 'Acesso negado: editar cliente existente não é permitido' });
    }
    if (!clienteExistente && !temPermissao(req.usuario, 'clientes.criar')) {
      return res.status(403).json({ success: false, error: 'Acesso negado: cadastrar novo cliente não é permitido' });
    }

    const clienteRpc: Registro = { ...cliente.valor };
    const moto = payloadMoto(clienteRaw.moto);
    if (moto) clienteRpc.moto = moto;
    const decisao = stringLimitada(clienteRaw.duplicidade_decisao, 40);
    if (['sugerida', 'reutilizada', 'confirmada_separada'].includes(decisao)) clienteRpc.duplicidade_decisao = decisao;
    if (Array.isArray(clienteRaw.duplicidade_criterios)) {
      clienteRpc.duplicidade_criterios = clienteRaw.duplicidade_criterios
        .map((item) => stringLimitada(item, 20))
        .filter((item) => ['nome', 'whatsapp', 'instagram'].includes(item));
    }

    try {
      const { data, error } = await supabase.rpc('registrar_cliente_com_pedido', {
        p_cliente: clienteRpc,
        p_pedido: pedido.valor,
        p_usuario_id: req.usuario!.id,
      });
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error) {
      registrarErro('Erro na RPC registrar_cliente_com_pedido', error);
      res.status(500).json({ success: false, error: 'Não foi possível registrar o pedido' });
    }
  });

  router.patch('/pedidos/:pedidoId/status', EDITAR, async (req: AuthenticatedRequest, res) => {
    const status = stringLimitada(req.body?.status, 40);
    const motivo = stringLimitada(req.body?.motivo, 500) || null;
    const vendaId = stringLimitada(req.body?.venda_id, 60) || null;
    const erros: string[] = [];
    if (!UUID.test(req.params.pedidoId)) erros.push('Pedido inválido');
    if (!STATUS_PEDIDO.has(status)) erros.push('Status inválido');
    if (erros.length > 0) return respostaValidacao(res, erros);
    try {
      const { data, error } = await supabase.rpc('transicionar_pedido_busca', {
        p_pedido_id: req.params.pedidoId,
        p_novo_status: status,
        p_usuario_id: req.usuario!.id,
        p_motivo: motivo,
        p_venda_id: vendaId,
      });
      if (error) return res.status(400).json({ success: false, error: 'Transição de pedido inválida' });
      res.json({ success: true, data });
    } catch (error) {
      registrarErro('Erro ao transicionar pedido de cliente', error);
      res.status(500).json({ success: false, error: 'Não foi possível atualizar o pedido' });
    }
  });

  router.post('/pedidos/:pedidoId/acao', EDITAR, async (req: AuthenticatedRequest, res) => {
    const acao = stringLimitada(req.body?.acao, 40);
    const erros: string[] = [];
    if (!UUID.test(req.params.pedidoId)) erros.push('Pedido inválido');
    if (!ACOES_PEDIDO.has(acao)) erros.push('Ação inválida');
    if (erros.length > 0) return respostaValidacao(res, erros);
    const motivo = stringLimitada(req.body?.motivo, 500);
    if (['cliente_desistiu', 'nao_quer_mais', 'marcar_nao_encontrada', 'cancelar'].includes(acao) && motivo.length < 3) {
      return respostaValidacao(res, ['Motivo é obrigatório para encerrar o pedido']);
    }
    try {
      const { data, error } = await supabase.rpc('registrar_acao_pedido', {
        p_pedido_id: req.params.pedidoId,
        p_acao: acao,
        p_usuario_id: req.usuario!.id,
        p_detalhe: motivo ? { motivo } : {},
      });
      if (error) return res.status(400).json({ success: false, error: 'Ação incompatível com o estado atual' });
      res.json({ success: true, data });
    } catch (error) {
      registrarErro('Erro ao registrar ação do pedido', error);
      res.status(500).json({ success: false, error: 'Não foi possível registrar a ação' });
    }
  });

  router.patch('/clientes/:clienteId/moto-principal', EDITAR, async (req: AuthenticatedRequest, res) => {
    const motoId = stringLimitada(req.body?.moto_id, 60);
    if (!UUID.test(req.params.clienteId) || !UUID.test(motoId)) return respostaValidacao(res, ['Cliente ou moto inválido']);
    try {
      const { data, error } = await supabase.rpc('definir_moto_principal', {
        p_cliente_id: req.params.clienteId,
        p_moto_id: motoId,
      });
      if (error) return res.status(400).json({ success: false, error: 'A moto não pertence ao cliente' });
      res.json({ success: true, data });
    } catch (error) {
      registrarErro('Erro ao definir moto principal', error);
      res.status(500).json({ success: false, error: 'Não foi possível definir a moto principal' });
    }
  });

  return router;
}
