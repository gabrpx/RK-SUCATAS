import { describe, expect, it } from 'vitest';
import { validarLocalInput, validarReservaInput } from './estoqueOrganizacao.js';

describe('cadastro de local do estoque', () => {
  it('recusa código e posição vazios', () => {
    expect(validarLocalInput({ codigo: '', deposito: 'Principal', zona: 'A', prateleira: 'P01', secao: 'S01' })).toContain('código');
    expect(validarLocalInput({ codigo: 'A-P01-S01', deposito: 'Principal', zona: 'A', prateleira: 'P01', secao: '' })).toContain('seção');
  });

  it('aceita endereço estruturado e legível', () => {
    expect(validarLocalInput({ codigo: 'A-P01-S01', deposito: 'Principal', zona: 'A', prateleira: 'P01', secao: 'S01' })).toBeNull();
  });
});

describe('reserva de unidade', () => {
  const agora = Date.parse('2026-09-22T12:00:00Z');
  const ate = '2026-09-29T21:00:00.000Z';
  const cliente = '11111111-2222-3333-4444-555555555555';

  it('aceita cliente cadastrado sem nome digitado', () => {
    expect(validarReservaInput({ cliente_id: cliente, responsavel: null, reservada_ate: ate }, agora))
      .toEqual({ dados: { clienteId: cliente, responsavel: null, reservadaAte: ate } });
  });

  it('aceita nome livre sem cadastro (balcão)', () => {
    expect(validarReservaInput({ responsavel: '  Pedro ', reservada_ate: ate }, agora))
      .toEqual({ dados: { clienteId: null, responsavel: 'Pedro', reservadaAte: ate } });
  });

  it('exige cliente ou nome', () => {
    expect(validarReservaInput({ responsavel: ' ', reservada_ate: ate }, agora)).toHaveProperty('erro');
  });

  it('recusa cliente_id que não é UUID', () => {
    expect(validarReservaInput({ cliente_id: 'abc', reservada_ate: ate }, agora)).toEqual({ erro: 'Cliente inválido.' });
  });

  it('recusa vencimento no passado ou além de 30 dias', () => {
    expect(validarReservaInput({ responsavel: 'Pedro', reservada_ate: '2026-09-21T12:00:00Z' }, agora)).toHaveProperty('erro');
    expect(validarReservaInput({ responsavel: 'Pedro', reservada_ate: '2026-10-30T12:00:00Z' }, agora)).toHaveProperty('erro');
    expect(validarReservaInput({ responsavel: 'Pedro' }, agora)).toHaveProperty('erro');
  });
});
