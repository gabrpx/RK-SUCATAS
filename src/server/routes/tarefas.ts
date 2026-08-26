// Tarefas: admin/equipe criam e atribuem, só quem tem um cargo "executor"
// (EXECUTORES_TAREFA — mandados/mecanico) dá baixa na própria, atribuída a
// ele. Montada em server.ts SEM autorizar() no mount porque o comportamento
// varia por papel dentro de cada rota, não é um simples permitido/negado por
// rota inteira.
import { Router } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuthenticatedRequest } from '../../../middleware/auth.js';
import { temPermissao, ehAdmin } from '../../../middleware/auth.js';
import { pode } from '../../constants/permissoes.js';
import { notificarUsuario } from '../../services/pushNotificationService.js';

const SELECT_COM_JOINS =
  '*, atribuido:usuarios!atribuido_para(id, nome_exibicao), criador:usuarios!criado_por(id, nome_exibicao), cliente:clientes(id, nome, telefone), itens:tarefa_itens(id, texto, concluido, ordem, concluido_em, concluido_por)';

const CAMPOS_EDITAVEIS = ['titulo', 'descricao', 'prazo', 'atribuido_para', 'cliente_id', 'prioridade', 'tipo'] as const;

const ERRO_RESPONSAVEL_INVALIDO = 'Responsável precisa ser um usuário ativo que execute tarefas (ou você mesmo)';

const PRIORIDADES_VALIDAS = ['baixa', 'media', 'alta'] as const;
const TIPOS_VALIDOS = ['geral', 'visita'] as const;

// Filtra itens de checklist válidos preservando a ordem do array. Exportado
// pra teste. Aceita { texto } e opcionalmente { id } (usado no diff do PATCH).
export function normalizarItens(raw: unknown): { texto: string; id?: string }[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((i) => ({ id: i?.id as string | undefined, texto: String(i?.texto ?? '').trim() }))
    .filter((i) => i.texto.length > 0)
    .map((i) => (i.id ? { id: i.id, texto: i.texto } : { texto: i.texto }));
}

// Ordena os itens aninhados por `ordem` e garante array (nunca null) — o
// supabase devolve a relação sem ordem garantida.
function comItensOrdenados<T extends { itens?: any[] | null }>(tarefa: T): T {
  const itens = (tarefa.itens ?? []).slice().sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  return { ...tarefa, itens };
}

// Deriva o status da tarefa a partir dos itens. Retorna o patch a aplicar,
// ou null quando não há itens ou o status já está correto (idempotente).
export function derivarConclusao(
  itens: { concluido: boolean }[],
  statusAtual: 'pendente' | 'concluida',
  agoraIso = new Date().toISOString(),
): { status: 'pendente' | 'concluida'; concluida_em: string | null } | null {
  if (itens.length === 0) return null;
  const todos = itens.every((i) => i.concluido);
  if (todos && statusAtual !== 'concluida') return { status: 'concluida', concluida_em: agoraIso };
  if (!todos && statusAtual === 'concluida') return { status: 'pendente', concluida_em: null };
  return null;
}

// Quem gerencia tarefas (cria/atribui/vê todas) tem a permissão tarefas.criar —
// o equivalente dos antigos admin/equipe. Um "executor de campo" (antigos
// mandados/mecanico) pode dar baixa (tarefas.concluir) mas NÃO gerenciar, e por
// isso só enxerga/conclui as próprias.
function ehExecutorDeCampo(usuario: { roles: string[]; permissoes: any }): boolean {
  const admin = Array.isArray(usuario.roles) && usuario.roles.includes('admin');
  return pode(usuario.permissoes, admin, 'tarefas.concluir') && !pode(usuario.permissoes, admin, 'tarefas.criar');
}

