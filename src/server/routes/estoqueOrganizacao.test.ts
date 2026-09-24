import { describe, expect, it } from 'vitest';
import { montarHistoricoUnidade, podeDescartarFoto, registrarUploadRecente, validarAtualizacaoLocal, validarLocalInput, validarReservaInput, vencimentoReserva } from './estoqueOrganizacao.js';
import { vencimentoReserva as vencimentoNaTela } from '../../features/estoque-preview/inventoryPreviewModel.js';

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
  const cliente = '11111111-2222-3333-4444-555555555555';
  const forma = '99999999-8888-7777-6666-555555555555';
  const base = { dias: 7, valor_sinal: 30, forma_pagamento_id: forma };

  it('aceita cliente cadastrado sem nome digitado e calcula o vencimento no servidor', () => {
    expect(validarReservaInput({ ...base, cliente_id: cliente, responsavel: null }, agora))
      .toEqual({ dados: { clienteId: cliente, responsavel: null, reservadaAte: '2026-09-29T12:00:00.000Z', valorSinal: 30, formaPagamentoId: forma } });
  });

  it('aceita nome livre sem cadastro (balcão)', () => {
    expect(validarReservaInput({ ...base, responsavel: '  Pedro ' }, agora))
      .toMatchObject({ dados: { clienteId: null, responsavel: 'Pedro' } });
  });

  it('exige cliente ou nome', () => {
    expect(validarReservaInput({ ...base, responsavel: ' ' }, agora)).toHaveProperty('erro');
  });

  it('recusa cliente_id que não é UUID', () => {
    expect(validarReservaInput({ ...base, cliente_id: 'abc' }, agora)).toEqual({ erro: 'Cliente inválido.' });
  });

  it('exige prazo de 1 a 30 dias', () => {
    expect(validarReservaInput({ ...base, responsavel: 'Pedro', dias: 0 }, agora)).toHaveProperty('erro');
    expect(validarReservaInput({ ...base, responsavel: 'Pedro', dias: 31 }, agora)).toHaveProperty('erro');
    expect(validarReservaInput({ ...base, responsavel: 'Pedro', dias: 2.5 }, agora)).toHaveProperty('erro');
    expect(validarReservaInput({ responsavel: 'Pedro', valor_sinal: 30, forma_pagamento_id: forma }, agora)).toHaveProperty('erro');
  });

  it('exige sinal pago e forma de pagamento', () => {
    expect(validarReservaInput({ ...base, responsavel: 'Pedro', valor_sinal: 0 }, agora)).toHaveProperty('erro');
    expect(validarReservaInput({ ...base, responsavel: 'Pedro', valor_sinal: undefined }, agora)).toHaveProperty('erro');
    expect(validarReservaInput({ ...base, responsavel: 'Pedro', forma_pagamento_id: 'pix' }, agora)).toEqual({ erro: 'Informe a forma de pagamento do sinal.' });
  });

  it('usa o mesmo limite de 30 × 24 h na tela, na API e no banco', () => {
    for (const dias of [1, 7, 29, 30]) expect(vencimentoNaTela(dias, agora)).toBe(vencimentoReserva(dias, agora));
    expect(Date.parse(vencimentoReserva(30, agora))).toBeLessThanOrEqual(agora + 30 * 86_400_000);
  });
});

describe('atualização de local', () => {
  it('aceita desativar e editar código/descrição', () => {
    expect(validarAtualizacaoLocal({ ativo: false })).toEqual({ dados: { ativo: false } });
    expect(validarAtualizacaoLocal({ codigo: ' a-p01-s01 ', descricao: '  ' })).toEqual({ dados: { codigo: 'A-P01-S01', descricao: null } });
  });
  it('recusa corpo vazio ou inválido', () => {
    expect(validarAtualizacaoLocal({})).toHaveProperty('erro');
    expect(validarAtualizacaoLocal({ ativo: 'nao' })).toHaveProperty('erro');
    expect(validarAtualizacaoLocal({ codigo: 'x' })).toHaveProperty('erro');
  });
});

describe('histórico da unidade', () => {
  const agora = Date.parse('2026-09-23T12:00:00Z');
  it('monta a linha do tempo com eventos, autoria e reservas, do mais recente ao mais antigo', () => {
    const eventos = montarHistoricoUnidade(
      { criado_em: '2026-09-01T10:00:00Z', vendida_em: null },
      [{ criada_em: '2026-09-10T10:00:00Z', reservada_ate: '2026-09-17T10:00:00Z', liberada_em: '2026-09-12T10:00:00Z', motivo_liberacao: 'Liberada pela equipe', responsavel: 'Maria', valor_sinal: 30, criada_por_nome: 'Ryan', liberada_por_nome: 'Ayrton' }],
      [{ tipo: 'endereco_alterado', criado_em: '2026-09-05T10:00:00Z', detalhe: { de: null, para: 'A-P01-S01' }, usuario_nome: null },
        { tipo: 'arquivada', criado_em: '2026-09-20T10:00:00Z', detalhe: { motivo: 'Quebrada' }, usuario_nome: 'Ryan' }],
      agora,
    );
    expect(eventos.map((evento) => evento.tipo)).toEqual(['arquivada', 'reserva_liberada', 'reservada', 'endereco', 'cadastrada']);
    expect(eventos[1]).toMatchObject({ autor: 'Ayrton' });
    expect(eventos[2]).toMatchObject({ titulo: 'Reservada para Maria', autor: 'Ryan' });
    expect(eventos[2].detalhe).toContain('30,00');
    expect(eventos[3]).toMatchObject({ titulo: 'Guardada em A-P01-S01', autor: null });
  });
  it('sem a tabela de eventos (068 pendente) usa as colunas e marca reserva vencida', () => {
    const eventos = montarHistoricoUnidade(
      { criado_em: '2026-09-01T10:00:00Z', organizada_em: '2026-09-02T10:00:00Z' },
      [{ criada_em: '2026-09-10T10:00:00Z', reservada_ate: '2026-09-17T10:00:00Z', liberada_em: null, motivo_liberacao: null, responsavel: 'João' }],
      null,
      agora,
    );
    expect(eventos.map((evento) => evento.tipo)).toEqual(['reserva_vencida', 'reservada', 'endereco', 'cadastrada']);
    expect(eventos[1].detalhe).toContain('Sem sinal');
  });
});

describe('descarte de fotos órfãs', () => {
  it('só permite descartar foto enviada pelo mesmo usuário dentro da janela', () => {
    const agora = Date.parse('2026-09-23T12:00:00Z');
    registrarUploadRecente('https://x/estoque/1.jpg', 'usuario-a', agora);
    expect(podeDescartarFoto('https://x/estoque/1.jpg', 'usuario-a', agora + 1000)).toBe(true);
    expect(podeDescartarFoto('https://x/estoque/1.jpg', 'usuario-b', agora + 1000)).toBe(false);
    expect(podeDescartarFoto('https://x/estoque/1.jpg', 'usuario-a', agora + 2 * 60 * 60 * 1000)).toBe(false);
    expect(podeDescartarFoto('https://x/estoque/outra.jpg', 'usuario-a', agora)).toBe(false);
  });
});
