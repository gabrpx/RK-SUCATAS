import { AlertCircle, ArrowRight, CalendarDays, CalendarClock, MessageCircle, RefreshCw, UserRound, UsersRound } from 'lucide-react';
import { Tooltip } from '../../../components/ui/beui-tooltip';
import type { Tarefa } from '../../tarefas/types';
import { pedidoStatusCopy } from '../operacaoCopy';
import { calcularSituacaoCliente } from '../operacaoModel';
import { ClientesMetricStrip, type ClientesMetricFilter } from './ClientesMetricStrip';
import type { ClienteOperacaoEntrada, ClienteOperacaoListaItem, ClientesResumoOperacional, PedidoBuscaOperacional } from '../operacaoTypes';

export interface ClientesPainelProps {
  resumo: ClientesResumoOperacional | null;
  itens: ClienteOperacaoListaItem[];
  tarefas?: Tarefa[];
  loading?: boolean;
  agendaLoading?: boolean;
  agendaError?: string | null;
  capabilityUnavailable?: boolean;
  error?: string | null;
  onRetry: () => void;
  onRetryAgenda?: () => void;
  onSelectMetric: (filter: ClientesMetricFilter) => void;
  onSelectCliente: (clienteId: string) => void;
  onOpenContato?: (cliente: ClienteOperacaoListaItem) => void;
  onViewClientes?: () => void;
  onViewAgenda?: () => void;
}

function pedidosDoCliente(item: ClienteOperacaoListaItem): PedidoBuscaOperacional[] {
  return (item.pedidos as Array<Record<string, unknown>>).flatMap((pedido) => {
    if (typeof pedido?.id !== 'string' || typeof pedido?.status !== 'string' || typeof pedido?.criado_em !== 'string') return [];
    return [{
      id: pedido.id,
      status: pedido.status as PedidoBuscaOperacional['status'],
      criadoEm: pedido.criado_em,
      descricao: typeof pedido.descricao === 'string' ? pedido.descricao : null,
      prometidoPara: typeof pedido.prometido_para === 'string' ? pedido.prometido_para : null,
      proximaAcaoEm: typeof pedido.proxima_acao_em === 'string' ? pedido.proxima_acao_em : null,
    }];
  });
}

