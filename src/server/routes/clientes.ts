// Cadastro de clientes — histórico de compras vem de vendas/orçamentos
// vinculados por cliente_id (ver vendas.ts/orcamentos.ts), calculado no
// frontend a partir dos dados já carregados (ver src/features/clientes/
// metricas.ts). Esta rota só cuida do cadastro em si e da timeline de notas.
import { Router } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuthenticatedRequest } from '../../../middleware/auth.js';
import { exigirAlguma, exigirPermissao, temPermissao } from '../../../middleware/auth.js';
import { gerarUrlAssinadaComprovante } from '../../services/storageService.js';
import { clientesOperacaoRouter } from './clientes/clientesOperacao.js';

const SELECT_COM_DETALHES =
  '*, notas:clientes_notas(*, autor:usuarios(id, nome_exibicao)), ' +
  'motos:clientes_motos(*, modelo_moto:modelos_moto(id, nome, ano)), ' +
  'pecas_procuradas:pecas_procuradas(*, categoria:categorias(id, nome), modelo_moto:modelos_moto(id, nome, ano))';

const CAMPOS_EDITAVEIS_COMUNS = [
  'nome',
  'telefone',
  'instagram_usuario',
  'documento',
  'data_nascimento',
  'preferencia_contato',
  'tags',
  'observacoes',
  'ml_nickname',
  'cidade',
  'estado',
  'cep',
  'logradouro',
  'numero',
  'complemento',
  'bairro',
] as const;
const CAMPOS_EDITAVEIS_ADMIN = ['ativo', 'banido'] as const;

function normalizarTags(tags: unknown): string[] | undefined {
  if (!Array.isArray(tags)) return undefined;
  const limpas = tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean);
  return Array.from(new Set(limpas));
}

// Telefone/documento sempre gravados só com dígitos — a máscara (parênteses,
// traço, ponto) é responsabilidade só da exibição no frontend.
function normalizarDigitos(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const digitos = String(value).replace(/\D/g, '');
  return digitos || null;
}