// Quem gerencia tarefas pode se autoatribuir uma (ex: lembrete pessoal) mesmo
// sem ser executor — só quem NÃO é o próprio usuário logado precisa ser um
// executor de campo.
export function responsavelValido(responsavel: { roles: string[]; permissoes: any; ativo: boolean } | null, souEuMesmo: boolean): boolean {
  if (!responsavel || !responsavel.ativo) return false;
  if (souEuMesmo) return true;
  const admin = Array.isArray(responsavel.roles) && responsavel.roles.includes('admin');
  const ehGerente = pode(responsavel.permissoes, admin, 'tarefas.criar');
  return ehExecutorDeCampo(responsavel) || ehGerente;
}

export function tarefasRouter(supabase: SupabaseClient) {
  const router = Router();

  // Rebusca os itens, deriva o status e aplica se mudou. Devolve a tarefa
  // completa (SELECT_COM_JOINS) já ordenada.
  async function recalcularEDevolver(tarefaId: string) {
    const { data: itens } = await supabase.from('tarefa_itens').select('concluido').eq('tarefa_id', tarefaId);
    const { data: atual } = await supabase.from('tarefas').select('status').eq('id', tarefaId).single();
    const patch = derivarConclusao(itens ?? [], atual!.status as 'pendente' | 'concluida');
    if (patch) await supabase.from('tarefas').update(patch).eq('id', tarefaId);
    const { data, error } = await supabase.from('tarefas').select(SELECT_COM_JOINS).eq('id', tarefaId).single();
    if (error || !data) throw error ?? new Error('Tarefa não encontrada ao recarregar após atualização');
    return comItensOrdenados(data);
  }

  router.get('/', async (req: AuthenticatedRequest, res) => {
    try {
      if (!temPermissao(req.usuario, 'tarefas.ver')) {
        return res.status(403).json({ success: false, error: 'Acesso negado para este perfil' });
      }

      let query = supabase.from('tarefas').select(SELECT_COM_JOINS).order('status', { ascending: true }).order('prazo', { ascending: true, nullsFirst: false });

      // Quem NÃO gerencia tarefas (não tem tarefas.criar) só vê as próprias —
      // o executor de campo enxerga só o que foi atribuído a ele.
      const gerente = temPermissao(req.usuario, 'tarefas.criar');
      if (!gerente) {
        query = query.eq('atribuido_para', req.usuario!.id);
      } else {
        if (req.query.status) query = query.eq('status', String(req.query.status));
        if (req.query.atribuido_para) query = query.eq('atribuido_para', String(req.query.atribuido_para));
        if (req.query.cliente_id) query = query.eq('cliente_id', String(req.query.cliente_id));
      }

      const { data, error } = await query;
      if (error) throw error;
      res.json({ success: true, data: (data ?? []).map(comItensOrdenados) });
    } catch (error: any) {
      console.error('Erro ao listar tarefas:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.post('/', async (req: AuthenticatedRequest, res) => {
    try {
      if (!temPermissao(req.usuario, 'tarefas.criar')) {
        return res.status(403).json({ success: false, error: 'Acesso negado para este perfil' });
      }

      const titulo = String(req.body?.titulo || '').trim();
      const itens = normalizarItens(req.body?.itens);
      const atribuido_para = req.body?.atribuido_para;
      if (!titulo && itens.length === 0) {
        return res.status(400).json({ success: false, error: 'Informe um título ou pelo menos um item' });
      }
      if (!atribuido_para) return res.status(400).json({ success: false, error: 'Responsável é obrigatório' });

      const prioridade = req.body?.prioridade || 'media';
      if (!PRIORIDADES_VALIDAS.includes(prioridade)) {
        return res.status(400).json({ success: false, error: 'Prioridade inválida' });
      }
      const tipo = req.body?.tipo || 'geral';
      if (!TIPOS_VALIDOS.includes(tipo)) {
        return res.status(400).json({ success: false, error: 'Tipo de tarefa inválido' });
      }

      const { data: responsavel, error: erroResponsavel } = await supabase.from('usuarios').select('id, roles, permissoes, ativo').eq('id', atribuido_para).maybeSingle();
      if (erroResponsavel) throw erroResponsavel;
      if (!responsavelValido(responsavel, atribuido_para === req.usuario!.id)) {
        return res.status(400).json({ success: false, error: ERRO_RESPONSAVEL_INVALIDO });
      }

      const payload = {
        titulo: titulo || null,
        descricao: req.body?.descricao ? String(req.body.descricao).trim() : null,
        prazo: req.body?.prazo || null,
        atribuido_para,
        criado_por: req.usuario!.id,
        cliente_id: req.body?.cliente_id || null,
        prioridade,
        tipo,
      };

      const { data, error } = await supabase.from('tarefas').insert(payload).select(SELECT_COM_JOINS).single();
      if (error) throw error;

      if (itens.length > 0) {
        const linhas = itens.map((it, i) => ({ tarefa_id: data.id, texto: it.texto, ordem: i }));
        const { error: erroItens } = await supabase.from('tarefa_itens').insert(linhas);
        if (erroItens) throw erroItens;
      }
      // Rebuscar com os itens já persistidos para devolver o objeto completo.
      const { data: completa, error: erroCompleta } = await supabase.from('tarefas').select(SELECT_COM_JOINS).eq('id', data.id).single();
      if (erroCompleta) throw erroCompleta;

      // Fire-and-forget: uma falha no push nunca pode derrubar a criação da
      // tarefa (mesmo espírito de casarComPecasProcuradas em estoque.ts).
      // Não notifica quem se autoatribuiu — a pessoa já sabe, acabou de criar.
      if (atribuido_para !== req.usuario!.id) {
        const corpo = titulo || itens[0]?.texto || 'Nova tarefa';
        notificarUsuario(supabase, atribuido_para, { titulo: 'Nova tarefa', corpo, url: '/tarefas' }).catch((e) =>
          console.error('Erro ao notificar nova tarefa:', e)
        );
      }

      res.json({ success: true, data: comItensOrdenados(completa ?? data) });
    } catch (error: any) {
      console.error('Erro ao criar tarefa:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Confirma que o usuário logado pode mexer nesta tarefa (dono = criador, ou
  // admin mexe em qualquer uma). Retorna a tarefa atual ou já responde o erro.
  async function carregarTarefaEditavel(req: AuthenticatedRequest, res: any, chave: string) {
    if (!temPermissao(req.usuario, chave)) {
      res.status(403).json({ success: false, error: 'Acesso negado para este perfil' });
      return null;
    }
    const { data: tarefa, error } = await supabase.from('tarefas').select('id, criado_por').eq('id', req.params.id).maybeSingle();
    if (error) {
      res.status(500).json({ success: false, error: error.message });
      return null;
    }
    if (!tarefa) {
      res.status(404).json({ success: false, error: 'Tarefa não encontrada' });
      return null;
    }
    // Admin mexe em qualquer tarefa; quem não é admin só mexe nas que criou.
    if (!ehAdmin(req.usuario) && tarefa.criado_por !== req.usuario!.id) {
      res.status(403).json({ success: false, error: 'Só quem criou a tarefa pode alterá-la' });
      return null;
    }
    return tarefa;
  }

  router.patch('/:id', async (req: AuthenticatedRequest, res) => {
    try {
      const tarefa = await carregarTarefaEditavel(req, res, 'tarefas.editar');
      if (!tarefa) return;

      const payload: Record<string, any> = {};
      for (const campo of CAMPOS_EDITAVEIS) {
        if (req.body?.[campo] !== undefined) payload[campo] = req.body[campo];
      }
      // Título vazio vira null (não persistimos string vazia).
      if (payload.titulo === '') payload.titulo = null;

      if (payload.atribuido_para !== undefined) {
        const { data: responsavel } = await supabase.from('usuarios').select('id, roles, permissoes, ativo').eq('id', payload.atribuido_para).maybeSingle();
        if (!responsavelValido(responsavel, payload.atribuido_para === req.usuario!.id)) {
          return res.status(400).json({ success: false, error: ERRO_RESPONSAVEL_INVALIDO });
        }
      }

      // Valida o invariante "título OU ≥1 item" ANTES de qualquer mutação,
      // sempre que o título estiver sendo limpo OU os itens estiverem sendo
      // alterados — considerando o estado final efetivo (o que vem no body
      // quando presente, senão o que já está armazenado). Sem isso, um PATCH
      // { titulo: '' } sem `itens` numa tarefa sem itens zerava o título sem
      // validar nada, deixando a tarefa sem título e sem itens.
      const itensSendoAlterados = req.body?.itens !== undefined;
      const tituloSendoLimpo = req.body?.titulo !== undefined && !payload.titulo;
      let desejados: { texto: string; id?: string }[] | undefined;
      if (itensSendoAlterados) desejados = normalizarItens(req.body.itens);

      if (tituloSendoLimpo || itensSendoAlterados) {
        let tituloFinal: string;
        if (req.body?.titulo !== undefined) {
          tituloFinal = String(req.body.titulo || '').trim();
        } else {
          const { data: tAtual } = await supabase.from('tarefas').select('titulo').eq('id', req.params.id).single();
          tituloFinal = (tAtual?.titulo ?? '').trim();
        }

        let totalItensFinal: number;
        if (desejados !== undefined) {
          totalItensFinal = desejados.length;
        } else {
          const { count } = await supabase.from('tarefa_itens').select('id', { count: 'exact', head: true }).eq('tarefa_id', req.params.id);
          totalItensFinal = count ?? 0;
        }

        if (totalItensFinal === 0 && !tituloFinal) {
          return res.status(400).json({ success: false, error: 'Informe um título ou pelo menos um item' });
        }
      }

      // Numa edição só de itens (sem campo escalar no body), payload fica {}
      // e .update({}) pode falhar/no-op no supabase-js — só chamamos update
      // quando há de fato algo escalar a alterar.
      if (Object.keys(payload).length > 0) {
        const { error } = await supabase.from('tarefas').update(payload).eq('id', req.params.id);
        if (error) throw error;
      }

      if (desejados !== undefined) {
        const { data: atuais } = await supabase.from('tarefa_itens').select('id').eq('tarefa_id', req.params.id);
        const idsAtuais = new Set((atuais ?? []).map((i) => i.id));
        const idsDesejados = new Set(desejados.filter((i) => i.id).map((i) => i.id!));

        // remover os que sumiram
        const remover = [...idsAtuais].filter((id) => !idsDesejados.has(id));
        if (remover.length) await supabase.from('tarefa_itens').delete().in('id', remover);

        // upsert por posição (ordem = índice)
        for (let i = 0; i < desejados.length; i++) {
          const it = desejados[i];
          if (it.id && idsAtuais.has(it.id)) {
            await supabase.from('tarefa_itens').update({ texto: it.texto, ordem: i }).eq('id', it.id);
          } else {
            await supabase.from('tarefa_itens').insert({ tarefa_id: req.params.id, texto: it.texto, ordem: i });
          }
        }
      }

      const data = await recalcularEDevolver(req.params.id);
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Erro ao atualizar tarefa:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.patch('/:id/concluir', async (req: AuthenticatedRequest, res) => {
    try {
      const { data: tarefa, error: erroBusca } = await supabase.from('tarefas').select('id, atribuido_para').eq('id', req.params.id).maybeSingle();
      if (erroBusca) throw erroBusca;
      if (!tarefa) return res.status(404).json({ success: false, error: 'Tarefa não encontrada' });

      const podeConcluir = temPermissao(req.usuario, 'tarefas.concluir') && (temPermissao(req.usuario, 'tarefas.criar') || tarefa.atribuido_para === req.usuario!.id);
      if (!podeConcluir) {
        return res.status(403).json({ success: false, error: 'Só o responsável pela tarefa pode dar baixa' });
      }

      const { count } = await supabase.from('tarefa_itens').select('id', { count: 'exact', head: true }).eq('tarefa_id', req.params.id);
      if ((count ?? 0) > 0) {
        return res.status(400).json({ success: false, error: 'Esta tarefa é controlada pelos itens do checklist — marque/desmarque os itens.' });
      }

      const { data, error } = await supabase
        .from('tarefas')
        .update({ status: 'concluida', concluida_em: new Date().toISOString() })
        .eq('id', req.params.id)
        .select(SELECT_COM_JOINS)
        .single();
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Erro ao concluir tarefa:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Reverte uma conclusão feita sem querer — mesma regra de quem pode
  // concluir (admin/equipe de qualquer tarefa, ou o próprio executor
  // atribuído), já que reabrir é só o inverso da mesma ação.
  router.patch('/:id/reabrir', async (req: AuthenticatedRequest, res) => {
    try {
      const { data: tarefa, error: erroBusca } = await supabase.from('tarefas').select('id, atribuido_para').eq('id', req.params.id).maybeSingle();
      if (erroBusca) throw erroBusca;
      if (!tarefa) return res.status(404).json({ success: false, error: 'Tarefa não encontrada' });

      const podeReabrir = temPermissao(req.usuario, 'tarefas.concluir') && (temPermissao(req.usuario, 'tarefas.criar') || tarefa.atribuido_para === req.usuario!.id);
      if (!podeReabrir) {
        return res.status(403).json({ success: false, error: 'Só o responsável pela tarefa pode reabri-la' });
      }

      const { count } = await supabase.from('tarefa_itens').select('id', { count: 'exact', head: true }).eq('tarefa_id', req.params.id);
      if ((count ?? 0) > 0) {
        return res.status(400).json({ success: false, error: 'Esta tarefa é controlada pelos itens do checklist — marque/desmarque os itens.' });
      }

      const { data, error } = await supabase
        .from('tarefas')
        .update({ status: 'pendente', concluida_em: null })
        .eq('id', req.params.id)
        .select(SELECT_COM_JOINS)
        .single();
      if (error) throw error;
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Erro ao reabrir tarefa:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.patch('/:id/itens/:itemId/toggle', async (req: AuthenticatedRequest, res) => {
    try {
      const { data: tarefa, error: erroBusca } = await supabase.from('tarefas').select('id, atribuido_para').eq('id', req.params.id).maybeSingle();
      if (erroBusca) throw erroBusca;
      if (!tarefa) return res.status(404).json({ success: false, error: 'Tarefa não encontrada' });

      const podeMarcar = temPermissao(req.usuario, 'tarefas.concluir') && (temPermissao(req.usuario, 'tarefas.criar') || tarefa.atribuido_para === req.usuario!.id);
      if (!podeMarcar) return res.status(403).json({ success: false, error: 'Só o responsável pela tarefa pode marcar os itens' });

      const { data: item, error: erroItem } = await supabase
        .from('tarefa_itens').select('id, concluido').eq('id', req.params.itemId).eq('tarefa_id', req.params.id).maybeSingle();
      if (erroItem) throw erroItem;
      if (!item) return res.status(404).json({ success: false, error: 'Item não encontrado' });

      const novo = !item.concluido;
      const { error: erroUp } = await supabase.from('tarefa_itens').update({
        concluido: novo,
        concluido_em: novo ? new Date().toISOString() : null,
        concluido_por: novo ? req.usuario!.id : null,
      }).eq('id', item.id);
      if (erroUp) throw erroUp;

      const data = await recalcularEDevolver(req.params.id);
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Erro ao alternar item da tarefa:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.delete('/:id', async (req: AuthenticatedRequest, res) => {
    try {
      const tarefa = await carregarTarefaEditavel(req, res, 'tarefas.excluir');
      if (!tarefa) return;

      const { error } = await supabase.from('tarefas').delete().eq('id', req.params.id);
      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      console.error('Erro ao excluir tarefa:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}
