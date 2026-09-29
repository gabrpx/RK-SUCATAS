// Testes de POST /api/tarefas com `participantes_ids` — Fase 1 (multi-
// participante) substitui o antigo sentinel atribuido_para: 'todos' (que
// criava N linhas independentes, uma por responsável) por UMA linha de
// `tarefas` com N linhas em `tarefa_participantes` (ver Approach no plano:
// "Tarefas: progresso multi-participante..."). "Selecionar todos" no
// frontend agora é só "marcar todos os checkboxes elegíveis" e manda a
// lista completa de ids — não existe mais sentinel nenhum no backend.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/pushNotificationService.js', () => ({
  notificarUsuario: vi.fn(() => Promise.resolve()),
}));

import { notificarUsuario } from '../../services/pushNotificationService.js';
import { tarefasRouter } from './tarefas';
import { criarSupabaseFake, usuarioExecutor, usuarioGerente, usuarioSemPermissao, criarReq, dispatch } from './tarefasFakeSupabase';

describe('POST /api/tarefas com participantes_ids (múltiplos participantes)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('cria UMA linha de tarefas com uma linha de tarefa_participantes por id válido', async () => {
    const fake = criarSupabaseFake([usuarioExecutor('u-bianca', 'Bianca'), usuarioGerente('u-carlos', 'Carlos')]);
    const router = tarefasRouter(fake as any);

    const res = await dispatch(
      router,
      criarReq({
        body: { titulo: 'Reunião geral', participantes_ids: ['u-bianca', 'u-carlos'], itens: [{ texto: 'Item A' }] },
      }),
    );

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(fake._tabelas.tarefas).toHaveLength(1); // uma linha só, não N
    expect(fake._tabelas.tarefa_participantes).toHaveLength(2);
    expect(fake._tabelas.tarefa_participantes.map((p: any) => p.usuario_id).sort()).toEqual(['u-bianca', 'u-carlos']);

    // O checklist é compartilhado (uma cópia só) — diferente do modelo antigo
    // de N linhas, onde cada uma tinha sua própria cópia dos itens.
    expect(fake._tabelas.tarefa_itens).toHaveLength(1);

    expect(res.body.data.participantes).toHaveLength(2);
    expect(res.body.data.participantes.every((p: any) => p.concluido === false)).toBe(true);
    expect(res.body.data.participantes.every((p: any) => p.lida === false)).toBe(true);
  });

  it('notifica todo participante que não seja quem criou', async () => {
    const fake = criarSupabaseFake([usuarioGerente('admin-1', 'Admin'), usuarioExecutor('u-bianca', 'Bianca')]);
    const router = tarefasRouter(fake as any);

    await dispatch(router, criarReq({ body: { titulo: 'Lembrete geral', participantes_ids: ['admin-1', 'u-bianca'] } }));

    expect(notificarUsuario).toHaveBeenCalledTimes(1); // não se autonotifica
    expect(vi.mocked(notificarUsuario).mock.calls[0][1]).toBe('u-bianca');
    expect(fake._tabelas.tarefa_participantes.find((p: any) => p.usuario_id === 'admin-1').lida).toBe(true);
  });

  it('um id inválido no meio da lista rejeita a criação inteira, sem criar nada', async () => {
    const fake = criarSupabaseFake([usuarioExecutor('u-bianca', 'Bianca'), usuarioSemPermissao('u-diego', 'Diego')]);
    const router = tarefasRouter(fake as any);

    const res = await dispatch(router, criarReq({ body: { titulo: 'Reunião geral', participantes_ids: ['u-bianca', 'u-diego'] } }));

    expect(res.statusCode).toBe(400);
    expect(fake._tabelas.tarefas).toHaveLength(0);
    expect(fake._tabelas.tarefa_participantes).toHaveLength(0);
    expect(notificarUsuario).not.toHaveBeenCalled();
  });

  it('ids duplicados na lista (ex: "Selecionar todos" clicado 2x) viram uma única linha de participante', async () => {
    const fake = criarSupabaseFake([usuarioExecutor('u-bianca', 'Bianca')]);
    const router = tarefasRouter(fake as any);

    const res = await dispatch(router, criarReq({ body: { titulo: 'Reunião geral', participantes_ids: ['u-bianca', 'u-bianca'] } }));

    expect(res.statusCode).toBe(200);
    expect(fake._tabelas.tarefa_participantes).toHaveLength(1);
  });

  it('atribuição normal gera recibo não lido para o responsável diferente do criador', async () => {
    const fake = criarSupabaseFake([usuarioExecutor('u-bianca', 'Bianca')]);
    const router = tarefasRouter(fake as any);

    const res = await dispatch(router, criarReq({ body: { titulo: 'Buscar peça', atribuido_para: 'u-bianca' } }));

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(fake._tabelas.tarefas).toHaveLength(1);
    expect(fake._tabelas.tarefas[0].atribuido_para).toBe('u-bianca');
    expect(fake._tabelas.tarefa_participantes).toEqual([
      expect.objectContaining({ tarefa_id: fake._tabelas.tarefas[0].id, usuario_id: 'u-bianca', lida: false }),
    ]);
    expect(res.body.data.participantes[0].lida).toBe(false);
  });

  it('atribuição normal inicia lida quando o criador é o próprio responsável', async () => {
    const gerente = usuarioGerente('u-carlos', 'Carlos');
    const fake = criarSupabaseFake([gerente]);
    const router = tarefasRouter(fake as any);

    const res = await dispatch(router, criarReq({ usuario: gerente, body: { titulo: 'Organizar bancada', atribuido_para: 'u-carlos' } }));

    expect(res.statusCode).toBe(200);
    expect(fake._tabelas.tarefa_participantes).toEqual([
      expect.objectContaining({ tarefa_id: fake._tabelas.tarefas[0].id, usuario_id: 'u-carlos', lida: true }),
    ]);
  });

  it('participantes_ids vazio cai no fluxo antigo (exige atribuido_para)', async () => {
    const fake = criarSupabaseFake([]);
    const router = tarefasRouter(fake as any);

    const res = await dispatch(router, criarReq({ body: { titulo: 'Reunião geral', participantes_ids: [] } }));

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('Responsável é obrigatório');
  });
});
