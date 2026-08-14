import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./pushNotificationService.js', () => ({ notificarUsuarios: vi.fn(() => Promise.resolve()) }));
vi.mock('./mercadolivreApi.js', () => ({
  obterConexaoAtual: vi.fn(), buscarPedido: vi.fn(), buscarPedidosRecentes: vi.fn(), buscarPerguntas: vi.fn(),
  buscarItensPorIds: vi.fn(), obterMargemSincronizacao: vi.fn(), atualizarItemML: vi.fn(), buscarEnvio: vi.fn(),
  responderPergunta: vi.fn(), extrairMlbId: vi.fn(),
}));

import { notificarUsuarios } from './pushNotificationService.js';
import { atualizarItemML, extrairMlbId } from './mercadolivreApi.js';
import { avisarAnunciosDesatualizados } from './mercadolivreSync.js';

function criarSupabaseFake(links: { estoque_id: string }[], usuarios: { id: string }[] = [{ id: 'user-1' }]) {
  return {
    from(tabela: string) {
      if (tabela === 'estoque_anuncios_ml') {
        return { select: () => ({ in: () => Promise.resolve({ data: links, error: null }) }) };
      }
      if (tabela === 'usuarios') {
        return { select: () => ({ eq: () => ({ or: () => Promise.resolve({ data: usuarios, error: null }) }) }) };
      }
      throw new Error(`tabela inesperada: ${tabela}`);
    },
  } as any;
}

// Produção HOJE: a migration_025 (estoque_anuncios_ml) ainda não rodou, e o
// vínculo com o anúncio vive em estoque.anuncio_ml_url. Sem o fallback, o
// gatilho estoque→ML nasce inerte pra TODAS as peças que têm anúncio.
function criarSupabaseFakeLegado(itens: { id: string; anuncio_ml_url: string | null }[]) {
  return {
    from(tabela: string) {
      if (tabela === 'estoque_anuncios_ml') {
        return { select: () => ({ in: () => Promise.resolve({ data: null, error: { code: '42P01' } }) }) };
      }
      if (tabela === 'estoque') {
        return { select: () => ({ in: () => ({ not: () => Promise.resolve({ data: itens.filter((i) => i.anuncio_ml_url), error: null }) }) }) };
      }
      if (tabela === 'usuarios') {
        return { select: () => ({ eq: () => ({ or: () => Promise.resolve({ data: [{ id: 'user-1' }], error: null }) }) }) };
      }
      throw new Error(`tabela inesperada: ${tabela}`);
    },
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(extrairMlbId).mockImplementation((url: string) => url?.match(/MLB\d+/)?.[0] ?? null);
});

describe('avisarAnunciosDesatualizados', () => {
  it('peça com anúncio vinculado gera notificação apontando pra revisão', async () => {
    await avisarAnunciosDesatualizados(criarSupabaseFake([{ estoque_id: 'peca-1' }]), ['peca-1']);

    expect(notificarUsuarios).toHaveBeenCalledTimes(1);
    const payload = vi.mocked(notificarUsuarios).mock.calls[0][2];
    expect(payload.url).toBe('/mercadolivre');
  });

  it('nunca muta o anúncio sozinho — só avisa', async () => {
    await avisarAnunciosDesatualizados(criarSupabaseFake([{ estoque_id: 'peca-1' }]), ['peca-1']);

    expect(atualizarItemML).not.toHaveBeenCalled();
  });

  it('peça sem anúncio no ML não gera notificação nenhuma', async () => {
    await avisarAnunciosDesatualizados(criarSupabaseFake([]), ['peca-1']);

    expect(notificarUsuarios).not.toHaveBeenCalled();
  });

  it('com a migration 025 pendente, cai no link legado em vez de ficar mudo', async () => {
    await avisarAnunciosDesatualizados(criarSupabaseFakeLegado([{ id: 'peca-1', anuncio_ml_url: 'https://produto.mercadolivre.com.br/MLB123' }]), ['peca-1']);

    expect(notificarUsuarios).toHaveBeenCalledTimes(1);
  });

  it('no fallback legado, peça sem URL de anúncio continua sem notificação', async () => {
    await avisarAnunciosDesatualizados(criarSupabaseFakeLegado([{ id: 'peca-1', anuncio_ml_url: null }]), ['peca-1']);

    expect(notificarUsuarios).not.toHaveBeenCalled();
  });

  it('lista vazia não consulta nada', async () => {
    const supabase = { from: vi.fn() } as any;

    await avisarAnunciosDesatualizados(supabase, []);

    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('falha de banco não propaga — venda já aconteceu e não pode ser desfeita por erro de aviso', async () => {
    const supabase = {
      from: () => ({ select: () => ({ in: () => Promise.reject(new Error('conexão caiu')) }) }),
    } as any;

    await expect(avisarAnunciosDesatualizados(supabase, ['peca-1'])).resolves.toBeUndefined();
  });
});
