// Feature 5 — alerta proativo de reputação em risco. Função pura: só decide
// QUANDO alertar e com qual mensagem; a ação (AlertBar com "Ver pedidos") é
// montada em MercadoLivreView.tsx, que já tem a seção de Pedidos pra apontar.
import type { MercadoLivreConta } from './api';

export type TipoAlertaReputacao = 'claims' | 'delayed_handling_time' | 'cancellations';

export interface AlertaReputacao {
  tipo: TipoAlertaReputacao;
  mensagem: string;
}

// Mesmo limiar que a própria tela já usa pra colorir a métrica (ver
// tomPorTaxa em MercadoLivreView.tsx): qualquer taxa acima de zero é, por
// definição, algo que vale a pena olhar — reclamação/atraso/cancelamento não
// tem "quantidade aceitável", tem "zero é o normal".
export function calcularAlertasReputacao(conta: MercadoLivreConta | null): AlertaReputacao[] {
  const metrics = conta?.seller_reputation?.metrics;
  if (!metrics) return [];

  const alertas: AlertaReputacao[] = [];

  if (metrics.claims && metrics.claims.rate > 0) {
    alertas.push({
      tipo: 'claims',
      mensagem: `${Math.round(metrics.claims.rate * 100)}% das vendas recentes tiveram reclamação.`,
    });
  }
  if (metrics.delayed_handling_time && metrics.delayed_handling_time.rate > 0) {
    alertas.push({
      tipo: 'delayed_handling_time',
      mensagem: `${Math.round(metrics.delayed_handling_time.rate * 100)}% dos envios recentes atrasaram.`,
    });
  }
  if (metrics.cancellations && metrics.cancellations.rate > 0) {
    alertas.push({
      tipo: 'cancellations',
      mensagem: `${Math.round(metrics.cancellations.rate * 100)}% das vendas recentes foram canceladas.`,
    });
  }

  return alertas;
}
