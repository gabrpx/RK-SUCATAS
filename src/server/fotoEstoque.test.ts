import { beforeEach, describe, expect, it, vi } from 'vitest';

const { excluirImagemPorUrl } = vi.hoisted(() => ({ excluirImagemPorUrl: vi.fn() }));

vi.mock('../services/storageService.js', () => ({ excluirImagemPorUrl }));

import { excluirFotoEstoqueSeOrfa, fotoEstoqueEmUso } from './fotoEstoque.js';

function clienteComRpc(data: boolean | null, error: { code?: string } | null = null) {
  return {
    rpc: vi.fn().mockResolvedValue({ data, error }),
  } as any;
}

describe('proteção das fotos do estoque', () => {
  beforeEach(() => excluirImagemPorUrl.mockReset());

  it('preserva o arquivo quando outra peça ou unidade ainda usa a URL', async () => {
    const supabase = clienteComRpc(true);

    await expect(excluirFotoEstoqueSeOrfa(supabase, 'https://cdn/estoque/compartilhada.jpg')).resolves.toBe(false);

    expect(excluirImagemPorUrl).not.toHaveBeenCalled();
  });

  it('remove somente quando o banco confirma que a URL ficou órfã', async () => {
    const supabase = clienteComRpc(false);

    await expect(excluirFotoEstoqueSeOrfa(supabase, 'https://cdn/estoque/orfa.jpg')).resolves.toBe(true);

    expect(excluirImagemPorUrl).toHaveBeenCalledWith('https://cdn/estoque/orfa.jpg');
  });

  it('preserva o arquivo quando a conferência falha', async () => {
    const supabase = clienteComRpc(null, { code: 'XX000' });

    await expect(fotoEstoqueEmUso(supabase, 'https://cdn/estoque/incerta.jpg')).resolves.toBeNull();
    await expect(excluirFotoEstoqueSeOrfa(supabase, 'https://cdn/estoque/incerta.jpg')).resolves.toBe(false);

    expect(excluirImagemPorUrl).not.toHaveBeenCalled();
  });
});