export function clientesRouter(supabase: SupabaseClient) {
  const router = Router();

  // O centro operacional usa contratos próprios e precisa ser montado antes
  // de /:id, para que "operacao" nunca seja interpretado como id de cliente.
  router.use('/operacao', clientesOperacaoRouter(supabase));

  // Por padrão só lista ativos — ?incluir_inativos=true traz todos, usado
  // pela tela de reativação.
  router.get('/', exigirPermissao('clientes.ver'), async (req, res) => {
    try {
      let query = supabase
        .from('clientes')
        .select(
          'id, nome, telefone, instagram_usuario, documento, data_nascimento, origem, preferencia_contato, ' +
          'tags, observacoes, ativo, banido, ml_nickname, cidade, estado, criado_em, atualizado_em'
        )
        .order('nome');
      if (req.query.incluir_inativos !== 'true') query = query.eq('ativo', true);
      const { data, error } = await query;
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Erro ao listar clientes:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Todas as peças procuradas de todos os clientes, com o modelo de moto —
  // usado pra montar badges de "moto procurada" e o filtro na listagem
  // principal, sem precisar abrir a ficha de cada cliente (que só traz isso
  // no GET /:id). Precisa vir ANTES de '/:id' pra não ser capturado por ele.
  router.get('/pecas-procuradas/todas', exigirPermissao('clientes.ver'), async (_req, res) => {
    try {
      const { data, error } = await supabase
        .from('pecas_procuradas')
        .select('id, cliente_id, status, modelo_moto_id, modelo_moto:modelos_moto(id, nome, ano)')
        .not('cliente_id', 'is', null);
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Erro ao listar peças procuradas:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Todas as motos vinculadas a clientes, com o modelo — usado pelo filtro
  // "moto que o cliente tem" na listagem (diferente de "moto procurada", ver
  // rota acima). Mesma ideia: evita abrir a ficha de cada cliente só pra
  // saber quais motos ele tem. Precisa vir ANTES de '/:id'.
  router.get('/motos/todas', exigirPermissao('clientes.ver'), async (_req, res) => {
    try {
      const { data, error } = await supabase
        .from('clientes_motos')
        .select('id, cliente_id, modelo_moto_id, modelo_moto:modelos_moto(id, nome, ano)')
        .not('modelo_moto_id', 'is', null);
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Erro ao listar motos de clientes:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.get('/:id', exigirPermissao('clientes.ver'), async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select(SELECT_COM_DETALHES)
        .eq('id', req.params.id)
        .order('criado_em', { foreignTable: 'clientes_notas', ascending: false })
        .maybeSingle();
      if (error) throw error;
      if (!data) return res.status(404).json({ success: false, error: 'Cliente não encontrado' });

      // Comprovantes de PIX de TODAS as vendas do cliente, agregados aqui —
      // busca separada (não dá pra encaixar no SELECT_COM_DETALHES de cima
      // porque comprovantes_pix não tem FK direta pra clientes_notas/motos,
      // e porque a URL assinada precisa ser gerada por request, não vem de
      // um select simples). Contexto de "qual venda" via join leve com vendas.
      const { data: comprovantes, error: erroComprovantes } = await supabase
        .from('comprovantes_pix')
        .select('*, venda:vendas(id, nome_item, data)')
        .eq('cliente_id', req.params.id)
        .is('removido_em', null)
        .order('criado_em', { ascending: false });
      if (erroComprovantes) throw erroComprovantes;

      const comprovantesComUrl = await Promise.all(
        (comprovantes ?? []).map(async (c: any) => ({ ...c, url: await gerarUrlAssinadaComprovante(c.storage_path) }))
      );

      res.json({ success: true, data: { ...(data as any), comprovantes_pix: comprovantesComUrl } });
    } catch (error: any) {
      console.error('Erro ao buscar cliente:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.post('/', exigirPermissao('clientes.criar'), async (req, res) => {
    try {
      const nome = String(req.body?.nome || '').trim();
      if (!nome) return res.status(400).json({ success: false, error: 'Nome é obrigatório' });

      const payload = {
        nome,
        telefone: normalizarDigitos(req.body?.telefone),
        instagram_usuario: req.body?.instagram_usuario ? String(req.body.instagram_usuario).trim().replace(/^@+/, '').toLowerCase() : null,
        documento: normalizarDigitos(req.body?.documento),
        data_nascimento: req.body?.data_nascimento || null,
        origem: req.body?.origem || null,
        preferencia_contato: req.body?.preferencia_contato || null,
        tags: normalizarTags(req.body?.tags) ?? [],
        observacoes: req.body?.observacoes ? String(req.body.observacoes).trim() : null,
        cidade: req.body?.cidade ? String(req.body.cidade).trim() : null,
        cep: normalizarDigitos(req.body?.cep),
        logradouro: req.body?.logradouro ? String(req.body.logradouro).trim() : null,
        numero: req.body?.numero ? String(req.body.numero).trim() : null,
        complemento: req.body?.complemento ? String(req.body.complemento).trim() : null,
        bairro: req.body?.bairro ? String(req.body.bairro).trim() : null,
        estado: (() => {
          const raw = req.body?.estado;
          if (raw == null || raw === '') return null;
          const s = String(raw).trim().toUpperCase();
          if (!/^[A-Z]{2}$/.test(s)) return null;                   // silenciosamente descarta formato inválido
          return s;
        })(),
      };

      const { data, error } = await supabase.from('clientes').insert(payload).select('*').single();
      if (error) {
        if (error.code === '23505') {
          return res.status(409).json({ success: false, error: 'Já existe um cliente cadastrado com este documento' });
        }
        throw error;
      }
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Erro ao criar cliente:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.patch('/:id', exigirAlguma('clientes.editar', 'clientes.administrar'), async (req: AuthenticatedRequest, res) => {
    try {
      const payload: Record<string, any> = {};
      const possuiCampoComum = CAMPOS_EDITAVEIS_COMUNS.some((campo) => req.body?.[campo] !== undefined);
      const possuiCampoAdministrativo = CAMPOS_EDITAVEIS_ADMIN.some((campo) => req.body?.[campo] !== undefined);

      if (possuiCampoComum && !temPermissao(req.usuario, 'clientes.editar')) {
        return res.status(403).json({ success: false, error: 'Acesso negado: edição cadastral não permitida' });
      }
      if (possuiCampoAdministrativo && !temPermissao(req.usuario, 'clientes.administrar')) {
        return res.status(403).json({ success: false, error: 'Acesso negado: esta ação é administrativa' });
      }
      for (const campo of CAMPOS_EDITAVEIS_ADMIN) {
        if (req.body?.[campo] !== undefined && typeof req.body[campo] !== 'boolean') {
          return res.status(400).json({ success: false, error: `${campo} deve ser verdadeiro ou falso` });
        }
      }

      // A origem é imutável nesta rota legada. A correção histórica passa
      // exclusivamente por /operacao/clientes/:id/origem, que exige motivo
      // e registra o evento de auditoria pela RPC.
      for (const campo of CAMPOS_EDITAVEIS_COMUNS) {
        if (req.body?.[campo] === undefined) continue;
        if (campo === 'nome') {
          const nome = String(req.body.nome).trim();
          if (!nome) return res.status(400).json({ success: false, error: 'Nome não pode ficar em branco' });
          payload.nome = nome;
        } else if (campo === 'tags') {
          payload.tags = normalizarTags(req.body.tags) ?? [];
        } else if (campo === 'telefone' || campo === 'documento' || campo === 'cep') {
          payload[campo] = normalizarDigitos(req.body[campo]);
        } else if (campo === 'instagram_usuario') {
          const instagram = String(req.body.instagram_usuario ?? '').trim().replace(/^@+/, '').toLowerCase();
          payload.instagram_usuario = instagram || null;
        } else if (campo === 'estado') {
          const s = String(req.body.estado ?? '').trim().toUpperCase();
          payload.estado = /^[A-Z]{2}$/.test(s) ? s : null;
        } else {
          payload[campo] = req.body[campo] === '' ? null : req.body[campo];
        }
      }
      for (const campo of CAMPOS_EDITAVEIS_ADMIN) {
        if (req.body?.[campo] !== undefined) payload[campo] = Boolean(req.body[campo]);
      }

      if (Object.keys(payload).length === 0) {
        return res.status(400).json({ success: false, error: 'Nenhum campo editável foi informado' });
      }

      const { data, error } = await supabase.from('clientes').update(payload).eq('id', req.params.id).select('*').maybeSingle();
      if (error) {
        if (error.code === '23505') {
          return res.status(409).json({ success: false, error: 'Já existe um cliente cadastrado com este documento' });
        }
        throw error;
      }
      if (!data) return res.status(404).json({ success: false, error: 'Cliente não encontrado' });
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Erro ao atualizar cliente:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.post('/:id/notas', exigirPermissao('clientes.editar'), async (req: AuthenticatedRequest, res) => {
    try {
      const texto = String(req.body?.texto || '').trim();
      if (!texto) return res.status(400).json({ success: false, error: 'Texto da nota é obrigatório' });

      const { data, error } = await supabase
        .from('clientes_notas')
        .insert({ cliente_id: req.params.id, texto, criado_por: req.usuario!.id })
        .select('*, autor:usuarios(id, nome_exibicao)')
        .single();
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Erro ao adicionar nota:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Só quem escreveu a nota ou um admin pode apagá-la — mesma regra de
  // carregarTarefaEditavel em tarefas.ts.
  router.delete('/:id/notas/:notaId', exigirPermissao('clientes.editar'), async (req: AuthenticatedRequest, res) => {
    try {
      const roles = req.usuario?.roles ?? [];
      const { data: nota, error: erroBusca } = await supabase.from('clientes_notas').select('id, criado_por').eq('id', req.params.notaId).maybeSingle();
      if (erroBusca) throw erroBusca;
      if (!nota) return res.status(404).json({ success: false, error: 'Nota não encontrada' });
      if (!roles.includes('admin') && nota.criado_por !== req.usuario!.id) {
        return res.status(403).json({ success: false, error: 'Só quem escreveu a nota pode excluí-la' });
      }

      const { error } = await supabase.from('clientes_notas').delete().eq('id', req.params.notaId);
      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      console.error('Erro ao excluir nota:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Motos do cliente (migration_032) — entidade distinta de modelos_moto
  // (catálogo usado por estoque/vendas): aqui é o veículo físico que o
  // cliente tem, com placa/chassi/ano/cor próprios.
  router.post('/:id/motos', exigirPermissao('clientes.editar'), async (req, res) => {
    try {
      const payload = {
        cliente_id: req.params.id,
        modelo_moto_id: req.body?.modelo_moto_id || null,
        modelo_texto: req.body?.modelo_texto ? String(req.body.modelo_texto).trim() : null,
        placa: req.body?.placa ? String(req.body.placa).trim() : null,
        chassi: req.body?.chassi ? String(req.body.chassi).trim() : null,
        ano: req.body?.ano ? String(req.body.ano).trim() : null,
        cor: req.body?.cor ? String(req.body.cor).trim() : null,
        observacoes: req.body?.observacoes ? String(req.body.observacoes).trim() : null,
      };
      const { data, error } = await supabase.from('clientes_motos').insert(payload).select('*, modelo_moto:modelos_moto(id, nome, ano)').single();
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Erro ao cadastrar moto do cliente:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.patch('/:id/motos/:motoId', exigirPermissao('clientes.editar'), async (req, res) => {
    try {
      const payload: Record<string, any> = {};
      for (const campo of ['modelo_moto_id', 'modelo_texto', 'placa', 'chassi', 'ano', 'cor', 'observacoes'] as const) {
        if (req.body?.[campo] !== undefined) payload[campo] = req.body[campo] === '' ? null : req.body[campo];
      }
      const { data, error } = await supabase
        .from('clientes_motos')
        .update(payload)
        .eq('id', req.params.motoId)
        .eq('cliente_id', req.params.id)
        .select('*, modelo_moto:modelos_moto(id, nome, ano)')
        .maybeSingle();
      if (error) throw error;
      if (!data) return res.status(404).json({ success: false, error: 'Moto não encontrada' });
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Erro ao atualizar moto do cliente:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.delete('/:id/motos/:motoId', exigirPermissao('clientes.editar'), async (req, res) => {
    try {
      const { error } = await supabase.from('clientes_motos').delete().eq('id', req.params.motoId).eq('cliente_id', req.params.id);
      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      console.error('Erro ao excluir moto do cliente:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Peças procuradas (migration_033) — pedido do cliente por algo que não
  // tinha em estoque. O match automático que fecha isso (vira tarefa quando
  // uma peça compatível é cadastrada) vive em src/server/routes/estoque.ts;
  // aqui é só o CRUD manual do pedido em si.
  router.post('/:id/pecas-procuradas', exigirPermissao('clientes.editar'), async (req: AuthenticatedRequest, res) => {
    try {
      const descricao = String(req.body?.descricao || '').trim();
      if (!descricao) return res.status(400).json({ success: false, error: 'Descrição é obrigatória' });

      const payload = {
        cliente_id: req.params.id,
        cliente_nome: req.body?.cliente_nome ? String(req.body.cliente_nome).trim() : null,
        descricao,
        categoria_id: req.body?.categoria_id || null,
        modelo_moto_id: req.body?.modelo_moto_id || null,
        cliente_moto_id: req.body?.cliente_moto_id || null,
        moto_modelo_texto: req.body?.moto_modelo_texto ? String(req.body.moto_modelo_texto).trim() : null,
        ano_compatibilidade: req.body?.ano_compatibilidade ? String(req.body.ano_compatibilidade).trim() : null,
        observacoes: req.body?.observacoes ? String(req.body.observacoes).trim() : null,
        criado_por: req.usuario!.id,
        responsavel_id: req.body?.responsavel_id || req.usuario!.id,
        prometido_para: req.body?.prometido_para || null,
        idempotency_key: req.body?.idempotency_key || null,
      };
      const { data, error } = await supabase
        .from('pecas_procuradas')
        .insert(payload)
        .select('*, categoria:categorias(id, nome), modelo_moto:modelos_moto(id, nome, ano)')
        .single();
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Erro ao cadastrar peça procurada:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Só o status é editável manualmente (ex: cancelar um pedido) — "atendida"
  // normalmente é setado automaticamente pelo match em estoque.ts.
  router.patch('/:id/pecas-procuradas/:pedidoId', exigirPermissao('clientes.editar'), async (req: AuthenticatedRequest, res) => {
    try {
      const status = req.body?.status;
      if (!['aguardando', 'atendida', 'cancelada'].includes(status)) {
        return res.status(400).json({ success: false, error: 'Status inválido' });
      }
      const novoStatus = status === 'aguardando' ? 'em_busca' : status;
      const { data, error } = await supabase.rpc('transicionar_pedido_busca', {
        p_pedido_id: req.params.pedidoId,
        p_novo_status: novoStatus,
        p_usuario_id: req.usuario!.id,
        p_motivo: status === 'cancelada' ? String(req.body?.motivo || 'Cancelado pelo fluxo anterior') : null,
        p_venda_id: null,
      });
      if (error) return res.status(400).json({ success: false, error: 'Não foi possível alterar o estado deste pedido' });
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Erro ao atualizar peça procurada:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.delete('/:id/pecas-procuradas/:pedidoId', exigirPermissao('clientes.editar'), async (req: AuthenticatedRequest, res) => {
    try {
      const { data, error } = await supabase.rpc('registrar_acao_pedido', {
        p_pedido_id: req.params.pedidoId,
        p_acao: 'cancelar',
        p_usuario_id: req.usuario!.id,
        p_detalhe: { motivo: 'Cancelado pelo fluxo anterior' },
      });
      if (error) return res.status(400).json({ success: false, error: 'Não foi possível cancelar este pedido' });
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Erro ao excluir peça procurada:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}