function tempoDecorrido(data: string): string {
  const inicio = new Date(data).getTime();
  if (Number.isNaN(inicio)) return 'há algum tempo';
  const dias = Math.max(0, Math.floor((Date.now() - inicio) / 86_400_000));
  if (dias === 0) return 'hoje';
  return `há ${dias} ${dias === 1 ? 'dia' : 'dias'}`;
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

function formatarHorario(prazo: string | null): string {
  if (!prazo) return 'Sem horário';
  const data = new Date(prazo);
  if (Number.isNaN(data.getTime())) return 'Sem horário';
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(data);
}

function formatarPrazoVisita(prazo: string | null, hoje: string): string {
  if (!prazo) return 'Sem horário';
  const data = new Date(prazo);
  if (Number.isNaN(data.getTime())) return 'Sem horário';
  if (dataLocal(data) === hoje) return formatarHorario(prazo);
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(data);
}

function formatarPrazoCompacto(prazo: string | null): string {
  if (!prazo) return 'Sem prazo';
  const data = new Date(prazo);
  if (Number.isNaN(data.getTime())) return 'Sem prazo';
  const diaMes = `${String(data.getDate()).padStart(2, '0')}/${String(data.getMonth() + 1).padStart(2, '0')}`;
  return `${diaMes} ${formatarHorario(prazo)}`;
}

function entradaDoCliente(item: ClienteOperacaoListaItem): ClienteOperacaoEntrada {
  return { id: item.id, pedidos: pedidosDoCliente(item), visitas: [], reservas: [] };
}

function nomeVeiculo(item: ClienteOperacaoListaItem): string {
  const motos = item.motos as Array<{ modelo_moto?: { nome?: string } | null; modelo_texto?: string | null; principal?: boolean }>;
  const principal = motos.find((moto) => moto.principal) ?? motos[0];
  return principal?.modelo_moto?.nome || principal?.modelo_texto || 'Moto não informada';
}

const tonsStatus: Record<string, string> = {
  critico: 'border-danger/20 text-danger',
  atencao: 'border-warning/25 text-warning',
  informativo: 'border-accent/20 text-accent-soft-fg',
  neutro: 'border-border-default text-text-muted',
};

function iniciais(nome: string): string {
  return nome.trim().split(/\s+/).slice(0, 2).map((parte) => parte.charAt(0)).join('').toLocaleUpperCase('pt-BR');
}

export function ClientesPainel({
  resumo,
  itens,
  tarefas = [],
  loading = false,
  agendaLoading = false,
  agendaError = null,
  capabilityUnavailable = false,
  error = null,
  onRetry,
  onRetryAgenda = onRetry,
  onSelectMetric,
  onSelectCliente,
  onOpenContato = () => {},
  onViewClientes = () => {},
  onViewAgenda = () => {},
}: ClientesPainelProps) {
  const agora = new Date();
  const hoje = dataLocal(agora);
  const limiteAgenda = new Date(agora);
  limiteAgenda.setDate(limiteAgenda.getDate() + 7);
  const ultimoDiaAgenda = dataLocal(limiteAgenda);
  const tarefasVisita = tarefas.filter((tarefa) => tarefa.tipo === 'visita');
  const visitasPendentes = tarefasVisita.filter((tarefa) => tarefa.status === 'pendente' && diaDaTarefa(tarefa.prazo));
  const visitasAtrasadas = visitasPendentes.filter((tarefa) => diaDaTarefa(tarefa.prazo)! < hoje);
  const visitasNoPeriodo = visitasPendentes.filter((tarefa) => {
    const dia = diaDaTarefa(tarefa.prazo)!;
    return dia >= hoje && dia <= ultimoDiaAgenda;
  });
  const visitasDaAgenda = [...visitasAtrasadas, ...visitasNoPeriodo]
    .sort((a, b) => new Date(a.prazo!).getTime() - new Date(b.prazo!).getTime())
    .slice(0, 4);
  const totalClientes = resumo?.total_clientes ?? itens.length;
  const clientesComEntrada = itens.map((item) => ({ item, entrada: entradaDoCliente(item) }));
  const situacoesPorCliente = new Map(clientesComEntrada.map(({ item, entrada }) => [item.id, calcularSituacaoCliente(entrada, agora)]));
  const clientesRecentes = [...clientesComEntrada]
    .sort((a, b) => new Date(b.item.atualizado_em || b.item.criado_em).getTime() - new Date(a.item.atualizado_em || a.item.criado_em).getTime())
    .slice(0, 8);
  const pendencias = resumo ? [
    { label: 'Aguardando resposta há mais de 48 h', valor: resumo.respostas_acima_48h },
    { label: 'Reservas aguardando decisão', valor: resumo.reservas_sem_decisao },
    { label: 'Visitas vencidas em Tarefas', valor: agendaLoading ? null : visitasAtrasadas.length },
    { label: 'Possíveis duplicidades', valor: resumo.decisoes_duplicidade },
  ] : [];

  return (
    <div className="space-y-5 sm:space-y-6">
      {loading && itens.length === 0 && !resumo ? (
        <section role="status" className="rounded-card border border-border-default bg-surface-card p-4 text-sm text-text-muted">Carregando a operação de clientes…</section>
      ) : null}

      {resumo || itens.length > 0 ? <ClientesMetricStrip resumo={resumo} itens={itens} tarefas={tarefas} tarefasLoading={agendaLoading} onSelect={onSelectMetric} /> : (
        <section role={error ? 'alert' : 'status'} className="flex flex-col gap-3 rounded-card border border-border-default bg-surface-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex items-start gap-2.5 text-sm">
            <AlertCircle aria-hidden="true" className="mt-0.5 shrink-0 text-warning" size={17} />
            <div><p className="font-semibold text-text-primary">{error ? 'Não foi possível atualizar os indicadores' : 'Indicadores operacionais indisponíveis'}</p><p className="mt-1 text-text-secondary">{error || 'Os números serão exibidos quando os dados operacionais estiverem disponíveis.'}</p></div>
          </div>
          {error ? <button type="button" onClick={onRetry} className="inline-flex min-h-10 shrink-0 cursor-pointer items-center gap-2 self-start rounded-control border border-border-default bg-surface-card px-3 text-sm font-semibold text-text-primary transition hover:bg-surface-inset focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 sm:self-auto"><RefreshCw aria-hidden="true" size={15} />Tentar novamente</button> : null}
        </section>
      )}

      {error && (itens.length > 0 || resumo) ? (
        <p role="status" className="flex items-center gap-2 text-sm text-warning"><AlertCircle aria-hidden="true" size={15} />Exibindo os últimos dados carregados. {error} <button type="button" onClick={onRetry} className="cursor-pointer font-semibold underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30">Atualizar</button></p>
      ) : null}
      {capabilityUnavailable ? <p role="status" className="text-sm text-text-muted">O cadastro segue disponível; alguns indicadores operacionais ainda não estão ativados.</p> : null}

      <div className="grid items-start gap-5 xl:grid-cols-2">
        <section aria-labelledby="atendimento-pedidos-title" className="min-w-0 rounded-card border border-border-default bg-surface-card shadow-[var(--elevation-1)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-default px-4 py-4 sm:px-5">
            <div className="min-w-0">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">Clientes recentes</p>
              <h2 id="atendimento-pedidos-title" className="mt-1 text-lg font-semibold tracking-tight text-text-primary">Atendimento e pedidos</h2>
            </div>
            <button type="button" onClick={onViewClientes} className="inline-flex min-h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-control px-2.5 text-sm font-semibold text-accent-soft-fg transition hover:bg-accent-soft-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30">Ver todos <ArrowRight aria-hidden="true" size={15} /></button>
          </div>
          {clientesRecentes.length === 0 ? (
            <div className="px-5 py-10 text-center"><UsersRound aria-hidden="true" className="mx-auto text-text-faint" size={24} /><p className="mt-3 text-sm font-semibold text-text-primary">{loading ? 'Carregando clientes…' : 'Nenhum cliente para exibir'}</p><p className="mt-1 text-sm text-text-muted">{error ? 'A lista aparecerá assim que a conexão for restabelecida.' : 'Os clientes cadastrados aparecerão nesta área.'}</p></div>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[580px] text-left text-sm">
                  <thead><tr className="border-b border-border-subtle font-sans text-[10px] uppercase tracking-[0.12em] text-text-faint"><th scope="col" className="px-4 py-3 font-semibold">Cliente</th><th scope="col" className="px-3 py-3 font-semibold">Local</th><th scope="col" className="px-3 py-3 font-semibold">Veículo</th><th scope="col" className="px-3 py-3 font-semibold">Status</th><th scope="col" className="px-3 py-3 text-right font-semibold">Ação</th></tr></thead>
                  <tbody className="divide-y divide-border-subtle">
                    {clientesRecentes.map(({ item, entrada }) => {
                      const situacao = situacoesPorCliente.get(item.id)!;
                      const pedido = entrada.pedidos.find((registro) => !['vendida', 'nao_encontrada', 'cliente_desistiu', 'cancelada', 'atendida'].includes(registro.status));
                      const local = [item.cidade, item.estado].filter(Boolean).join(' / ') || 'Local não informado';
                      const tone = pedido ? 'border-accent/20 text-accent-soft-fg' : tonsStatus[situacao.nivel];
                      return (
                        <tr key={item.id} className="group transition-colors hover:bg-surface-inset/70">
                          <td className="max-w-[230px] px-4 py-3"><div className="flex min-w-0 items-center gap-2.5"><span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-control border border-border-subtle bg-surface-inset text-[10px] font-bold text-text-secondary">{iniciais(item.nome)}</span><span className="min-w-0"><button type="button" title={item.nome} onClick={() => onSelectCliente(item.id)} className="line-clamp-2 max-w-full cursor-pointer whitespace-normal break-words text-left text-[13px] font-semibold text-text-primary hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30">{item.nome}</button><span className="mt-0.5 block truncate text-[11px] text-text-muted">{item.telefone || 'Sem telefone cadastrado'}</span></span></div></td>
                          <td className="max-w-[170px] px-3 py-3.5"><span className="block whitespace-normal break-words text-text-secondary">{local}</span></td>
                          <td className="max-w-[160px] px-3 py-3.5"><span className="block whitespace-normal break-words text-text-secondary">{nomeVeiculo(item)}</span></td>
                          <td className="px-3 py-3.5"><Tooltip side="top" wrapperClassName="inline-flex" className="!border-slate-200 !bg-white !text-slate-900 !shadow-lg !backdrop-blur-none" content={pedido ? <span><strong className="block">{pedido.descricao || 'Pedido de peça'}</strong><span className="block text-slate-600">{pedidoStatusCopy[pedido.status]} · {tempoDecorrido(pedido.criadoEm)}</span></span> : null}><span className={`inline-flex max-w-[150px] items-center gap-1.5 truncate whitespace-nowrap rounded-full border bg-surface-card px-2 py-1 text-[10px] font-semibold ${tone}`}><span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current" />{pedido ? 'Com pedido' : situacao.rotulo}</span></Tooltip></td>
                          <td className="px-3 py-3 text-right"><button type="button" aria-label={`Abrir contato de ${item.nome}`} title="Contato" onClick={() => onOpenContato(item)} disabled={!item.telefone && !item.instagram_usuario} className="ml-auto grid size-8 cursor-pointer place-items-center rounded-control border border-border-default bg-surface-card text-text-muted transition hover:border-accent/30 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-50"><MessageCircle aria-hidden="true" size={14} /></button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <ul aria-label="Atendimentos recentes" className="divide-y divide-border-subtle md:hidden">
                {clientesRecentes.map(({ item, entrada }) => {
                  const situacao = situacoesPorCliente.get(item.id)!;
                  const pedido = entrada.pedidos.find((registro) => !['vendida', 'nao_encontrada', 'cliente_desistiu', 'cancelada', 'atendida'].includes(registro.status));
                  const local = [item.cidade, item.estado].filter(Boolean).join(' / ') || 'Local não informado';
                  const tone = pedido ? 'border-accent/20 text-accent-soft-fg' : tonsStatus[situacao.nivel];
                  return <li key={item.id} className="flex items-center gap-3 px-4 py-3.5"><button type="button" onClick={() => onSelectCliente(item.id)} className="min-w-0 flex-1 cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"><span className="flex items-center gap-2"><span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-control border border-border-subtle bg-surface-inset text-[10px] font-bold text-text-secondary">{iniciais(item.nome)}</span><strong className="truncate text-sm font-semibold text-text-primary">{item.nome}</strong></span><span className="mt-1.5 block truncate text-xs text-text-muted">{local} · {nomeVeiculo(item)}</span><span className={`mt-2 inline-flex items-center gap-1.5 rounded-full border bg-surface-card px-2 py-0.5 text-[10px] font-semibold ${tone}`}><span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-current" />{pedido ? 'Com pedido' : situacao.rotulo}</span></button><button type="button" onClick={() => onOpenContato(item)} disabled={!item.telefone && !item.instagram_usuario} className="min-h-10 shrink-0 cursor-pointer rounded-control border border-border-default px-3 text-xs font-semibold text-text-secondary disabled:cursor-not-allowed disabled:opacity-50">Contato</button></li>;
                })}
              </ul>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle px-4 py-3 text-xs text-text-muted sm:px-5"><span>Mostrando {clientesRecentes.length} de {totalClientes} clientes carregados</span><button type="button" onClick={onRetry} className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-control px-2 text-xs font-semibold text-text-secondary transition hover:bg-surface-inset focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"><RefreshCw aria-hidden="true" size={13} />Atualizar lista</button></div>
            </>
          )}
        </section>

        <section aria-labelledby="agenda-hoje-title" className="min-w-0 rounded-card border border-border-default bg-surface-card shadow-[var(--elevation-1)]">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border-subtle px-4 py-4 sm:px-5">
            <div><p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">Pendências gerais da loja</p><h2 id="agenda-hoje-title" className="mt-1 text-sm font-semibold uppercase tracking-wide text-text-primary">Agenda · hoje e próximos 7 dias</h2></div>
            <span className="inline-flex min-h-7 items-center gap-1.5 whitespace-nowrap rounded-full border border-accent/15 bg-accent-soft-bg px-2.5 text-[11px] font-semibold text-accent-soft-fg"><CalendarClock aria-hidden="true" size={13} />{agendaLoading ? 'Atualizando agenda' : `${visitasNoPeriodo.length} ${visitasNoPeriodo.length === 1 ? 'visita no período' : 'visitas no período'}`}</span>
          </div>
          {agendaError ? <div role="status" className="px-4 py-5 sm:px-5"><p className="text-sm text-text-secondary">Não foi possível carregar a agenda agora.</p><button type="button" onClick={onRetryAgenda} className="mt-2 inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-control px-2 text-xs font-semibold text-accent-soft-fg hover:bg-accent-soft-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"><RefreshCw aria-hidden="true" size={13} />Tentar novamente</button></div> : agendaLoading ? <p role="status" className="px-4 py-5 text-sm text-text-muted sm:px-5">Carregando visitas…</p> : visitasDaAgenda.length === 0 ? <div className="px-4 py-8 text-center sm:px-5"><CalendarDays aria-hidden="true" className="mx-auto text-text-faint" size={21} /><p className="mt-2 text-sm font-semibold text-text-primary">Nenhuma visita pendente para hoje e próximos 7 dias</p><p className="mt-1 text-xs text-text-muted">A agenda mostra visitas atrasadas e as programadas nesse período.</p></div> : (
            <ul className="space-y-2.5 px-4 py-3 sm:px-5">{visitasDaAgenda.map((visita) => {
              const atrasada = Boolean(diaDaTarefa(visita.prazo) && diaDaTarefa(visita.prazo)! < hoje);
              const nomeVisita = visita.cliente?.nome || visita.titulo || 'Visita sem título';
              const clienteId = visita.cliente_id || visita.cliente?.id;
              const detalheVisita = visita.cliente?.nome ? visita.titulo || 'Visita' : 'Cliente não vinculado';
              return <li key={visita.id} className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 rounded-control border border-border-subtle bg-surface-card px-3 py-3 sm:flex-nowrap"><span className={`inline-flex min-h-7 shrink-0 rounded-control border px-2 py-1 font-mono font-semibold tabular-nums ${atrasada ? 'min-w-[72px] flex-col items-start justify-center text-[10px] leading-tight border-danger/15 bg-danger-bg text-danger' : 'min-w-[52px] items-center justify-center text-xs border-accent/15 bg-accent-soft-bg text-accent-soft-fg'}`}>{atrasada ? <><span>Atrasada</span><span>{formatarPrazoCompacto(visita.prazo)}</span></> : formatarPrazoVisita(visita.prazo, hoje)}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-text-primary">{nomeVisita}</p><p className="mt-0.5 truncate text-xs text-text-muted">{detalheVisita}{visita.atribuido?.nome_exibicao ? ` · ${visita.atribuido.nome_exibicao}` : ''}</p></div><span className={`inline-flex min-h-6 shrink-0 items-center gap-1 rounded-full px-2 text-[10px] font-semibold ${atrasada ? 'bg-danger-bg text-danger' : 'bg-warning-bg text-warning'}`}><span aria-hidden="true" className="size-1.5 rounded-full bg-current" />{atrasada ? 'Requer retorno' : 'Pendente'}</span>{clienteId && visita.cliente ? <button type="button" aria-label={`Abrir cliente ${nomeVisita}`} onClick={() => onSelectCliente(clienteId)} className="ml-auto grid size-8 shrink-0 cursor-pointer place-items-center rounded-control text-text-muted transition hover:bg-surface-inset hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"><UserRound aria-hidden="true" size={14} /></button> : null}</li>;
            })}</ul>
          )}
          {!agendaError && resumo && pendencias.some(({ label, valor }) => label !== 'Visitas vencidas em Tarefas' && typeof valor === 'number' && valor > 0) ? <div className="mx-4 border-t border-border-subtle py-3 sm:mx-5"><p className="mb-2 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-text-muted">Outros acompanhamentos</p><ul className="space-y-1.5">{pendencias.filter(({ label, valor }) => label !== 'Visitas vencidas em Tarefas' && typeof valor === 'number' && valor > 0).map(({ label, valor }) => <li key={label} className="flex items-center justify-between gap-3 text-xs"><span className="text-text-secondary">{label}</span><span className="font-semibold tabular-nums text-text-primary">{valor}</span></li>)}</ul></div> : null}
          {visitasAtrasadas.length > 0 && !agendaError ? <p className="mx-4 mt-1 rounded-control bg-danger-bg px-3 py-2 text-xs font-medium text-danger sm:mx-5">{visitasAtrasadas.length} {visitasAtrasadas.length === 1 ? 'visita atrasada' : 'visitas atrasadas'} · requer contato de reagendamento.</p> : null}
          <div className="border-t border-border-subtle px-4 py-2.5 text-right sm:px-5"><button type="button" onClick={onViewAgenda} className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-control px-2 text-xs font-semibold text-accent-soft-fg transition hover:bg-accent-soft-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30">Ver agenda completa <ArrowRight aria-hidden="true" size={14} /></button></div>
        </section>
      </div>
    </div>
  );
}
