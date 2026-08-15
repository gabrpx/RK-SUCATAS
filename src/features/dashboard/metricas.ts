// Funções puras do Dashboard — extraídas pra ficarem testáveis sem montar
// componente. calcularSaldoAcumulado30Dias corrige o gráfico "Desempenho
// (30 dias)": a versão antiga plotava o saldo líquido DE CADA DIA (zerado
// nos dias sem lançamento), o que desenha um formato de batimento cardíaco
// sempre que os dados são esparsos — a maioria dos dias fica achatada em
// zero com picos isolados nos dias com movimento. Aqui o saldo é ACUMULADO
// ao longo da janela de 30 dias, como uma linha de tendência de verdade.
import type { CaixaEntry } from '../caixa/types';

export interface PontoSaldo {
  data: string;
  label: string;
  valor: number;
}

export function calcularSaldoAcumulado30Dias(caixa: CaixaEntry[], hoje: Date = new Date()): PontoSaldo[] {
  const dias: PontoSaldo[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(hoje);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    dias.push({ data: key, label: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), valor: 0 });
  }

  const indicePorData = new Map(dias.map((d, i) => [d.data, i]));
  const deltas = new Array(dias.length).fill(0);
  for (const entry of caixa) {
    const indice = indicePorData.get(entry.data);
    if (indice === undefined) continue;
    deltas[indice] += entry.tipo === 'entrada' ? Number(entry.valor) : -Number(entry.valor);
  }

  let acumulado = 0;
  for (let i = 0; i < dias.length; i++) {
    acumulado += deltas[i];
    dias[i].valor = acumulado;
  }

  return dias;
}

export function compararComMesPassado(atual: number, anterior: number, opcoes: { menorEhMelhor?: boolean } = {}): { texto: string; positivo: boolean } {
  const { menorEhMelhor = false } = opcoes;
  if (anterior <= 0) {
    return { texto: atual > 0 ? 'Não dá pra comparar (mês passado não teve nada)' : 'Sem comparação com o mês passado', positivo: true };
  }
  const pct = Math.round(((atual - anterior) / anterior) * 100);
  const subiu = pct >= 0;
  return {
    texto: `${Math.abs(pct)}% ${subiu ? 'a mais' : 'a menos'} que o mês passado`,
    positivo: menorEhMelhor ? !subiu : subiu,
  };
}
