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

// O nested select de `itens` também embute quem concluiu cada item
// (tarefa_itens.concluido_por -> usuarios, FK criada na migration_046) — sem
// isso o frontend não tem como mostrar "Concluído por Fulano" no checklist.
// `participantes` (migration_060) vem vazio pra tarefa do modelo antigo
// (responsável único, sem nenhuma linha em tarefa_participantes).
// `imagens` (migration_061) idem — vazio quando não tem nenhuma anexada.
export const SELECT_COM_JOINS =
  '*, atribuido:usuarios!atribuido_para(id, nome_exibicao), criador:usuarios!criado_por(id, nome_exibicao), cliente:clientes(id, nome, telefone), itens:tarefa_itens(id, texto, concluido, ordem, concluido_em, concluido_por, concluido_por_usuario:usuarios!concluido_por(id, nome_exibicao)), participantes:tarefa_participantes(id, usuario_id, concluido, concluido_em, lida, usuario:usuarios!usuario_id(id, nome_exibicao)), imagens:tarefa_imagens(id, url, ordem)';

const CAMPOS_EDITAVEIS = ['titulo', 'descricao', 'prazo', 'atribuido_para', 'cliente_id', 'prioridade', 'tipo'] as const;

const ERRO_RESPONSAVEL_INVALIDO = 'Responsável precisa ser um usuário ativo com acesso às tarefas (ou você mesmo)';

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

// Ordena itens e imagens aninhados por `ordem` e garante array (nunca null) —
// o supabase devolve a relação sem ordem garantida.
function comItensOrdenados<T extends { itens?: any[] | null; imagens?: any[] | null }>(tarefa: T): T {
  const itens = (tarefa.itens ?? []).slice().sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  const imagens = (tarefa.imagens ?? []).slice().sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  return { ...tarefa, itens, imagens };
}

