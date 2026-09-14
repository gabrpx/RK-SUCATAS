import { describe, it, expect } from 'vitest';
import { ordenarVariantes, type CriterioOrdenacao } from './ordenacaoVariantes';
import type { Estoque } from '../types';

const item = (over: Partial<Estoque> = {}): Estoque => ({
  id: 'e', codigo: 'C', nome: 'X', categoria_id: null, modelo_moto_id: null,
  condicao: 'original', condicao_nota: null, nota_cadastro: null, ano: null,
  valor: 10, quantidade: 1, imagens: ['a.jpg'], descricao: null, ativo: true,
  criado_em: '', atualizado_em: '', anuncio_ml_url: null, anuncio_fb_url: null,
  componentes: null, unidades_incompletas: [], gaveta_id: 'g1', unidades: [],
  ...over,
});

const nomes = (itens: Estoque[]) => itens.map((i) => i.nome);

describe('ordenarVariantes', () => {
  const a = item({ id: 'a', nome: 'Bravo', valor: 30, quantidade: 1, gaveta_id: 'g1' });
  const b = item({ id: 'b', nome: 'alfa', valor: 10, quantidade: 5, gaveta_id: 'g1' });
  const c = item({ id: 'c', nome: 'Charlie', valor: 20, quantidade: 3, gaveta_id: null }); // sem gaveta => pendência

  it('não muta o array original', () => {
    const arr = [a, b, c];
    ordenarVariantes(arr, 'nome');
    expect(arr[0]).toBe(a);
  });

  it('ordena por nome (case-insensitive, pt-BR)', () => {
    expect(nomes(ordenarVariantes([a, b, c], 'nome'))).toEqual(['alfa', 'Bravo', 'Charlie']);
  });

  it('ordena por quantidade desc', () => {
    expect(nomes(ordenarVariantes([a, b, c], 'quantidade'))).toEqual(['alfa', 'Charlie', 'Bravo']);
  });

  it('ordena por valor desc', () => {
    expect(nomes(ordenarVariantes([a, b, c], 'valor'))).toEqual(['Bravo', 'Charlie', 'alfa']);
  });

  it('ordena por pendências desc (mais pendências primeiro)', () => {
    const ordenado = ordenarVariantes([a, b, c], 'pendencias');
    // c tem sem_gaveta; a e b não têm pendência (foto própria, preço, com gaveta)
    expect(ordenado[0].id).toBe('c');
  });

  it('aceita todos os critérios declarados', () => {
    const criterios: CriterioOrdenacao[] = ['nome', 'quantidade', 'valor', 'pendencias'];
    for (const crit of criterios) expect(ordenarVariantes([a, b], crit)).toHaveLength(2);
  });
});
