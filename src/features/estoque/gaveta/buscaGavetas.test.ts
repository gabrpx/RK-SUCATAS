import { describe, expect, it } from 'vitest';
import { correspondeBuscaEstoque, nomeVarianteExibicao } from './buscaGavetas';
import type { Estoque } from '../types';

const item = (over: Partial<Estoque> = {}) => ({
  id: 'e1',
  codigo: 'EST-150',
  nome: 'Tanque de Combustível CG 150 Mix (Avaria)',
  categoria_id: null,
  modelo_moto_id: null,
  modelo_moto: { id: 'm1', nome: 'Honda CG 150', parent_id: null, ordem: 0 },
  modelos_compativeis: [],
  condicao: 'original',
  condicao_nota: null,
  nota_cadastro: null,
  ano: '2009-2010',
  valor: 300,
  quantidade: 1,
  imagens: [],
  descricao: null,
  ativo: true,
  criado_em: '',
  atualizado_em: '',
  anuncio_ml_url: null,
  anuncio_fb_url: null,
  componentes: null,
  unidades_incompletas: [],
  unidades: [],
  ...over,
} as Estoque);

describe('correspondeBuscaEstoque', () => {
  it('encontra todos os termos mesmo separados e fora da ordem da frase', () => {
    expect(correspondeBuscaEstoque(item(), 'tanque combustivel 150')).toBe(true);
    expect(correspondeBuscaEstoque(item(), '150 tanque de combustível')).toBe(true);
  });

  it('ignora acentos, caixa e aceita partes úteis das palavras', () => {
    expect(correspondeBuscaEstoque(item(), 'COMBUSTÍVEL avar')).toBe(true);
  });

  it('procura também em código, categoria, modelo e unidades', () => {
    const completo = item({
      nome: 'Conjunto principal',
      categoria: { id: 'c1', nome: 'Tanques', parent_id: null, ordem: 0 },
      unidades: [{
        id: 'u1', estoque_id: 'e1', nome: 'Vermelho sem tampa', avaria: true,
        avaria_descricao: 'Amassado lateral', descricao: 'Original Honda', fotos: [],
        valor: 350, condicao_nota: 7, vendida_em: null, criado_em: '', atualizado_em: '',
      }],
    });

    expect(correspondeBuscaEstoque(completo, 'EST 150')).toBe(true);
    expect(correspondeBuscaEstoque(completo, 'tanques honda')).toBe(true);
    expect(correspondeBuscaEstoque(completo, 'vermelho amassado')).toBe(true);
  });

  it('não aceita resultado que contenha apenas parte dos termos', () => {
    expect(correspondeBuscaEstoque(item(), 'tanque yamaha 150')).toBe(false);
  });
});

describe('nomeVarianteExibicao', () => {
  it('remove somente o marcador final de avaria do nome da variante', () => {
    expect(nomeVarianteExibicao('TANQUE DE COMBUSTÍVEL CG 150 MIX (Avaria)'))
      .toBe('TANQUE DE COMBUSTÍVEL CG 150 MIX');
  });

  it('preserva nomes que não terminam com o marcador de avaria', () => {
    expect(nomeVarianteExibicao('Suporte (lado esquerdo)')).toBe('Suporte (lado esquerdo)');
  });
});
