import { describe, expect, it } from 'vitest';
import { agruparClientesPorCidade, normalizarChaveCidade, tomDaSituacao } from './mapaModel';
import type { ClienteOperacaoListaItem, SituacaoCliente } from '../operacaoTypes';

function cliente(id: string, cidade: string | null, estado: string | null): ClienteOperacaoListaItem {
  return {
    id, nome: id, telefone: null, instagram_usuario: null, preferencia_contato: 'whatsapp', origem: 'balcao', cidade, estado,
    ativo: true, banido: false, criado_em: '2026-10-01T12:00:00.000Z', atualizado_em: '2026-10-01T12:00:00.000Z', motos: [], pedidos: [],
  };
}

const critica: SituacaoCliente = { codigo: 'promessa_vencida', rotulo: 'Promessa vencida', nivel: 'critico', proximaAcaoEm: '2026-10-01T12:00:00.000Z' };
const informativa: SituacaoCliente = { codigo: 'pedido_novo', rotulo: 'Pedido novo', nivel: 'informativo', proximaAcaoEm: null };

describe('mapaModel', () => {
  it('normaliza acentos e preserva UF na chave de município', () => {
    expect(normalizarChaveCidade('  São  José ', 'sc')).toBe('SC:sao jose');
    expect(normalizarChaveCidade('Campina Grande', '')).toBeNull();
  });

  it('agrupa a mesma cidade na UF e separa municípios homônimos', () => {
    const itens = [cliente('a', 'São José', 'SC'), cliente('b', 'São José', 'SC'), cliente('c', 'São José', 'PB'), cliente('d', null, null)];
    const distribuicao = agruparClientesPorCidade(itens, new Map([['a', informativa], ['b', critica]]));

    expect(distribuicao.grupos).toHaveLength(2);
    expect(distribuicao.grupos[0]).toMatchObject({ chave: 'SC:sao jose', clientes: [expect.anything(), expect.anything()], situacao: critica });
    expect(distribuicao.grupos[1]).toMatchObject({ chave: 'PB:sao jose', clientes: [expect.anything()] });
    expect(distribuicao.semLocalizacao.map((item) => item.id)).toEqual(['d']);
  });

  it('converte níveis em tons que não dependem somente de cor', () => {
    expect(tomDaSituacao('critico')).toBe('danger');
    expect(tomDaSituacao('atencao')).toBe('warning');
    expect(tomDaSituacao('informativo')).toBe('accent');
    expect(tomDaSituacao('neutro')).toBe('muted');
  });
});
