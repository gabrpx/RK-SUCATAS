import { describe, expect, it } from 'vitest';
import { pedidoAcaoCopy, pedidoStatusCopy, situacaoCopy } from './operacaoCopy';

describe('copy operacional de Clientes', () => {
  it('usa os rótulos cotidianos aprovados', () => {
    expect(pedidoStatusCopy).toMatchObject({
      nova: 'Pedido novo',
      em_busca: 'Procurando peça',
      peca_disponivel: 'Peça disponível',
      aguardando_cliente: 'Aguardando resposta',
      reservada: 'Aguardando retirada',
      visita_agendada: 'Visita agendada',
    });
    expect(pedidoAcaoCopy).toMatchObject({
      cliente_avisado: 'Cliente avisado',
      vai_buscar: 'Vai buscar',
      nao_quer_mais: 'Não quer mais',
    });
    expect(situacaoCopy).toMatchObject({
      promessa_vencida: 'Promessa vencida',
      reserva_vencendo: 'Reserva vencendo',
      sem_pendencias: 'Sem pendências',
    });
  });

  it('não expõe códigos internos nem os termos rejeitados na interface', () => {
    const textos = [...Object.values(pedidoStatusCopy), ...Object.values(pedidoAcaoCopy), ...Object.values(situacaoCopy)].join(' | ');

    expect(textos).not.toMatch(/em_busca|peca_disponivel|\bmatch\b|Demandas abertas|Peças encontradas/i);
  });
});
