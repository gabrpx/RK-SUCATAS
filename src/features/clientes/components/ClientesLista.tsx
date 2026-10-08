import { CalendarPlus, ChevronRight, ClipboardPlus, FilterX, MessageCircle, Search, SlidersHorizontal, UserRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { SPRING_MICRO } from '@/src/components/ui/motion';
import { calcularSituacaoCliente } from '../operacaoModel';
import { pedidoStatusCopy } from '../operacaoCopy';
import { calcularHistoricoCliente } from '../metricas';
import type { ClienteOperacaoEntrada, ClienteOperacaoListaItem, PedidoBuscaEstadoPersistido, PedidoBuscaOperacional, SituacaoCliente } from '../operacaoTypes';
import type { Venda } from '../../vendas/types';
import type { Orcamento } from '../../orcamentos/types';
import { Select } from '@/src/components/ui/Select';

type FiltroBooleano = 'cadastroIncompleto' | 'semPendencias';

export interface ClientesListaProps {
  itens: ClienteOperacaoListaItem[];
  initialSemPendencias?: boolean;
  loading?: boolean;
  loadingMore?: boolean;
  hasMore?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onLoadMore?: () => void;
  pedidoStatuses?: PedidoBuscaEstadoPersistido[] | null;
  pedidoStatusLabel?: string | null;
  onClearPedidoStatus?: () => void;
  vendas?: Venda[];
  orcamentos?: Orcamento[];
  onOpenCliente: (clienteId: string) => void;
  onRegistrarPedido?: (cliente: ClienteOperacaoListaItem) => void;
  onAgendarVisita?: (cliente: ClienteOperacaoListaItem) => void;
  /**
   * A tela pai decide como abrir links externos. Assim a listagem não abre
   * WhatsApp ou Instagram sozinha nem registra uma ação de atendimento.
   */
  onOpenContato?: (cliente: ClienteOperacaoListaItem) => void;
}

const ORIGENS: Record<string, string> = {
  whatsapp: 'WhatsApp',
  facebook: 'Facebook',
  mercado_livre: 'Mercado Livre',
  instagram: 'Instagram',
  indicacao: 'Indicação',
  balcao: 'Balcão',
  redes_sociais: 'Redes sociais',
  outro: 'Outro',
};

const PEDIDOS_ENCERRADOS = new Set(['vendida', 'nao_encontrada', 'cliente_desistiu', 'cancelada', 'atendida']);

function textoNormalizado(valor: string | null | undefined): string {
  return (valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function apenasDigitos(valor: string | null | undefined): string {
  return (valor ?? '').replace(/\D/g, '');
}

function stringDoRegistro(registro: unknown, campos: string[]): string | null {
  if (!registro || typeof registro !== 'object') return null;
  const objeto = registro as Record<string, unknown>;
  for (const campo of campos) {
    if (typeof objeto[campo] === 'string' && objeto[campo].trim()) return objeto[campo].trim();
  }
  return null;
}

function motosDoCliente(cliente: ClienteOperacaoListaItem): string[] {
  if (!Array.isArray(cliente.motos)) return [];
  return cliente.motos.flatMap((moto) => {
    const modeloTexto = stringDoRegistro(moto, ['modelo_texto', 'nome']);
    if (modeloTexto) return [{ nome: modeloTexto, principal: Boolean((moto as Record<string, unknown>)?.principal) }];
    if (moto && typeof moto === 'object') {
      const catalogo = (moto as Record<string, unknown>).modelo_moto;
      const nomeCatalogo = stringDoRegistro(catalogo, ['nome']);
      if (nomeCatalogo) return [{ nome: nomeCatalogo, principal: Boolean((moto as Record<string, unknown>).principal) }];
    }
    return [];
  }).sort((a, b) => Number(b.principal) - Number(a.principal) || a.nome.localeCompare(b.nome, 'pt-BR')).map(({ nome }) => nome);
}

function pedidosDoCliente(cliente: ClienteOperacaoListaItem): PedidoBuscaOperacional[] {
  if (!Array.isArray(cliente.pedidos)) return [];
  return cliente.pedidos.flatMap((pedido) => {
    if (!pedido || typeof pedido !== 'object') return [];
    const registro = pedido as Record<string, unknown>;
    if (typeof registro.id !== 'string' || typeof registro.status !== 'string' || typeof registro.criado_em !== 'string') return [];
    return [{
      id: registro.id,
      status: registro.status as PedidoBuscaOperacional['status'],
      criadoEm: registro.criado_em,
      descricao: typeof registro.descricao === 'string' ? registro.descricao : null,
      prometidoPara: typeof registro.prometido_para === 'string' ? registro.prometido_para : null,
      proximaAcaoEm: typeof registro.proxima_acao_em === 'string' ? registro.proxima_acao_em : null,
    }];
  });
}

function situacaoDoCliente(cliente: ClienteOperacaoListaItem): SituacaoCliente {
  const entrada: ClienteOperacaoEntrada = { id: cliente.id, pedidos: pedidosDoCliente(cliente), visitas: [], reservas: [] };
  return calcularSituacaoCliente(entrada, new Date());
}

function cadastroIncompleto(cliente: ClienteOperacaoListaItem): boolean {
  const semContato = !cliente.telefone && !cliente.instagram_usuario;
  return semContato || !cliente.cidade || !cliente.estado || !cliente.origem || motosDoCliente(cliente).length === 0;
}

function semPendencias(cliente: ClienteOperacaoListaItem): boolean {
  return pedidosDoCliente(cliente).every((pedido) => PEDIDOS_ENCERRADOS.has(pedido.status));
}

function proximaAcao(situacao: SituacaoCliente): string {
  if (!situacao.proximaAcaoEm) return 'Sem prazo combinado';
  const data = new Date(situacao.proximaAcaoEm);
  if (Number.isNaN(data.getTime())) return 'Sem prazo combinado';
  return data.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function dataDaUltimaCompra(data: string | null): string {
  if (!data) return 'Ainda sem compras';
  const valor = new Date(`${data}T00:00:00`);
  return Number.isNaN(valor.getTime()) ? 'Ainda sem compras' : valor.toLocaleDateString('pt-BR');
}

function valorTotalComprado(valor: number, quantidade: number): string {
  if (quantidade === 0) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
}

function tomSituacao(situacao: SituacaoCliente): string {
  if (situacao.nivel === 'critico') return 'bg-danger-bg text-danger';
  if (situacao.nivel === 'atencao') return 'bg-warning-bg text-warning';
  if (situacao.nivel === 'informativo') return 'bg-accent-soft-bg text-accent-soft-fg';
  return 'bg-surface-inset text-text-muted';
}

function contatoDoCliente(cliente: ClienteOperacaoListaItem): string {
  if (cliente.preferencia_contato === 'instagram' && cliente.instagram_usuario) return `@${cliente.instagram_usuario.replace(/^@/, '')}`;
  if (cliente.telefone) return cliente.telefone;
  if (cliente.instagram_usuario) return `@${cliente.instagram_usuario.replace(/^@/, '')}`;
  return 'Sem contato';
}

function AcaoRapida({ label, children, onClick, disabled = false, compact = false }: { label: string; children: React.ReactNode; onClick: () => void; disabled?: boolean; compact?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex min-h-11 min-w-0 cursor-pointer items-center justify-center gap-1 rounded-control border border-border-default bg-surface-card px-1.5 text-[10px] font-semibold text-text-secondary transition-colors hover:border-accent/35 hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-9 sm:gap-1.5 sm:px-2.5 sm:text-xs ${compact ? 'md:size-9 md:min-w-9 md:px-0' : ''}`}
    >
      {children}
    </button>
  );
}

export function ClientesLista({ itens, initialSemPendencias = false, loading = false, loadingMore = false, hasMore = false, error = null, onRetry, onLoadMore, pedidoStatuses = null, pedidoStatusLabel = null, onClearPedidoStatus, vendas = [], orcamentos = [], onOpenCliente, onRegistrarPedido, onAgendarVisita, onOpenContato }: ClientesListaProps) {
  const reduceMotion = useReducedMotion();
  const [busca, setBusca] = useState('');
  const [origem, setOrigem] = useState('');
  const [cidade, setCidade] = useState('');
  const [filtrosMobileAbertos, setFiltrosMobileAbertos] = useState(() => Boolean(initialSemPendencias) || (typeof window !== 'undefined' && window.matchMedia?.('(min-width: 1024px)').matches === true));
  const [filtrosBooleanos, setFiltrosBooleanos] = useState<Set<FiltroBooleano>>(
    () => new Set(initialSemPendencias ? ['semPendencias'] : [])
  );

  useEffect(() => {
    if (!initialSemPendencias) return;
    setFiltrosBooleanos((atual) => atual.has('semPendencias') ? atual : new Set([...atual, 'semPendencias']));
  }, [initialSemPendencias]);

  useEffect(() => {
    const media = window.matchMedia?.('(min-width: 1024px)');
    if (!media) return;
    const atualizarVisibilidade = () => setFiltrosMobileAbertos(media.matches);
    media.addEventListener('change', atualizarVisibilidade);
    return () => media.removeEventListener('change', atualizarVisibilidade);
  }, []);

  const cidades = useMemo(() => [...new Set(itens.flatMap((cliente) => cliente.cidade ? [cliente.cidade] : []))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [itens]);
  const origens = useMemo(() => [...new Set(itens.flatMap((cliente) => cliente.origem ? [cliente.origem] : []))].sort((a, b) => (ORIGENS[a] ?? a).localeCompare(ORIGENS[b] ?? b, 'pt-BR')), [itens]);

  const clientesFiltrados = useMemo(() => {
    const buscaTexto = textoNormalizado(busca.replace(/^@+/, ''));
    const buscaTelefone = apenasDigitos(busca);
    return itens.filter((cliente) => {
      const textoDaLinha = [cliente.nome, cliente.instagram_usuario, cliente.cidade, cliente.estado, ...motosDoCliente(cliente)].map(textoNormalizado).join(' ');
      if (buscaTexto && !textoDaLinha.includes(buscaTexto) && (!buscaTelefone || !apenasDigitos(cliente.telefone).includes(buscaTelefone))) return false;
      if (origem && cliente.origem !== origem) return false;
      if (cidade && cliente.cidade !== cidade) return false;
      if (pedidoStatuses?.length && !pedidosDoCliente(cliente).some((pedido) => pedidoStatuses.includes(pedido.status))) return false;
      if (filtrosBooleanos.has('cadastroIncompleto') && !cadastroIncompleto(cliente)) return false;
      if (filtrosBooleanos.has('semPendencias') && !semPendencias(cliente)) return false;
      return true;
    });
  }, [busca, cidade, filtrosBooleanos, itens, origem, pedidoStatuses]);

  const chips = [
    busca ? { id: 'busca', label: `Busca: ${busca}`, onRemove: () => setBusca('') } : null,
    origem ? { id: 'origem', label: `Origem: ${ORIGENS[origem] ?? origem}`, onRemove: () => setOrigem('') } : null,
    cidade ? { id: 'cidade', label: `Cidade: ${cidade}`, onRemove: () => setCidade('') } : null,
    pedidoStatusLabel ? { id: 'pedido-status', label: pedidoStatusLabel, onRemove: () => onClearPedidoStatus?.() } : null,
    filtrosBooleanos.has('cadastroIncompleto') ? { id: 'incompleto', label: 'Cadastro incompleto', onRemove: () => setFiltrosBooleanos((atual) => { const proximo = new Set(atual); proximo.delete('cadastroIncompleto'); return proximo; }) } : null,
    filtrosBooleanos.has('semPendencias') ? { id: 'sem-pendencias', label: 'Sem pendências', onRemove: () => setFiltrosBooleanos((atual) => { const proximo = new Set(atual); proximo.delete('semPendencias'); return proximo; }) } : null,
  ].filter(Boolean) as Array<{ id: string; label: string; onRemove: () => void }>;
  const quantidadeFiltrosAtivos = Number(Boolean(origem)) + Number(Boolean(cidade)) + filtrosBooleanos.size + Number(Boolean(pedidoStatuses?.length));

  const limparFiltros = () => {
    setBusca('');
    setOrigem('');
    setCidade('');
    setFiltrosBooleanos(new Set());
    onClearPedidoStatus?.();
  };

  const alternarFiltro = (filtro: FiltroBooleano) => setFiltrosBooleanos((atual) => {
    const proximo = new Set(atual);
    if (proximo.has(filtro)) proximo.delete(filtro);
    else proximo.add(filtro);
    return proximo;
  });

  return (
    <section aria-labelledby="todos-clientes-title" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">Cadastro e atendimento</p>
          <h2 id="todos-clientes-title" className="mt-1 text-lg font-semibold tracking-tight text-text-primary">Clientes</h2>
        </div>
        <p aria-live="polite" className="text-sm text-text-muted">{loading ? 'Carregando clientes…' : `${clientesFiltrados.length} ${clientesFiltrados.length === 1 ? 'cliente encontrado' : 'clientes encontrados'}`}</p>
      </div>

      <div className="rounded-card border border-border-default bg-surface-card p-3 shadow-[var(--elevation-1)] sm:p-4">
        <div className="flex flex-col gap-2 lg:grid lg:grid-cols-[minmax(16rem,1fr)_10rem_12rem_auto_auto]">
          <label className="relative block">
            <span className="sr-only">Buscar cliente</span>
            <Search aria-hidden="true" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-faint" />
            <input type="search" value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar nome, contato, moto ou cidade" aria-label="Buscar cliente" className="min-h-11 w-full rounded-control border border-border-default bg-surface-base py-2 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20" />
          </label>
          <button type="button" aria-expanded={filtrosMobileAbertos} aria-controls="clientes-filtros-avancados" onClick={() => setFiltrosMobileAbertos((abertos) => !abertos)} className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-control border border-border-default bg-surface-base px-3 text-sm font-semibold text-text-secondary transition-colors hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 lg:hidden"><SlidersHorizontal aria-hidden="true" size={15} />Filtros{quantidadeFiltrosAtivos > 0 ? <span className="rounded-full bg-accent-soft-bg px-1.5 py-0.5 text-xs text-accent-soft-fg">{quantidadeFiltrosAtivos}</span> : null}</button>
          <motion.div id="clientes-filtros-avancados" data-testid="clientes-filtros" aria-hidden={!filtrosMobileAbertos} inert={!filtrosMobileAbertos} layout animate={{ height: filtrosMobileAbertos ? 'auto' : 0, opacity: filtrosMobileAbertos ? 1 : 0 }} transition={reduceMotion ? { duration: 0 } : SPRING_MICRO} className={`grid grid-cols-2 gap-2 ${filtrosMobileAbertos ? 'overflow-visible' : 'overflow-hidden'} lg:!h-auto lg:!overflow-visible lg:!opacity-100 lg:contents`}>
            <Select value={origem} onChange={setOrigem} ariaLabel="Filtrar por origem" options={[{ value: '', label: 'Todas as origens' }, ...origens.map((valor) => ({ value: valor, label: ORIGENS[valor] ?? valor }))]} size="mobile" />
            <Select value={cidade} onChange={setCidade} ariaLabel="Filtrar por cidade" options={[{ value: '', label: 'Todas as cidades' }, ...cidades.map((valor) => ({ value: valor, label: valor }))]} size="mobile" />
            <button type="button" aria-pressed={filtrosBooleanos.has('cadastroIncompleto')} onClick={() => alternarFiltro('cadastroIncompleto')} className="min-h-10 cursor-pointer rounded-control border border-border-default bg-surface-base px-2 text-xs font-semibold text-text-secondary transition-colors hover:bg-surface-raised aria-pressed:border-warning/40 aria-pressed:bg-warning-bg aria-pressed:text-warning focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 sm:px-3 sm:text-sm">Cadastro incompleto</button>
            <button type="button" aria-pressed={filtrosBooleanos.has('semPendencias')} onClick={() => alternarFiltro('semPendencias')} className="min-h-10 cursor-pointer rounded-control border border-border-default bg-surface-base px-2 text-xs font-semibold text-text-secondary transition-colors hover:bg-surface-raised aria-pressed:border-accent/40 aria-pressed:bg-accent-soft-bg aria-pressed:text-accent-soft-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 sm:px-3 sm:text-sm">Sem pendências</button>
          </motion.div>
        </div>
        {chips.length > 0 ? <div className="mt-3 flex flex-wrap items-center gap-2" aria-label="Filtros ativos">{chips.map((chip) => <span key={chip.id} className="inline-flex items-center gap-1 rounded-badge bg-surface-inset py-1 pl-2 pr-1 text-xs text-text-secondary">{chip.label}<button type="button" onClick={chip.onRemove} aria-label={`Remover filtro ${chip.label}`} className="grid size-5 cursor-pointer place-items-center rounded-full text-text-muted transition-colors hover:bg-surface-card hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30">×</button></span>)}<button type="button" onClick={limparFiltros} className="inline-flex min-h-8 cursor-pointer items-center gap-1 rounded-control px-2 text-xs font-semibold text-text-muted transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"><FilterX aria-hidden="true" size={14} />Limpar filtros</button></div> : null}
      </div>

      {error ? <div role="alert" className="flex flex-col gap-3 rounded-card border border-danger/30 bg-danger-bg p-4 text-sm text-danger sm:flex-row sm:items-center sm:justify-between"><span>{error}</span>{onRetry ? <button type="button" onClick={onRetry} className="inline-flex min-h-10 cursor-pointer items-center justify-center rounded-control border border-danger/30 bg-surface-card px-3 font-semibold text-danger transition-colors hover:bg-danger-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/30">Tentar novamente</button> : null}</div> : null}

      {loading ? (
        <div role="status" aria-label="Carregando clientes" className="rounded-card border border-border-default bg-surface-card p-5 text-sm text-text-muted">Carregando clientes…</div>
      ) : error && clientesFiltrados.length === 0 ? null : clientesFiltrados.length === 0 ? (
        <div className="rounded-card border border-dashed border-border-default bg-surface-card px-5 py-12 text-center"><UserRound aria-hidden="true" className="mx-auto text-text-faint" size={24} /><p className="mt-3 text-sm font-semibold text-text-primary">Nenhum cliente encontrado</p><p className="mt-1 text-sm text-text-muted">Ajuste ou limpe os filtros para ver outros cadastros.</p></div>
      ) : (
        <div className="overflow-hidden rounded-card border border-border-default bg-surface-card shadow-[var(--elevation-1)]">
          <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[1240px] text-sm"><thead className="bg-surface-inset/70"><tr className="border-b border-border-default text-left"><th scope="col" className="w-[14%] px-4 py-3 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted">Cliente & contato</th><th scope="col" className="w-[8%] px-3 py-3 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted">Origem</th><th scope="col" className="w-[10%] px-3 py-3 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted">Região / pátio</th><th scope="col" className="w-[15%] px-3 py-3 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted">Veículos & demanda</th><th scope="col" className="w-[17%] px-3 py-3 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted">Última interação / pedido</th><th scope="col" className="w-[11%] px-3 py-3 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted">Status</th><th scope="col" className="w-[12%] px-3 py-3 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted">Histórico / total</th><th scope="col" className="w-[13%] px-4 py-3 text-right font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-text-muted">Ações</th></tr></thead><tbody>{clientesFiltrados.map((cliente) => <LinhaDesktop key={cliente.id} cliente={cliente} vendas={vendas} orcamentos={orcamentos} onOpenCliente={onOpenCliente} onRegistrarPedido={onRegistrarPedido} onAgendarVisita={onAgendarVisita} onOpenContato={onOpenContato} />)}</tbody></table></div>
          <div className="divide-y divide-border-subtle md:hidden">{clientesFiltrados.map((cliente) => <CartaoMobile key={cliente.id} cliente={cliente} vendas={vendas} orcamentos={orcamentos} onOpenCliente={onOpenCliente} onRegistrarPedido={onRegistrarPedido} onAgendarVisita={onAgendarVisita} onOpenContato={onOpenContato} />)}</div>
        </div>
      )}

      {hasMore && !loading ? <div className="flex justify-center"><button type="button" onClick={onLoadMore} disabled={!onLoadMore || loadingMore} className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-control border border-border-default bg-surface-card px-4 text-sm font-semibold text-text-secondary transition-colors hover:bg-surface-inset focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-60">{loadingMore ? 'Carregando mais clientes…' : 'Carregar mais clientes'}</button></div> : null}
    </section>
  );
}

type LinhaProps = Pick<ClientesListaProps, 'onOpenCliente' | 'onRegistrarPedido' | 'onAgendarVisita' | 'onOpenContato' | 'vendas' | 'orcamentos'> & { cliente: ClienteOperacaoListaItem };

function AcoesRapidas({ cliente, onRegistrarPedido, onAgendarVisita, onOpenContato, compact = false }: Omit<LinhaProps, 'onOpenCliente'> & { compact?: boolean }) {
  const canalDisponivel = Boolean(cliente.telefone || cliente.instagram_usuario);
  const pedidoDisponivel = Boolean(onRegistrarPedido);
  const visitaDisponivel = Boolean(onAgendarVisita);
  return <div data-testid="cliente-acoes-rapidas" className="grid grid-cols-3 gap-1.5 sm:flex sm:flex-wrap sm:items-center sm:justify-end"><AcaoRapida compact={compact} label={`Abrir contato de ${cliente.nome}`} disabled={!canalDisponivel || !onOpenContato} onClick={() => onOpenContato?.(cliente)}><MessageCircle aria-hidden="true" size={14} /><span className={compact ? 'md:sr-only' : undefined}>Contato</span></AcaoRapida><AcaoRapida compact={compact} label={pedidoDisponivel ? `Registrar pedido para ${cliente.nome}` : 'Você não tem permissão para registrar pedidos'} disabled={!pedidoDisponivel} onClick={() => onRegistrarPedido?.(cliente)}><ClipboardPlus aria-hidden="true" size={14} /><span className={compact ? 'md:sr-only' : undefined}>Pedido</span></AcaoRapida><AcaoRapida compact={compact} label={visitaDisponivel ? `Agendar visita para ${cliente.nome}` : 'Agenda de visitas ainda não está disponível'} disabled={!visitaDisponivel} onClick={() => onAgendarVisita?.(cliente)}><CalendarPlus aria-hidden="true" size={14} /><span className={compact ? 'md:sr-only' : undefined}>Visita</span></AcaoRapida></div>;
}

function LinhaDesktop({ cliente, vendas = [], orcamentos = [], onOpenCliente, onRegistrarPedido, onAgendarVisita, onOpenContato }: LinhaProps) {
  const motos = motosDoCliente(cliente);
  const situacao = situacaoDoCliente(cliente);
  const historico = calcularHistoricoCliente(cliente.id, vendas, orcamentos);
  const pedidosAtivos = pedidosDoCliente(cliente).filter((pedido) => !PEDIDOS_ENCERRADOS.has(pedido.status));
  const pedidoMaisRecente = [...pedidosAtivos].sort((a, b) => Date.parse(b.criadoEm) - Date.parse(a.criadoEm))[0];
  const contato = contatoDoCliente(cliente);
  const origem = cliente.origem ? (ORIGENS[cliente.origem] ?? cliente.origem) : 'Não informada';
  const motosVisiveis = motos.slice(0, 2);
  return (
    <tr className="border-b border-border-subtle align-top transition-colors hover:bg-surface-raised last:border-b-0">
      <td className="px-4 py-3.5"><button type="button" onClick={() => onOpenCliente(cliente.id)} aria-label={`Abrir cadastro de ${cliente.nome}`} className="group cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"><strong className="block whitespace-normal text-sm font-semibold text-text-primary group-hover:text-accent">{cliente.nome}</strong><span className="mt-1 block break-words text-xs text-text-muted">{contato}</span></button></td>
      <td className="px-3 py-3.5"><span className="inline-flex rounded-badge bg-surface-inset px-2 py-1 text-xs font-medium text-text-secondary">{origem}</span></td>
      <td className="px-3 py-3.5"><span className="inline-flex max-w-full whitespace-normal rounded-badge border border-border-default bg-surface-card px-2 py-1 text-xs leading-4 text-text-secondary">{cliente.cidade ? `${cliente.cidade}${cliente.estado ? ` / ${cliente.estado}` : ''}` : 'Região não informada'}</span></td>
      <td className="px-3 py-3.5"><div className="flex flex-wrap gap-1.5">{motosVisiveis.length ? motosVisiveis.map((moto) => <span key={moto} className="rounded-badge bg-accent-soft-bg px-2 py-1 text-xs leading-4 text-accent-soft-fg">{moto}</span>) : <span className="text-xs text-text-muted">Moto não informada</span>}{motos.length > 2 ? <span className="rounded-badge bg-surface-inset px-2 py-1 text-xs leading-4 text-text-muted">+{motos.length - 2}</span> : null}</div>{pedidoMaisRecente ? <span className="mt-2 block text-xs font-medium text-positive">Com pedido</span> : <span className="mt-2 block text-xs text-text-muted">Sem pedido ativo</span>}</td>
      <td className="px-3 py-3.5">{pedidoMaisRecente ? <div className="space-y-1"><p className="font-medium leading-5 text-text-primary">{pedidoMaisRecente.descricao || 'Peça em busca'}</p><p className="text-xs leading-4 text-text-muted">{pedidoStatusCopy[pedidoMaisRecente.status]} · {dataDaUltimaCompra(pedidoMaisRecente.criadoEm.slice(0, 10))}</p></div> : <div className="space-y-1"><p className="font-medium text-text-secondary">{historico.ultimaCompraEm ? 'Última compra' : 'Sem interação recente'}</p><p className="text-xs text-text-muted">{dataDaUltimaCompra(historico.ultimaCompraEm)}</p></div>}</td>
      <td className="px-3 py-3.5"><span className={`inline-flex whitespace-normal rounded-badge px-2 py-1 text-xs font-medium ${tomSituacao(situacao)}`}>{situacao.rotulo}</span>{situacao.proximaAcaoEm ? <span className="mt-1.5 block text-xs text-text-muted">Próxima ação: {proximaAcao(situacao)}</span> : null}</td>
      <td className="px-3 py-3.5"><strong className="block whitespace-nowrap text-sm font-semibold tabular-nums text-text-primary">{valorTotalComprado(historico.totalGasto, historico.quantidadeCompras)}</strong><span className="mt-1 block text-xs text-text-muted">{historico.quantidadeCompras} {historico.quantidadeCompras === 1 ? 'compra' : 'compras'}</span></td>
      <td className="px-4 py-3.5"><AcoesRapidas compact cliente={cliente} onRegistrarPedido={onRegistrarPedido} onAgendarVisita={onAgendarVisita} onOpenContato={onOpenContato} /></td>
    </tr>
  );
}

function CartaoMobile({ cliente, vendas = [], orcamentos = [], onOpenCliente, onRegistrarPedido, onAgendarVisita, onOpenContato }: LinhaProps) {
  const motos = motosDoCliente(cliente);
  const situacao = situacaoDoCliente(cliente);
  const historico = calcularHistoricoCliente(cliente.id, vendas, orcamentos);
  return <article className="space-y-2 px-3 py-3 sm:px-4 sm:py-4"><div className="flex items-start justify-between gap-3"><button type="button" onClick={() => onOpenCliente(cliente.id)} aria-label={`Abrir cadastro de ${cliente.nome}`} className="min-w-0 cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"><strong className="block truncate text-sm text-text-primary">{cliente.nome}</strong><span className="mt-0.5 block text-xs text-text-muted">{contatoDoCliente(cliente)}<span aria-hidden="true"> · </span>{cliente.cidade ?? 'Cidade não informada'}{cliente.estado ? `/${cliente.estado}` : ''}</span></button><ChevronRight aria-hidden="true" className="mt-0.5 shrink-0 text-text-faint" size={18} /></div><div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs"><span className="shrink-0 text-text-muted">Moto</span><strong className="min-w-0 flex-1 truncate font-medium text-text-secondary">{motos[0] ?? 'Não informada'}</strong><span className={`inline-flex max-w-full shrink-0 truncate rounded-badge px-2 py-1 font-medium ${tomSituacao(situacao)}`}>{situacao.rotulo}</span></div><p className="text-xs text-text-secondary"><span className="text-text-muted">Compras: </span>{dataDaUltimaCompra(historico.ultimaCompraEm)} · {valorTotalComprado(historico.totalGasto, historico.quantidadeCompras)}</p><p className="text-xs text-text-secondary"><span className="text-text-muted">Próxima ação: </span>{proximaAcao(situacao)}</p><AcoesRapidas cliente={cliente} onRegistrarPedido={onRegistrarPedido} onAgendarVisita={onAgendarVisita} onOpenContato={onOpenContato} /></article>;
}
