import { describe, expect, it } from 'vitest';
import { correspondeBuscaEstoque, itemAtendeFiltroRapido, nomeVarianteExibicao } from './buscaGavetas';
import type { Estoque, EstoqueUnidade } from '../types';

const unid = (over: Partial<EstoqueUnidade> = {}): EstoqueUnidade => ({
  id: 'u' + Math.random(), estoque_id: 'e1', nome: null, avaria: false,
  avaria_descricao: null, descricao: null, fotos: [], valor: null,
  condicao_nota: null, vendida_em: null, criado_em: '', atualizado_em: '', ...over,
});

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

  it('encontra SKU, identificação de origem e descrição da unidade com termos sem acento', () => {
    const completo = item({
      nome: 'Conjunto principal',
      unidades: [unid({
        sku: 8127,
        nome: 'Vermelho sem tampa',
        origem_identificacao: 'Honda Titan 150',
        avaria_descricao: 'Amassado lateral',
      })],
    });

    expect(correspondeBuscaEstoque(completo, '8127 vermelho amassado titan')).toBe(true);
    expect(correspondeBuscaEstoque(completo, '8127 preto titan')).toBe(false);
  });

  it('não aceita resultado que contenha apenas parte dos termos', () => {
    expect(correspondeBuscaEstoque(item(), 'tanque yamaha 150')).toBe(false);
  });
});

describe('itemAtendeFiltroRapido', () => {
  it('com_avaria: só passa quando há unidade disponível com avaria', () => {
    expect(itemAtendeFiltroRapido(item({ unidades: [unid({ avaria: true })] }), 'com_avaria')).toBe(true);
    expect(itemAtendeFiltroRapido(item({ unidades: [unid()] }), 'com_avaria')).toBe(false);
  });

  it('sem_foto: passa quando a variante não tem foto própria nem legada', () => {
    expect(itemAtendeFiltroRapido(item({ imagens: [], quantidade: 1, unidades: [] }), 'sem_foto')).toBe(true);
    expect(itemAtendeFiltroRapido(item({ imagens: [], quantidade: 1, unidades: [unid({ fotos: ['a.jpg'] })] }), 'sem_foto')).toBe(false);
  });

  it('vendidas: passa quando existe ao menos uma unidade vendida', () => {
    expect(itemAtendeFiltroRapido(item({ unidades: [unid({ vendida_em: '2026-01-01' })] }), 'vendidas')).toBe(true);
    expect(itemAtendeFiltroRapido(item({ unidades: [unid()] }), 'vendidas')).toBe(false);
  });

  it('disponiveis: passa quando há estoque para vender', () => {
    expect(itemAtendeFiltroRapido(item({ quantidade: 2, unidades: [] }), 'disponiveis')).toBe(true);
    expect(itemAtendeFiltroRapido(item({ quantidade: 1, unidades: [unid({ vendida_em: '2026-01-01' })] }), 'disponiveis')).toBe(false);
  });

  it('pendentes: passa quando a variante tem qualquer pendência', () => {
    expect(itemAtendeFiltroRapido(item({ gaveta_id: null }), 'pendentes')).toBe(true);
    const semPendencia = item({ gaveta_id: 'g1', imagens: [], valor: 100, quantidade: 1, unidades: [unid({ fotos: ['a.jpg'], valor: 100 })] });
    expect(itemAtendeFiltroRapido(semPendencia, 'pendentes')).toBe(false);
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
