// Testes de rota do fluxo de participantes (Fase 1): cada um marca a própria
// parte (PATCH .../participantes/toggle), o criador finaliza depois que
// todos concluíram (PATCH .../finalizar), e marcar-lida (Fase 2) some com a
// borda animada. Mesmo padrão de dispatch direto no Router() dos outros
// testes de tarefas.ts — ver tarefasFakeSupabase.ts.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/pushNotificationService.js', () => ({
  notificarUsuario: vi.fn(() => Promise.resolve()),
}));

import { notificarUsuario } from '../../services/pushNotificationService.js';
import { tarefasRouter } from './tarefas';
import { criarSupabaseFake, usuarioExecutor, usuarioGerente, criarReq, dispatch } from './tarefasFakeSupabase';

async function criarTarefaComParticipantes(fake: ReturnType<typeof criarSupabaseFake>, router: any, participantes_ids: string[], criador = 'admin-1') {
  const res = await dispatch(router, criarReq({ usuario: { id: criador, roles: ['admin'], permissoes: {} }, body: { titulo: 'Tarefa em grupo', participantes_ids } }));
  return res.body.data.id as string;
}

describe('PATCH /:id/participantes/toggle', () => {
  beforeEach(() => vi.clearAllMocks());

  it('marca só a própria linha do participante, sem afetar as dos outros', async () => {
    const fake = criarSupabaseFake([usuarioGerente('admin-1', 'Admin'), usuarioExecutor('u-bianca', 'Bianca'), usuarioExecutor('u-carlos', 'Carlos')]);
    const router = tarefasRouter(fake as any);
    const id = await criarTarefaComParticipantes(fake, router, ['u-bianca', 'u-carlos']);

    const resToggle = await dispatch(router, criarReq({ method: 'PATCH', url: `/${id}/participantes/toggle`, usuario: usuarioExecutor('u-bianca', 'Bianca'), params: { id } }));

    expect(resToggle.statusCode).toBe(200);
    const participantes = resToggle.body.data.participantes;
    const bianca = participantes.find((p: any) => p.usuario_id === 'u-bianca');
    const carlos = participantes.find((p: any) => p.usuario_id === 'u-carlos');
    expect(bianca.concluido).toBe(true);
    expect(carlos.concluido).toBe(false);
  });

  it('quem não é participante da tarefa recebe 403', async () => {
    const fake = criarSupabaseFake([usuarioGerente('admin-1', 'Admin'), usuarioExecutor('u-bianca', 'Bianca'), usuarioExecutor('u-diego', 'Diego')]);
    const router = tarefasRouter(fake as any);
    const id = await criarTarefaComParticipantes(fake, router, ['u-bianca']);

    const res = await dispatch(router, criarReq({ method: 'PATCH', url: `/${id}/participantes/toggle`, usuario: usuarioExecutor('u-diego', 'Diego'), params: { id } }));

    expect(res.statusCode).toBe(403);
  });

  it('quando o último participante marca, notifica quem criou (mas só uma vez, não a cada toggle anterior)', async () => {
    const fake = criarSupabaseFake([usuarioGerente('admin-1', 'Admin'), usuarioExecutor('u-bianca', 'Bianca'), usuarioExecutor('u-carlos', 'Carlos')]);
    const router = tarefasRouter(fake as any);
    const id = await criarTarefaComParticipantes(fake, router, ['u-bianca', 'u-carlos']);
    vi.clearAllMocks(); // limpa as notificações de "nova tarefa" disparadas na criação acima

    await dispatch(router, criarReq({ method: 'PATCH', url: `/${id}/participantes/toggle`, usuario: usuarioExecutor('u-bianca', 'Bianca'), params: { id } }));
    expect(notificarUsuario).not.toHaveBeenCalled(); // só a Bianca concluiu, falta o Carlos

    await dispatch(router, criarReq({ method: 'PATCH', url: `/${id}/participantes/toggle`, usuario: usuarioExecutor('u-carlos', 'Carlos'), params: { id } }));
    expect(notificarUsuario).toHaveBeenCalledTimes(1);
    expect(vi.mocked(notificarUsuario).mock.calls[0][1]).toBe('admin-1');
  });
});

