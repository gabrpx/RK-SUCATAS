import { beforeEach, describe, expect, it, vi } from 'vitest';
import { salvarUnidadeOperacional } from './persistInventory';
import type { NovaUnidadeInput, PecaEstoque } from './inventoryPreviewModel';
import type { EstoqueLocal } from '../estoque/types';

const { organizarUnidade, criar, listarUnidades, atualizarUnidade } = vi.hoisted(() => ({
  organizarUnidade: vi.fn(), criar: vi.fn(), listarUnidades: vi.fn(), atualizarUnidade: vi.fn(),
}));

const { enviarFotoUnidade, criarUnidade, editarUnidade } = vi.hoisted(() => ({
  enviarFotoUnidade: vi.fn(), criarUnidade: vi.fn(), editarUnidade: vi.fn(),
}));
vi.mock('./organizacaoApi', () => ({ enviarFotoUnidade, organizacaoApi: { criarUnidade, editarUnidade } }));
vi.mock('../../utils/comprimirImagem', () => ({ comprimirImagem: async (arquivo: File) => ({ arquivo }) }));

vi.mock('../estoque/api', () => ({
  estoqueApi: { organizarUnidade, criar, listarUnidades, atualizarUnidade },
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
  editarUnidade.mockResolvedValue({ success: true, data: { id: 'unidade-1' } });
});

describe('salvarUnidadeOperacional', () => {
  it('permite cadastrar a unidade sem preço para definir depois', async () => {
    const resultado = await salvarUnidadeOperacional({ ...entrada, preco: null }, [peca], [local]);

    expect(resultado.completo).toBe(true);
    expect(criarUnidade).toHaveBeenCalledWith('peca-1', expect.objectContaining({ valor: null }));
  });

  it('cria peça e primeira unidade sem preço definido', async () => {
    criar.mockResolvedValue({ success: true, data: { id: 'peca-nova' } });
    listarUnidades.mockResolvedValue({ success: true, data: [{ id: 'ficha-nova', vendida_em: null }] });

    const resultado = await salvarUnidadeOperacional(
      { ...entrada, pecaId: undefined, preco: null, novaPeca: { nome: 'Farol novo', categoriaId: 'cat-1' } },
      [peca],
      [local],
    );

    expect(resultado.completo).toBe(true);
    expect(criar).toHaveBeenCalledWith(expect.objectContaining({ valor: null, quantidade: 1 }));
    expect(editarUnidade).toHaveBeenCalledWith('ficha-nova', expect.objectContaining({ valor: null }));
  });

  it('preserva modelo e ano compatíveis ao criar a peça', async () => {
    criar.mockResolvedValue({ success: true, data: { id: 'peca-nova' } });
    listarUnidades.mockResolvedValue({ success: true, data: [{ id: 'ficha-nova', vendida_em: null }] });

    await salvarUnidadeOperacional({
      ...entrada,
      pecaId: undefined,
      novaPeca: {
        nome: 'Balança CG 125 Titan',
        categoriaId: 'cat-1',
        modeloMotoId: 'moto-titan',
        ano: '94 a 99',
        compatibilidades: ['CG 125 Titan · 94 a 99'],
      },
    }, [peca], [local]);

    expect(criar).toHaveBeenCalledWith(expect.objectContaining({
      modelo_moto_id: 'moto-titan',
      ano: '94 a 99',
    }));
  });

  it('recusa endereço não cadastrado antes de criar a unidade', async () => {
    await expect(salvarUnidadeOperacional(entrada, [peca], []))
      .rejects.toThrow('não está cadastrado');
    expect(criarUnidade).not.toHaveBeenCalled();
  });

  it('cria ficha com preço, nota e endereço numa única chamada', async () => {
    const resultado = await salvarUnidadeOperacional(entrada, [peca], [local]);
    expect(resultado.completo).toBe(true);
    expect(criarUnidade).toHaveBeenCalledTimes(1);
    expect(criarUnidade).toHaveBeenCalledWith('peca-1', {
      fotos: [], valor: 125, condicao_nota: 6, endereco_id: 'local-1', origem_identificacao: null,
    });
    expect(organizarUnidade).not.toHaveBeenCalled();
  });

  it('falha do banco não deixa gravação pela metade', async () => {
    criarUnidade.mockResolvedValue({ success: false, error: 'Local inativo ou inexistente' });
    await expect(salvarUnidadeOperacional(entrada, [peca], [local])).rejects.toThrow('Local inativo');
    expect(organizarUnidade).not.toHaveBeenCalled();
  });

  it('peça nova: grava a ficha (foto, nota, endereço) numa única edição', async () => {
    criar.mockResolvedValue({ success: true, data: { id: 'peca-nova' } });
    listarUnidades.mockResolvedValue({ success: true, data: [{ id: 'ficha-1', vendida_em: null }] });
    const resultado = await salvarUnidadeOperacional(
      { ...entrada, pecaId: undefined, novaPeca: { nome: 'Farol novo', categoriaId: 'cat-1' } }, [peca], [local],
    );
    expect(resultado).toMatchObject({ completo: true, pecaId: 'peca-nova', unidadeId: 'ficha-1' });
    expect(editarUnidade).toHaveBeenCalledTimes(1);
    expect(editarUnidade).toHaveBeenCalledWith('ficha-1', {
      fotos: [], valor: 125, condicao_nota: 6, endereco_id: 'local-1', origem_identificacao: null,
    });
    expect(atualizarUnidade).not.toHaveBeenCalled();
  });

  it('peça nova: se a ficha não gravar, avisa sem recriar a peça', async () => {
    criar.mockResolvedValue({ success: true, data: { id: 'peca-nova' } });
    listarUnidades.mockResolvedValue({ success: true, data: [{ id: 'ficha-1', vendida_em: null }] });
    editarUnidade.mockResolvedValue({ success: false, error: 'Local inativo' });
    const resultado = await salvarUnidadeOperacional(
      { ...entrada, pecaId: undefined, novaPeca: { nome: 'Farol novo', categoriaId: 'cat-1' } }, [peca], [local],
    );
    expect(resultado).toMatchObject({ completo: false, pecaId: 'peca-nova', unidadeId: 'ficha-1' });
    expect(resultado.mensagem).toContain('Local inativo');
    expect(criar).toHaveBeenCalledTimes(1);
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
