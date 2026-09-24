import { describe, expect, it, vi } from 'vitest';
import { descreverEdicao, estoqueOrganizacaoRouter, FOTO_ORFA_MS, montarHistoricoUnidade, podeDescartarFoto, registrarUploadRecente, registroPermiteDescarte, validarAtualizacaoLocal, validarLocalInput, validarReservaInput, validarUnidadePayload, vencimentoReserva } from './estoqueOrganizacao.js';
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

describe('baixa automática e edição na linha do tempo (069)', () => {
  const agora = Date.parse('2026-09-24T12:00:00Z');
  it('mostra baixa automática, conferência e edição com autor', () => {
    const eventos = montarHistoricoUnidade(
      { criado_em: '2026-09-01T10:00:00Z', organizada_em: '2026-09-01T10:01:00Z', vendida_em: '2026-09-24T09:00:00Z' },
      [],
      [
        { tipo: 'editada', criado_em: '2026-09-10T10:00:00Z', detalhe: { valor: { de: 100, para: 120 }, condicao_nota: { de: 6, para: 9 } }, usuario_nome: 'Ryan' },
        { tipo: 'baixa_automatica', criado_em: '2026-09-24T09:00:00Z', detalhe: { nome_item: 'Farol CG 160' }, usuario_nome: null },
        { tipo: 'baixa_conferida', criado_em: '2026-09-24T11:00:00Z', detalhe: {}, usuario_nome: 'Ayrton' },
      ],
      agora,
    );
    expect(eventos.map((evento) => evento.tipo)).toEqual(['baixa_conferida', 'baixa_automatica', 'vendida', 'editada', 'endereco', 'cadastrada']);
    expect(eventos[1].detalhe).toContain('Farol CG 160');
    expect(eventos[3]).toMatchObject({ autor: 'Ryan' });
    expect(eventos[3].detalhe).toContain('Condição B → A');
    expect(eventos[4]).toMatchObject({ detalhe: 'Definido no cadastro' });
  });
  it('resume a edição em texto curto', () => {
    expect(descreverEdicao({ valor: { de: null, para: 80 }, origem: { de: null, para: 'Moto 12' }, fotos: { de: 0, para: 2 } }))
      .toMatch(/Preço herdado → R\$\s80,00 · Origem: Moto 12 · Fotos: 0 → 2/);
    expect(descreverEdicao({})).toBeNull();
  });
});

describe('validação da ficha da unidade', () => {
  it('criação permite preço ausente para definir depois e rejeita preço inválido', () => {
    expect(validarUnidadePayload({ condicao_nota: 9 }, 'criar')).toEqual({ dados: { valor: null, condicao_nota: 9 } });
    expect(validarUnidadePayload({ valor: null }, 'criar')).toEqual({ dados: { valor: null } });
    expect(validarUnidadePayload({ valor: 0 }, 'criar')).toEqual({ erro: 'Informe um preço de venda maior que zero.' });
    expect(validarUnidadePayload({ valor: 120.456, condicao_nota: 9 }, 'criar')).toEqual({ dados: { valor: 120.46, condicao_nota: 9 } });
  });
  it('edição aceita só o que mudou e rejeita valores fora da regra', () => {
    expect(validarUnidadePayload({}, 'editar')).toEqual({ erro: 'Nenhuma alteração informada.' });
    expect(validarUnidadePayload({ condicao_nota: 11 }, 'editar')).toEqual({ erro: 'Nota da condição deve ficar entre 1 e 10.' });
    expect(validarUnidadePayload({ endereco_id: 'A-01' }, 'editar')).toEqual({ erro: 'Escolha um local cadastrado.' });
    expect(validarUnidadePayload({ fotos: ['ftp://x'] }, 'editar')).toEqual({ erro: 'Envie até 10 fotos por unidade.' });
    expect(validarUnidadePayload({ origem_identificacao: '  Moto 12  ', endereco_id: null }, 'editar'))
      .toEqual({ dados: { origem_identificacao: 'Moto 12', endereco_id: null } });
  });
});

describe('permissão para upload de fotos no novo estoque', () => {
  function autorizar(method: 'post', path: string, permissoes: Record<string, unknown>) {
    const router = estoqueOrganizacaoRouter({} as never);
    const layer = (router as any).stack.find((item: any) => item.route?.path === path && item.route.methods[method]);
    const middleware = layer.route.stack[0].handle;
    const req = { usuario: { id: 'usuario-a', username: 'teste', roles: [], permissoes } };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();
    middleware(req, res, next);
    return { res, next };
  }

  it.each(['/fotos', '/fotos/descartar'])('%s aceita quem só tem permissão de criar estoque', (path) => {
    const { res, next } = autorizar('post', path, { estoque: { ver: true, criar: true } });
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('continua exigindo permissão de estoque para enviar fotos', () => {
    const { res, next } = autorizar('post', '/fotos', { estoque: { ver: true } });
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe('registro persistente de fotos (069)', () => {
  it('permite descarte do mesmo usuário por até 24 h, mesmo depois de reiniciar o servidor', () => {
    const agora = Date.parse('2026-09-24T12:00:00Z');
    const registro = { usuario_id: 'usuario-a', enviada_em: new Date(agora - 5 * 60 * 60 * 1000).toISOString() };
    expect(registroPermiteDescarte(registro, 'usuario-a', agora)).toBe(true);
    expect(registroPermiteDescarte(registro, 'usuario-b', agora)).toBe(false);
    expect(registroPermiteDescarte({ ...registro, enviada_em: new Date(agora - FOTO_ORFA_MS - 1).toISOString() }, 'usuario-a', agora)).toBe(false);
    expect(registroPermiteDescarte(null, 'usuario-a', agora)).toBe(false);
  });
});
