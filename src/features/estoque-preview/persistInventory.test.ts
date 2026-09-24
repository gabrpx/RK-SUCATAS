import { beforeEach, describe, expect, it, vi } from 'vitest';
import { salvarUnidadeOperacional } from './persistInventory';
import type { NovaUnidadeInput, PecaEstoque } from './inventoryPreviewModel';
import type { EstoqueLocal } from '../estoque/types';

const { criarUnidade, organizarUnidade, criar, listarUnidades, atualizarUnidade } = vi.hoisted(() => ({
  criarUnidade: vi.fn(), organizarUnidade: vi.fn(), criar: vi.fn(),
  listarUnidades: vi.fn(), atualizarUnidade: vi.fn(),
}));

const { enviarFotoUnidade } = vi.hoisted(() => ({ enviarFotoUnidade: vi.fn() }));
vi.mock('./organizacaoApi', () => ({ enviarFotoUnidade }));
vi.mock('../../utils/comprimirImagem', () => ({ comprimirImagem: async (arquivo: File) => ({ arquivo }) }));

vi.mock('../estoque/api', () => ({
  estoqueApi: { criarUnidade, organizarUnidade, criar, listarUnidades, atualizarUnidade },
  uploadImagemEstoque: vi.fn(),
}));

const peca: PecaEstoque = {
  id: 'peca-1', codigoLegado: 'RK-1', nome: 'Farol', categoriaId: 'cat-1',
  compatibilidades: [], detalhes: '', origemDado: 'real',
};
const local: EstoqueLocal = {
  id: 'local-1', codigo: 'A-P01-S01', deposito: 'Principal', zona: 'A',
  prateleira: 'P01', secao: 'S01', descricao: null, ativo: true,
};
const entrada: NovaUnidadeInput = {
  pecaId: peca.id, preco: 125, grau: 'B', origem: null, fotoUrl: null,
  endereco: local.codigo,
};

beforeEach(() => {
  vi.clearAllMocks();
  criarUnidade.mockResolvedValue({ success: true, data: { id: 'unidade-1' } });
  organizarUnidade.mockResolvedValue({ success: true, data: { id: 'unidade-1' } });
});

describe('salvarUnidadeOperacional', () => {
  it('recusa endereço não cadastrado antes de criar a unidade', async () => {
    await expect(salvarUnidadeOperacional(entrada, [peca], []))
      .rejects.toThrow('não está cadastrado');
    expect(criarUnidade).not.toHaveBeenCalled();
  });

  it('cria ficha e grava o endereço real', async () => {
    const resultado = await salvarUnidadeOperacional(entrada, [peca], [local]);
    expect(resultado.completo).toBe(true);
    expect(criarUnidade).toHaveBeenCalledWith('peca-1', expect.objectContaining({ valor: 125 }));
    expect(organizarUnidade).toHaveBeenCalledWith('unidade-1', { endereco_id: 'local-1', origem_identificacao: null });
  });

  it('informa gravação parcial sem recriar a unidade automaticamente', async () => {
    organizarUnidade.mockResolvedValue({ success: false, error: 'Local inativo' });
    const resultado = await salvarUnidadeOperacional(entrada, [peca], [local]);
    expect(resultado).toMatchObject({ completo: false, pecaId: 'peca-1', unidadeId: 'unidade-1' });
    expect(resultado.mensagem).toContain('Local inativo');
    expect(criarUnidade).toHaveBeenCalledTimes(1);
  });

  it('reaproveita a foto já enviada numa nova tentativa, sem subir cópia', async () => {
    enviarFotoUnidade.mockResolvedValue({ success: true, url: 'https://x/estoque/1.jpg' });
    criarUnidade.mockResolvedValueOnce({ success: false, error: 'Falha de rede' });
    const foto = new File(['a'], 'a.jpg', { type: 'image/jpeg' });
    const cache = new Map<File, string>();
    await expect(salvarUnidadeOperacional({ ...entrada, fotos: [foto] }, [peca], [local], cache)).rejects.toThrow('Falha de rede');
    expect(cache.get(foto)).toBe('https://x/estoque/1.jpg');
    const resultado = await salvarUnidadeOperacional({ ...entrada, fotos: [foto] }, [peca], [local], cache);
    expect(enviarFotoUnidade).toHaveBeenCalledTimes(1);
    expect(criarUnidade).toHaveBeenLastCalledWith('peca-1', expect.objectContaining({ fotos: ['https://x/estoque/1.jpg'] }));
    expect(resultado.fotosAnexadas).toBe(true);
  });
});