describe('PATCH /:id/finalizar', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejeita finalizar antes de todo participante concluir', async () => {
    const fake = criarSupabaseFake([usuarioGerente('admin-1', 'Admin'), usuarioExecutor('u-bianca', 'Bianca'), usuarioExecutor('u-carlos', 'Carlos')]);
    const router = tarefasRouter(fake as any);
    const id = await criarTarefaComParticipantes(fake, router, ['u-bianca', 'u-carlos']);
    await dispatch(router, criarReq({ method: 'PATCH', url: `/${id}/participantes/toggle`, usuario: usuarioExecutor('u-bianca', 'Bianca'), params: { id } }));

    const res = await dispatch(router, criarReq({ method: 'PATCH', url: `/${id}/finalizar`, usuario: { id: 'admin-1', roles: ['admin'], permissoes: {} }, params: { id } }));

    expect(res.statusCode).toBe(400);
    expect(fake._tabelas.tarefas[0].status).toBe('pendente');
  });

  it('finaliza quando todos concluíram, e só quem criou (ou admin) pode', async () => {
    const fake = criarSupabaseFake([usuarioGerente('admin-1', 'Admin'), usuarioExecutor('u-bianca', 'Bianca')]);
    const router = tarefasRouter(fake as any);
    const id = await criarTarefaComParticipantes(fake, router, ['u-bianca']);
    await dispatch(router, criarReq({ method: 'PATCH', url: `/${id}/participantes/toggle`, usuario: usuarioExecutor('u-bianca', 'Bianca'), params: { id } }));

    const res = await dispatch(router, criarReq({ method: 'PATCH', url: `/${id}/finalizar`, usuario: { id: 'admin-1', roles: ['admin'], permissoes: {} }, params: { id } }));

    expect(res.statusCode).toBe(200);
    expect(res.body.data.status).toBe('concluida');
    expect(fake._tabelas.tarefas[0].concluida_em).not.toBeNull();
  });

  it('participante (não-criador, não-admin) não pode finalizar mesmo com tudo concluído', async () => {
    const fake = criarSupabaseFake([usuarioGerente('admin-1', 'Admin'), usuarioExecutor('u-bianca', 'Bianca')]);
    const router = tarefasRouter(fake as any);
    const id = await criarTarefaComParticipantes(fake, router, ['u-bianca']);
    await dispatch(router, criarReq({ method: 'PATCH', url: `/${id}/participantes/toggle`, usuario: usuarioExecutor('u-bianca', 'Bianca'), params: { id } }));

    const res = await dispatch(router, criarReq({ method: 'PATCH', url: `/${id}/finalizar`, usuario: usuarioExecutor('u-bianca', 'Bianca'), params: { id } }));

    expect(res.statusCode).toBe(403);
  });
});

describe('PATCH /:id/marcar-lida', () => {
  it('marca a linha do participante logado como lida, sem afetar a dos outros', async () => {
    const fake = criarSupabaseFake([usuarioGerente('admin-1', 'Admin'), usuarioExecutor('u-bianca', 'Bianca'), usuarioExecutor('u-carlos', 'Carlos')]);
    const router = tarefasRouter(fake as any);
    const id = await criarTarefaComParticipantes(fake, router, ['u-bianca', 'u-carlos']);

    const res = await dispatch(router, criarReq({ method: 'PATCH', url: `/${id}/marcar-lida`, usuario: usuarioExecutor('u-bianca', 'Bianca'), params: { id } }));

    expect(res.statusCode).toBe(200);
    const bianca = fake._tabelas.tarefa_participantes.find((p: any) => p.usuario_id === 'u-bianca');
    const carlos = fake._tabelas.tarefa_participantes.find((p: any) => p.usuario_id === 'u-carlos');
    expect(bianca.lida).toBe(true);
    expect(carlos.lida).toBe(false);
  });
});

describe('PATCH /:id/concluir e /:id/reabrir bloqueiam tarefa com participantes', () => {
  it('concluir direto é rejeitado quando a tarefa tem participantes', async () => {
    const fake = criarSupabaseFake([usuarioGerente('admin-1', 'Admin'), usuarioExecutor('u-bianca', 'Bianca')]);
    const router = tarefasRouter(fake as any);
    const id = await criarTarefaComParticipantes(fake, router, ['u-bianca']);

    const res = await dispatch(router, criarReq({ method: 'PATCH', url: `/${id}/concluir`, usuario: usuarioExecutor('u-bianca', 'Bianca'), params: { id } }));

    expect(res.statusCode).toBe(400);
    expect(fake._tabelas.tarefas[0].status).toBe('pendente');
  });
});
