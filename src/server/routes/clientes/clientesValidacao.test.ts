import { describe, expect, it } from 'vitest';
import {
  normalizarInstagram,
  normalizarTelefone,
  validarClienteInput,
  validarContatoObrigatorio,
  validarPedidoInput,
} from './clientesValidacao';

describe('normalização de contato', () => {
  it('aceita Instagram válido sem telefone', () => {
    expect(validarContatoObrigatorio({ telefone: '', instagram_usuario: '@Moto.Pecas', preferencia_contato: 'instagram' })).toEqual([]);
    expect(normalizarInstagram('@Moto.Pecas')).toBe('moto.pecas');
  });

  it('aceita telefone válido sem Instagram', () => {
    expect(validarContatoObrigatorio({ telefone: '(83) 9 9999-9999', instagram_usuario: '', preferencia_contato: 'whatsapp' })).toEqual([]);
    expect(normalizarTelefone('(83) 9 9999-9999')).toBe('83999999999');
  });

  it('rejeita os dois contatos vazios', () => {
    expect(validarContatoObrigatorio({ telefone: '', instagram_usuario: '', preferencia_contato: 'whatsapp' })).toContain('Informe WhatsApp ou Instagram');
  });

  it('rejeita preferência WhatsApp sem telefone', () => {
    expect(validarContatoObrigatorio({ telefone: '', instagram_usuario: '@cliente', preferencia_contato: 'whatsapp' })).toContain('Informe o WhatsApp escolhido como contato');
  });

  it('rejeita preferência Instagram sem handle', () => {
    expect(validarContatoObrigatorio({ telefone: '83999999999', instagram_usuario: '', preferencia_contato: 'instagram' })).toContain('Informe o Instagram escolhido como contato');
  });

  it('normaliza @ duplicado e caixa diferente para a mesma chave', () => {
    expect(normalizarInstagram('@@RK.SUCATAS')).toBe('rk.sucatas');
    expect(normalizarInstagram('@rk.sucatas')).toBe('rk.sucatas');
  });
});

describe('validarClienteInput', () => {
  const valido = {
    nome: 'Ana Souza',
    telefone: '83999999999',
    instagram_usuario: '',
    preferencia_contato: 'whatsapp',
    origem: 'balcao',
    cidade: 'Campina Grande',
    estado: 'PB',
  };

  it('aceita os seis canais aprovados como origem', () => {
    for (const origem of ['whatsapp', 'facebook', 'mercado_livre', 'instagram', 'indicacao', 'balcao']) {
      expect(validarClienteInput({ ...valido, origem }).ok, origem).toBe(true);
    }
  });

  it('rejeita origem inválida', () => {
    const resultado = validarClienteInput({ ...valido, origem: 'panfleto' });
    expect(resultado).toMatchObject({ ok: false });
    if (resultado.ok === false) expect(resultado.erros).toContain('Origem inválida');
  });

  it.each(['redes_sociais', 'outro'])('preserva a origem legada %s somente em cliente existente', (origem) => {
    expect(validarClienteInput({ ...valido, origem }).ok).toBe(false);
    expect(validarClienteInput({
      ...valido,
      id: '11111111-1111-4111-8111-111111111111',
      origem,
    }).ok).toBe(true);
  });

  it('lista precisamente os mínimos ausentes sem exigir moto', () => {
    const resultado = validarClienteInput({ nome: 'A', telefone: '', instagram_usuario: '', cidade: '', estado: '', origem: '' });
    expect(resultado).toMatchObject({ ok: false });
    if (resultado.ok === false) {
      expect(resultado.erros).toEqual(expect.arrayContaining([
        'Nome deve ter pelo menos 2 caracteres',
        'Informe WhatsApp ou Instagram',
        'Escolha WhatsApp ou Instagram como contato',
        'Cidade é obrigatória',
        'Estado é obrigatório',
        'Origem inválida',
      ]));
      expect(resultado.erros.join(' ')).not.toMatch(/moto/i);
    }
  });
});

describe('validarPedidoInput', () => {
  it('exige peça, moto, responsável e idempotência', () => {
    const resultado = validarPedidoInput({});
    expect(resultado).toMatchObject({ ok: false });
    if (resultado.ok === false) {
      expect(resultado.erros).toEqual(expect.arrayContaining([
        'Descrição da peça é obrigatória',
        'Informe a moto do pedido',
        'Responsável é obrigatório',
        'Chave de idempotência é obrigatória',
      ]));
    }
  });

  it('aceita descrição, moto em texto livre, responsável e ano opcional', () => {
    const resultado = validarPedidoInput({
      descricao: 'Farol',
      moto_modelo_texto: 'CG 160',
      responsavel_id: '11111111-1111-4111-8111-111111111111',
      ano_compatibilidade: '2024',
      idempotency_key: 'pedido-2026-10-03-001',
    });
    expect(resultado).toMatchObject({ ok: true });
  });
});