// Normaliza a lista de URLs de imagens vindas do body — string não-vazia,
// preservando a ordem de envio.
function normalizarImagens(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((u) => String(u ?? '').trim()).filter((u) => u.length > 0);
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

// Qualquer usuário ativo com acesso à tela de tarefas pode receber uma tarefa.
// Isso inclui executores, gestores e perfis operacionais que só têm
// tarefas.ver. O próprio usuário continua podendo se autoatribuir para
// preservar o fluxo de tarefas pessoais legado.
export function responsavelValido(responsavel: { roles: string[]; permissoes: any; ativo: boolean } | null, souEuMesmo: boolean): boolean {
  if (!responsavel || !responsavel.ativo) return false;
  if (souEuMesmo) return true;
  const admin = Array.isArray(responsavel.roles) && responsavel.roles.includes('admin');
  return pode(responsavel.permissoes, admin, 'tarefas.ver');
}

export function normalizarMotivoPausa(raw: unknown): string {
  return String(raw ?? '').trim();
}

export function podePausarTarefa(status: 'pendente' | 'concluida'): boolean {
  return status === 'pendente';
}

// Tarefa multi-participante (Fase 1, migration_060): o usuário conta como
// "dono" da tarefa se for o atribuido_para (modelo antigo, retrocompatível)
// OU se estiver na lista de participantes (modelo novo, checkboxes na
// criação). Usado em toda autorização que antes checava só atribuido_para —
// ver carregarTarefaEditavel (esse continua só criador/admin, é edição de
// verdade) e os handlers de concluir/reabrir/toggle abaixo.
export function souParticipante(tarefa: { atribuido_para: string; participantes?: { usuario_id: string }[] }, usuarioId: string): boolean {
  if (tarefa.atribuido_para === usuarioId) return true;
  return (tarefa.participantes ?? []).some((p) => p.usuario_id === usuarioId);
}

// Progresso "X/Y concluídos" pra barra visual na lista — null quando a
// tarefa não tem participantes (modelo antigo, sem barra pra mostrar).
export function progressoParticipantes(participantes: { concluido: boolean }[] | undefined): { feitos: number; total: number } | null {
  if (!participantes || participantes.length === 0) return null;
  return { feitos: participantes.filter((p) => p.concluido).length, total: participantes.length };
}

// "Aguardando aprovação": todo participante já marcou sua parte, mas a
// tarefa ainda não foi finalizada pelo criador. DERIVADO em runtime, nunca
// persistido em tarefas.status — que continua só 'pendente'/'concluida', a
// mesma constraint de sempre (ver migration_060_tarefa_participantes.sql).
export function aguardandoAprovacao(tarefa: { status: 'pendente' | 'concluida'; participantes?: { concluido: boolean }[] }): boolean {
  const participantes = tarefa.participantes ?? [];
  if (participantes.length === 0 || tarefa.status !== 'pendente') return false;
  return participantes.every((p) => p.concluido);
}

export function tarefasRouter(supabase: SupabaseClient) {
  const router = Router();

  // Rebusca os itens, deriva o status e aplica se mudou. Devolve a tarefa
  // completa (SELECT_COM_JOINS) já ordenada.
  //
  // Tarefa multi-participante (tem linhas em tarefa_participantes) NÃO usa
  // a auto-derivação por checklist — a conclusão dela é 100% guiada por
  // participante+finalização do criador (ver PATCH /:id/finalizar). Sem essa
  // exceção, marcar o último item do checklist compartilhado concluiria a
  // tarefa inteira por trás da aprovação em duas etapas.
  async function recalcularEDevolver(tarefaId: string) {
    const { count: totalParticipantes } = await supabase.from('tarefa_participantes').select('id', { count: 'exact', head: true }).eq('tarefa_id', tarefaId);
    if (!totalParticipantes) {
      const { data: itens } = await supabase.from('tarefa_itens').select('concluido').eq('tarefa_id', tarefaId);
      const { data: atual } = await supabase.from('tarefas').select('status').eq('id', tarefaId).single();
      const patch = derivarConclusao(itens ?? [], atual!.status as 'pendente' | 'concluida');
      if (patch) await supabase.from('tarefas').update(patch).eq('id', tarefaId);
    }
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

      // Quem NÃO gerencia tarefas (não tem tarefas.criar) só vê as próprias.
      // "própria" agora inclui ser PARTICIPANTE (modelo novo), não só o
      // atribuido_para — o filtro em si continua no banco só por
      // atribuido_para (não dá pra expressar "OU está em tarefa_participantes"
      // num .eq()); o resto é filtrado em JS logo abaixo com souParticipante,
      // usando o `participantes` que o SELECT_COM_JOINS já embute.
      const gerente = temPermissao(req.usuario, 'tarefas.criar');
      if (gerente) {
        if (req.query.status) query = query.eq('status', String(req.query.status));
        if (req.query.atribuido_para) query = query.eq('atribuido_para', String(req.query.atribuido_para));
        if (req.query.cliente_id) query = query.eq('cliente_id', String(req.query.cliente_id));
      }

      const { data, error } = await query;
      if (error) throw error;
      let resultado = data ?? [];
      if (!gerente) resultado = resultado.filter((t: any) => souParticipante(t, req.usuario!.id));
      res.json({ success: true, data: resultado.map(comItensOrdenados) });
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
      const imagens = normalizarImagens(req.body?.imagens);
      const atribuido_para = req.body?.atribuido_para;
      // Checkboxes de participantes (Fase 1) — array de ids, 1 ou mais.
      // Presente = modelo novo (uma linha em tarefas + N em
      // tarefa_participantes); ausente = modelo antigo (atribuido_para
      // único), retrocompatível e sem NENHUMA mudança de comportamento.
      const participantesIdsBrutos = req.body?.participantes_ids;
      const usaParticipantes = Array.isArray(participantesIdsBrutos) && participantesIdsBrutos.length > 0;

      if (!titulo && itens.length === 0) {
        return res.status(400).json({ success: false, error: 'Informe um título ou pelo menos um item' });
      }
      if (!usaParticipantes && !atribuido_para) return res.status(400).json({ success: false, error: 'Responsável é obrigatório' });

      const prioridade = req.body?.prioridade || 'media';
      if (!PRIORIDADES_VALIDAS.includes(prioridade)) {
        return res.status(400).json({ success: false, error: 'Prioridade inválida' });
      }
      const tipo = req.body?.tipo || 'geral';
      if (!TIPOS_VALIDOS.includes(tipo)) {
        return res.status(400).json({ success: false, error: 'Tipo de tarefa inválido' });
      }

      if (usaParticipantes) {
        // Um id por participante, sem duplicata (o "Selecionar todos" do
        // front pode mandar a mesma lista mais de uma vez em cliques rápidos).
        const idsUnicos = Array.from(new Set(participantesIdsBrutos.map((id: any) => String(id))));
        const { data: candidatos, error: erroCandidatos } = await supabase
          .from('usuarios').select('id, roles, permissoes, ativo').in('id', idsUnicos);
        if (erroCandidatos) throw erroCandidatos;
        const porId = new Map((candidatos ?? []).map((u: any) => [u.id, u]));
        for (const id of idsUnicos) {
          if (!responsavelValido(porId.get(id) ?? null, id === req.usuario!.id)) {
            return res.status(400).json({ success: false, error: ERRO_RESPONSAVEL_INVALIDO });
          }
        }

        // atribuido_para continua obrigatório na tabela (NOT NULL) — vira o
        // primeiro participante, só pra manter a coluna preenchida; quem
        // realmente manda em quem vê/marca a tarefa é tarefa_participantes
        // (ver souParticipante), não mais esse campo sozinho.
        const payload = {
          titulo: titulo || null,
          descricao: req.body?.descricao ? String(req.body.descricao).trim() : null,
          prazo: req.body?.prazo || null,
          atribuido_para: idsUnicos[0],
          criado_por: req.usuario!.id,
          cliente_id: req.body?.cliente_id || null,
          prioridade,
          tipo,
        };
        const { data: criada, error: erroCriada } = await supabase.from('tarefas').insert(payload).select('id').single();
        if (erroCriada) throw erroCriada;

        const linhasParticipantes = idsUnicos.map((usuario_id) => ({ tarefa_id: criada.id, usuario_id }));
        const { error: erroParticipantes } = await supabase.from('tarefa_participantes').insert(linhasParticipantes);
        if (erroParticipantes) throw erroParticipantes;

        if (itens.length > 0) {
          const linhasItens = itens.map((it, i) => ({ tarefa_id: criada.id, texto: it.texto, ordem: i }));
          const { error: erroItens } = await supabase.from('tarefa_itens').insert(linhasItens);
          if (erroItens) throw erroItens;
        }

        if (imagens.length > 0) {
          const linhasImagens = imagens.map((url, i) => ({ tarefa_id: criada.id, url, ordem: i }));
          const { error: erroImagens } = await supabase.from('tarefa_imagens').insert(linhasImagens);
          if (erroImagens) throw erroImagens;
        }

        const corpo = titulo || itens[0]?.texto || 'Nova tarefa';
        for (const id of idsUnicos) {
          if (id === req.usuario!.id) continue; // não notifica quem se autoatribuiu
          notificarUsuario(supabase, id, { titulo: 'Nova tarefa', corpo, url: '/tarefas' }).catch((e) =>
            console.error('Erro ao notificar nova tarefa:', e)
          );
        }

        const { data: completa, error: erroCompleta } = await supabase.from('tarefas').select(SELECT_COM_JOINS).eq('id', criada.id).single();
        if (erroCompleta) throw erroCompleta;
        return res.json({ success: true, data: comItensOrdenados(completa) });
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
      if (imagens.length > 0) {
        const linhasImagens = imagens.map((url, i) => ({ tarefa_id: data.id, url, ordem: i }));
        const { error: erroImagens } = await supabase.from('tarefa_imagens').insert(linhasImagens);
        if (erroImagens) throw erroImagens;
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

      // `imagens` substitui a lista inteira (diferente do diff por id dos
      // itens) — imagem não tem estado próprio pra preservar entre uma
      // edição e outra, só presença+ordem.
      if (req.body?.imagens !== undefined) {
        const desejadas = normalizarImagens(req.body.imagens);
        await supabase.from('tarefa_imagens').delete().eq('tarefa_id', req.params.id);
        if (desejadas.length > 0) {
          const linhas = desejadas.map((url, i) => ({ tarefa_id: req.params.id, url, ordem: i }));
          const { error: erroImagens } = await supabase.from('tarefa_imagens').insert(linhas);
          if (erroImagens) throw erroImagens;
        }
      }

      const data = await recalcularEDevolver(req.params.id);
      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Erro ao atualizar tarefa:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.patch('/:id/pausar', async (req: AuthenticatedRequest, res) => {
    try {
      const tarefaEditavel = await carregarTarefaEditavel(req, res, 'tarefas.editar');
      if (!tarefaEditavel) return;

      const motivo = normalizarMotivoPausa(req.body?.motivo);
      if (!motivo) return res.status(400).json({ success: false, error: 'Informe o motivo da pausa' });

      const { data: atual, error: erroAtual } = await supabase
        .from('tarefas')
        .select('status')
        .eq('id', req.params.id)
        .single();
      if (erroAtual) throw erroAtual;
      if (!podePausarTarefa(atual.status as 'pendente' | 'concluida')) {
        return res.status(400).json({ success: false, error: 'Tarefa concluída não pode ser pausada' });
      }

      const { data, error } = await supabase
        .from('tarefas')
        .update({ pausada: true, pausada_em: new Date().toISOString(), pausada_por: req.usuario!.id, pausa_motivo: motivo })
        .eq('id', req.params.id)
        .select(SELECT_COM_JOINS)
        .single();
      if (error) throw error;
      res.json({ success: true, data: comItensOrdenados(data) });
    } catch (error: any) {
      console.error('Erro ao pausar tarefa:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.patch('/:id/despausar', async (req: AuthenticatedRequest, res) => {
    try {
      const tarefaEditavel = await carregarTarefaEditavel(req, res, 'tarefas.editar');
      if (!tarefaEditavel) return;

      const { data, error } = await supabase
        .from('tarefas')
        .update({ pausada: false, pausada_em: null, pausada_por: null, pausa_motivo: null })
        .eq('id', req.params.id)
        .select(SELECT_COM_JOINS)
        .single();
      if (error) throw error;
      res.json({ success: true, data: comItensOrdenados(data) });
    } catch (error: any) {
      console.error('Erro ao retomar tarefa:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.patch('/:id/concluir', async (req: AuthenticatedRequest, res) => {
    try {
      const { data: tarefa, error: erroBusca } = await supabase
        .from('tarefas').select('id, atribuido_para, participantes:tarefa_participantes(usuario_id)').eq('id', req.params.id).maybeSingle();
      if (erroBusca) throw erroBusca;
      if (!tarefa) return res.status(404).json({ success: false, error: 'Tarefa não encontrada' });

      const podeConcluir = temPermissao(req.usuario, 'tarefas.concluir') && (temPermissao(req.usuario, 'tarefas.criar') || souParticipante(tarefa, req.usuario!.id));
      if (!podeConcluir) {
        return res.status(403).json({ success: false, error: 'Só o responsável pela tarefa pode dar baixa' });
      }

      if ((tarefa.participantes ?? []).length > 0) {
        return res.status(400).json({ success: false, error: 'Esta tarefa tem participantes — cada um marca sua parte e quem criou finaliza (PATCH /finalizar).' });
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
      const { data: tarefa, error: erroBusca } = await supabase
        .from('tarefas').select('id, atribuido_para, participantes:tarefa_participantes(usuario_id)').eq('id', req.params.id).maybeSingle();
      if (erroBusca) throw erroBusca;
      if (!tarefa) return res.status(404).json({ success: false, error: 'Tarefa não encontrada' });

      const podeReabrir = temPermissao(req.usuario, 'tarefas.concluir') && (temPermissao(req.usuario, 'tarefas.criar') || souParticipante(tarefa, req.usuario!.id));
      if (!podeReabrir) {
        return res.status(403).json({ success: false, error: 'Só o responsável pela tarefa pode reabri-la' });
      }

      if ((tarefa.participantes ?? []).length > 0) {
        return res.status(400).json({ success: false, error: 'Esta tarefa tem participantes — reabra revertendo a finalização, não por aqui.' });
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
      const { data: tarefa, error: erroBusca } = await supabase
        .from('tarefas').select('id, atribuido_para, participantes:tarefa_participantes(usuario_id)').eq('id', req.params.id).maybeSingle();
      if (erroBusca) throw erroBusca;
      if (!tarefa) return res.status(404).json({ success: false, error: 'Tarefa não encontrada' });

      const podeMarcar = temPermissao(req.usuario, 'tarefas.concluir') && (temPermissao(req.usuario, 'tarefas.criar') || souParticipante(tarefa, req.usuario!.id));
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

  // Cada participante marca (ou desmarca) SÓ a própria linha — nunca a de
  // outro participante, mesmo sendo gerente/admin (a barra de progresso é
  // "cada um dá baixa na própria parte", diferente de concluir/reabrir, que
  // é a tarefa inteira de uma vez). Quando essa marcação faz TODOS os
  // participantes ficarem concluídos, notifica quem criou (aguardandoAprovacao).
  router.patch('/:id/participantes/toggle', async (req: AuthenticatedRequest, res) => {
    try {
      if (!temPermissao(req.usuario, 'tarefas.concluir')) {
        return res.status(403).json({ success: false, error: 'Acesso negado para este perfil' });
      }
      const { data: tarefa, error: erroBusca } = await supabase.from('tarefas').select('id, titulo, criado_por').eq('id', req.params.id).maybeSingle();
      if (erroBusca) throw erroBusca;
      if (!tarefa) return res.status(404).json({ success: false, error: 'Tarefa não encontrada' });

      const { data: participante, error: erroParticipante } = await supabase
        .from('tarefa_participantes').select('id, concluido').eq('tarefa_id', req.params.id).eq('usuario_id', req.usuario!.id).maybeSingle();
      if (erroParticipante) throw erroParticipante;
      if (!participante) return res.status(403).json({ success: false, error: 'Você não é participante desta tarefa' });

      const novo = !participante.concluido;
      const { error: erroUp } = await supabase
        .from('tarefa_participantes')
        .update({ concluido: novo, concluido_em: novo ? new Date().toISOString() : null })
        .eq('id', participante.id);
      if (erroUp) throw erroUp;

      const data = await recalcularEDevolver(req.params.id);

      if (aguardandoAprovacao(data) && tarefa.criado_por !== req.usuario!.id) {
        notificarUsuario(supabase, tarefa.criado_por, {
          titulo: 'Tarefa pronta pra aprovação',
          corpo: `Todos os participantes concluíram "${tarefa.titulo || 'a tarefa'}" — falta você finalizar.`,
          url: '/tarefas',
        }).catch((e) => console.error('Erro ao notificar aprovação pendente:', e));
      }

      res.json({ success: true, data });
    } catch (error: any) {
      console.error('Erro ao alternar participação na tarefa:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Marca que o usuário logado já abriu os detalhes desta tarefa pelo menos
  // uma vez — some com a borda animada de "não lida" (Fase 2). Só existe pra
  // quem é participante (modelo novo); tarefa antiga não tem onde guardar
  // isso e simplesmente nunca ganha a borda.
  router.patch('/:id/marcar-lida', async (req: AuthenticatedRequest, res) => {
    try {
      const { error } = await supabase
        .from('tarefa_participantes')
        .update({ lida: true })
        .eq('tarefa_id', req.params.id)
        .eq('usuario_id', req.usuario!.id)
        .eq('lida', false);
      if (error) throw error;
      res.json({ success: true, data: null });
    } catch (error: any) {
      console.error('Erro ao marcar tarefa como lida:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Segunda etapa da conclusão em duas etapas: só quem criou a tarefa (ou
  // admin) finaliza, e só depois que TODO participante já marcou a própria
  // parte — mesmo "aguardandoAprovacao" que dispara a notificação acima.
  router.patch('/:id/finalizar', async (req: AuthenticatedRequest, res) => {
    try {
      const tarefa = await carregarTarefaEditavel(req, res, 'tarefas.criar');
      if (!tarefa) return;

      const { data: completa, error: erroCompleta } = await supabase.from('tarefas').select(SELECT_COM_JOINS).eq('id', req.params.id).single();
      if (erroCompleta) throw erroCompleta;
      const atual = comItensOrdenados(completa);

      if (!aguardandoAprovacao(atual)) {
        return res.status(400).json({ success: false, error: 'Esta tarefa ainda não está pronta pra finalizar — falta algum participante concluir a própria parte.' });
      }

      const { data, error } = await supabase
        .from('tarefas')
        .update({ status: 'concluida', concluida_em: new Date().toISOString() })
        .eq('id', req.params.id)
        .select(SELECT_COM_JOINS)
        .single();
      if (error) throw error;
      res.json({ success: true, data: comItensOrdenados(data) });
    } catch (error: any) {
      console.error('Erro ao finalizar tarefa:', error);
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
