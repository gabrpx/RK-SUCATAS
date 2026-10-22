import { describe, expect, it } from 'vitest';
import { tarefasRouter } from './tarefas';
import { criarReq, criarSupabaseFake, dispatch } from './tarefasFakeSupabase';

const USUARIO = {
  id: 'u-gerente',
  nome_exibicao: 'Gerente',
  ativo: true,
  roles: [],
  permissoes: { tarefas: { ver: true, criar: true, concluir: true } },
};

function tarefaBase(id = 'tarefa-1') {
  return {
    id,
    titulo: 'Conferir peça',
    descricao: null,
    prazo: null,
    atribuido_para: USUARIO.id,
    criado_por: USUARIO.id,
    status: 'pendente',
    concluida_em: null,
    criado_em: new Date().toISOString(),
    atualizado_em: new Date().toISOString(),
  };
}

describe('status de tarefas sem checklist', () => {
  it('persiste concluída e permite reabrir pelo fluxo manual', async () => {
    const fake = criarSupabaseFake([USUARIO]);
    fake._tabelas.tarefas.push(tarefaBase());
    const router = tarefasRouter(fake as any);

    const concluida = await dispatch(router, criarReq({
      method: 'PATCH',
      url: '/tarefa-1/concluir',
      params: { id: 'tarefa-1' },
      usuario: USUARIO,
    }));

    expect(concluida.statusCode).toBe(200);
    expect(concluida.body.data.status).toBe('concluida');
    expect(fake._tabelas.tarefas[0].status).toBe('concluida');

    const reaberta = await dispatch(router, criarReq({
      method: 'PATCH',
      url: '/tarefa-1/reabrir',
      params: { id: 'tarefa-1' },
      usuario: USUARIO,
    }));

    expect(reaberta.statusCode).toBe(200);
    expect(reaberta.body.data.status).toBe('pendente');
    expect(fake._tabelas.tarefas[0].status).toBe('pendente');
  });

  it('recusa conclusão manual quando a tarefa possui checklist', async () => {
    const fake = criarSupabaseFake([USUARIO]);
    fake._tabelas.tarefas.push(tarefaBase());
    fake._tabelas.tarefa_itens.push({
      id: 'item-1',
      tarefa_id: 'tarefa-1',
      texto: 'Conferir fotos',
      concluido: false,
      ordem: 0,
      concluido_em: null,
      concluido_por: null,
    });
    const router = tarefasRouter(fake as any);

    const response = await dispatch(router, criarReq({
      method: 'PATCH',
      url: '/tarefa-1/concluir',
      params: { id: 'tarefa-1' },
      usuario: USUARIO,
    }));

    expect(response.statusCode).toBe(400);
    expect(response.body.error).toMatch(/checklist/i);
    expect(fake._tabelas.tarefas[0].status).toBe('pendente');
  });
});
