import type { ClienteOperacaoListaItem, ClientesResumoOperacional } from '../operacaoTypes';
import type { Tarefa } from '../../tarefas/types';

export type ClientesMetricFilter = 'busca' | 'peca_disponivel' | 'visitas' | 'todos';

interface ClientesMetricStripProps {
  resumo: ClientesResumoOperacional | null;
  itens: ClienteOperacaoListaItem[];
  tarefas: Tarefa[];
  tarefasLoading: boolean;
  onSelect: (filter: ClientesMetricFilter) => void;
}

function dataLocal(data: Date): string {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function diaDaTarefa(prazo: string | null): string | null {
  if (!prazo) return null;
  const data = new Date(prazo);
  return Number.isNaN(data.getTime()) ? null : dataLocal(data);
}

function contarOrigens(itens: ClienteOperacaoListaItem[]): string {
  const nomes: Record<string, string> = {
    whatsapp: 'WhatsApp',
    balcao: 'Balcão',
    indicacao: 'Indicação',
    instagram: 'Instagram',
    facebook: 'Facebook',
    mercado_livre: 'Mercado Livre',
  };
  const totais = new Map<string, number>();
  for (const item of itens) {
    const nome = nomes[item.origem || ''] || 'Não informada';
    totais.set(nome, (totais.get(nome) || 0) + 1);
  }
  return [...totais.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([nome, total]) => `${nome} ${total}`).join(' · ');
}

function statusDosItens(itens: ClienteOperacaoListaItem[]): Record<string, number> {
  const status: Record<string, number> = {};
  for (const item of itens) {
    for (const pedido of item.pedidos) {
      if (!pedido || typeof pedido !== 'object') continue;
      const registro = pedido as Record<string, unknown>;
      if (typeof registro.status !== 'string') continue;
      status[registro.status] = (status[registro.status] || 0) + 1;
    }
  }
  return status;
}

function calcularIndicadores(resumo: ClientesResumoOperacional | null, itens: ClienteOperacaoListaItem[], tarefas: Tarefa[], tarefasLoading: boolean) {
  const agora = new Date();
  const status = resumo?.pedidos_por_status ?? statusDosItens(itens);
  const emBusca = (status.nova ?? 0) + (status.em_busca ?? 0) + (status.aguardando ?? 0);
  const buscasEmAndamento = (status.em_busca ?? 0) + (status.aguardando ?? 0);
  const disponiveis = status.peca_disponivel ?? 0;
  const esperandoCliente = status.aguardando_cliente ?? 0;
  const pedidosAtivos = emBusca + disponiveis + esperandoCliente;
  const pedidosAtrasados = resumo?.pendencias_por_idade.mais_de_7_dias ?? itens.reduce((total, item) => total + item.pedidos.filter((pedido) => {
    if (!pedido || typeof pedido !== 'object') return false;
    const registro = pedido as Record<string, unknown>;
    if (typeof registro.status !== 'string' || !['nova', 'em_busca', 'aguardando', 'peca_disponivel', 'aguardando_cliente'].includes(registro.status)) return false;
    const criadoEm = typeof registro.criado_em === 'string' ? new Date(registro.criado_em).getTime() : Number.NaN;
    return Number.isFinite(criadoEm) && agora.getTime() - criadoEm > 7 * 86_400_000;
  }).length, 0);
  const hoje = dataLocal(agora);
  const semana = new Date(agora);
  semana.setDate(semana.getDate() + 7);
  const diaLimiteSemana = dataLocal(semana);
  const visitasPendentes = tarefas.filter((tarefa) => tarefa.tipo === 'visita' && tarefa.status === 'pendente');
  const visitasHoje = visitasPendentes.filter((tarefa) => diaDaTarefa(tarefa.prazo) === hoje).length;
  const visitasNaSemana = visitasPendentes.filter((tarefa) => {
    const dia = diaDaTarefa(tarefa.prazo);
    return dia !== null && dia >= hoje && dia <= diaLimiteSemana;
  }).length;
  const visitasAtrasadas = visitasPendentes.filter((tarefa) => {
    const dia = diaDaTarefa(tarefa.prazo);
    return dia !== null && dia < hoje;
  }).length;
  const origemLabel = contarOrigens(itens);

  return [
    {
      id: 'todos' as const,
      label: 'Total de clientes',
      value: resumo?.total_clientes ?? itens.length,
      description: 'cadastros no sistema',
      footnote: origemLabel || 'origem não informada',
      sublabel: null,
      badgeTone: 'text-accent-soft-fg bg-accent-soft-bg',
    },
    {
      id: 'todos' as const,
      label: 'Com encomendas',
      value: pedidosAtivos,
      description: 'pedidos em andamento',
      footnote: `${status.nova ?? 0} novos · ${buscasEmAndamento} em busca · ${esperandoCliente} aguardando cliente`,
      sublabel: pedidosAtrasados > 0 ? `${pedidosAtrasados} há mais de 7 dias` : null,
      badgeTone: 'text-warning bg-warning-bg',
    },
    {
      id: 'visitas' as const,
      label: 'Visitas & agenda',
      value: tarefasLoading ? '—' : visitasNaSemana,
      description: 'visitas nos próximos 7 dias',
      footnote: tarefasLoading ? 'Atualizando agenda' : `${visitasHoje} hoje · ${visitasAtrasadas} atrasadas`,
      sublabel: tarefasLoading ? null : `Hoje: ${visitasHoje}`,
      badgeTone: 'text-accent-soft-fg bg-accent-soft-bg',
    },
    {
      id: 'busca' as const,
      label: 'Procurando peças',
      value: emBusca,
      description: 'pedidos de busca',
      footnote: `${disponiveis} ${disponiveis === 1 ? 'peça encontrada' : 'peças encontradas'}`,
      sublabel: disponiveis > 0 ? `${disponiveis} achadas` : null,
      badgeTone: 'text-positive bg-positive-bg',
    },
  ];
}

export function ClientesMetricStrip({ resumo, itens, tarefas, tarefasLoading, onSelect }: ClientesMetricStripProps) {
  return (
    <section aria-label="Indicadores de clientes" className="relative snap-x snap-mandatory overflow-x-auto overflow-y-hidden pr-3 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden after:pointer-events-none after:absolute after:inset-y-0 after:right-0 after:w-8 after:bg-gradient-to-l after:from-surface-page after:to-transparent sm:overflow-visible sm:pr-0 sm:after:hidden">
      <div className="flex min-w-0 gap-3 sm:grid sm:grid-cols-2 xl:grid-cols-4">
        {calcularIndicadores(resumo, itens, tarefas, tarefasLoading).map(({ id, label, value, description, footnote, badgeTone, sublabel }) => (
          <button
            key={label}
            type="button"
            onClick={() => onSelect(id)}
            className="min-h-[146px] min-w-[84%] snap-start cursor-pointer rounded-card border border-border-default bg-surface-card px-4 py-3.5 text-left shadow-[var(--elevation-1)] transition-[border-color,box-shadow] duration-200 hover:border-accent/35 hover:shadow-[0_8px_24px_rgba(15,23,42,0.06)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 sm:min-w-0"
          >
            <span className="flex min-h-5 items-center justify-between gap-2">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.13em] text-text-muted">{label}</span>
              {sublabel ? <span className={`inline-flex min-h-5 shrink-0 items-center gap-1 rounded-full px-2 text-[9px] font-semibold ${badgeTone}`}><span aria-hidden="true" className="size-1 rounded-full bg-current" />{sublabel}</span> : <span aria-hidden="true" className={`size-1.5 shrink-0 rounded-full ${badgeTone.split(' ')[0].replace('text-', 'bg-')}`} />}
            </span>
            <span className="mt-2 flex min-w-0 items-baseline gap-2">
              <strong className="shrink-0 text-[30px] font-bold leading-none tracking-tight text-text-primary tabular-nums">{value}</strong>
              <span className="min-w-0 text-xs leading-4 text-text-secondary">{description}</span>
            </span>
            <span className="mt-3 flex min-h-7 items-center gap-1.5 border-t border-border-subtle pt-2 text-[11px] leading-4 text-text-muted">
              <span aria-hidden="true" className={`size-1.5 shrink-0 rounded-full ${badgeTone.split(' ')[0].replace('text-', 'bg-')}`} />
              <span className="truncate">{footnote}</span>
            </span>
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-text-muted sm:hidden">Deslize para ver todos os indicadores.</p>
    </section>
  );
}
