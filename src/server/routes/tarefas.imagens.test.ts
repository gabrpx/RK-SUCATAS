// Testes de imagens anexadas em tarefas (Fase 3) — POST / aceita `imagens`
// (array de URLs já hospedadas via POST /api/upload/imagem existente) e
// insere em tarefa_imagens ordenado; PATCH /:id com `imagens` SUBSTITUI a
// lista inteira (mais simples que o diff por id do checklist — imagem não
// tem estado próprio pra preservar, só presença+ordem).
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/pushNotificationService.js', () => ({
  notificarUsuario: vi.fn(() => Promise.resolve()),
}));

import { tarefasRouter } from './tarefas';
import { criarSupabaseFake, usuarioExecutor, criarReq, dispatch } from './tarefasFakeSupabase';

describe('POST /api/tarefas com imagens', () => {
  beforeEach(() => vi.clearAllMocks());

  it('cria as linhas de tarefa_imagens na ordem enviada', async () => {
    const fake = criarSupabaseFake([usuarioExecutor('u-bianca', 'Bianca')]);
    const router = tarefasRouter(fake as any);

    const res = await dispatch(
      router,
      criarReq({ body: { titulo: 'Trocar peça', atribuido_para: 'u-bianca', imagens: ['https://x/1.jpg', 'https://x/2.jpg'] } }),
    );

    expect(res.statusCode).toBe(200);
    expect(fake._tabelas.tarefa_imagens).toHaveLength(2);
    expect(fake._tabelas.tarefa_imagens.map((i: any) => i.ordem)).toEqual([0, 1]);
    expect(res.body.data.imagens.map((i: any) => i.url)).toEqual(['https://x/1.jpg', 'https://x/2.jpg']);
  });

  it('sem imagens no body, não cria nenhuma linha (retrocompatível)', async () => {
    const fake = criarSupabaseFake([usuarioExecutor('u-bianca', 'Bianca')]);
    const router = tarefasRouter(fake as any);

    const res = await dispatch(router, criarReq({ body: { titulo: 'Trocar peça', atribuido_para: 'u-bianca' } }));

    expect(fake._tabelas.tarefa_imagens).toHaveLength(0);
    expect(res.body.data.imagens).toEqual([]);
  });
});

describe('PATCH /api/tarefas/:id com imagens', () => {
  beforeEach(() => vi.clearAllMocks());

  it('substitui a lista inteira de imagens', async () => {
    const fake = criarSupabaseFake([usuarioExecutor('u-bianca', 'Bianca')]);
    const router = tarefasRouter(fake as any);
    const criada = await dispatch(router, criarReq({ body: { titulo: 'T', atribuido_para: 'u-bianca', imagens: ['https://x/1.jpg'] } }));
    const id = criada.body.data.id;

    const res = await dispatch(router, criarReq({ method: 'PATCH', url: `/${id}`, params: { id }, body: { imagens: ['https://x/2.jpg', 'https://x/3.jpg'] } }));

    expect(res.statusCode).toBe(200);
    expect(res.body.data.imagens.map((i: any) => i.url)).toEqual(['https://x/2.jpg', 'https://x/3.jpg']);
  });

  it('imagens: [] remove todas as imagens existentes', async () => {
    const fake = criarSupabaseFake([usuarioExecutor('u-bianca', 'Bianca')]);
    const router = tarefasRouter(fake as any);
    const criada = await dispatch(router, criarReq({ body: { titulo: 'T', atribuido_para: 'u-bianca', imagens: ['https://x/1.jpg'] } }));
    const id = criada.body.data.id;

    const res = await dispatch(router, criarReq({ method: 'PATCH', url: `/${id}`, params: { id }, body: { imagens: [] } }));

    expect(res.body.data.imagens).toEqual([]);
  });

  it('sem `imagens` no body do PATCH, as imagens existentes não são tocadas', async () => {
    const fake = criarSupabaseFake([usuarioExecutor('u-bianca', 'Bianca')]);
    const router = tarefasRouter(fake as any);
    const criada = await dispatch(router, criarReq({ body: { titulo: 'T', atribuido_para: 'u-bianca', imagens: ['https://x/1.jpg'] } }));
    const id = criada.body.data.id;

    const res = await dispatch(router, criarReq({ method: 'PATCH', url: `/${id}`, params: { id }, body: { descricao: 'nova descrição' } }));

    expect(res.body.data.imagens.map((i: any) => i.url)).toEqual(['https://x/1.jpg']);
  });
});
