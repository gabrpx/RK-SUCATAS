import * as React from 'react';
import { ArrowLeft, Check, Loader2, Search, UserRoundCheck } from 'lucide-react';
import { OperationalDrawer } from '../../../components/ui/OperationalDrawer';
import { Select } from '../../../components/ui/Select';
import { clientesApi } from '../api';
import type { ClienteDuplicidade, ClienteOperacaoListaItem, ClienteOperacionalInput } from '../operacaoTypes';
import {
  ClienteFormFields,
  EMPTY_CLIENTE_FORM_VALUES,
  toClienteOperacionalInput,
  validarClienteForm,
  type ClienteFormErrors,
  type ClienteFormValues,
} from './ClienteFormDrawer';

interface OpcaoCadastro {
  id: string;
  nome: string;
}

export interface RegistrarPedidoDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  responsaveis: OpcaoCadastro[];
  categorias: OpcaoCadastro[];
  modelos: OpcaoCadastro[];
  clientes?: ClienteOperacaoListaItem[];
  hasMoreClientes?: boolean;
  loadingMoreClientes?: boolean;
  onLoadMoreClientes?: () => void;
  initialCliente?: ClienteOperacionalInput | null;
  onSaved: (resultado: { clienteId: string; pedidoId: string }) => void | Promise<void>;
  onRefresh?: () => void | Promise<void>;
}

interface PedidoFormValues {
  descricao: string;
  modelo_moto_id: string;
  moto_modelo_texto: string;
  categoria_id: string;
  ano_compatibilidade: string;
  observacoes: string;
  responsavel_id: string;
  tem_data_combinada: boolean;
  prometido_para: string;
}

const EMPTY_PEDIDO: PedidoFormValues = {
  descricao: '',
  modelo_moto_id: '',
  moto_modelo_texto: '',
  categoria_id: '',
  ano_compatibilidade: '',
  observacoes: '',
  responsavel_id: '',
  tem_data_combinada: false,
  prometido_para: '',
};

const primaryButton = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-control bg-accent px-4 text-sm font-semibold text-white transition hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-50';
const secondaryButton = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-control border border-border-default bg-surface-card px-4 text-sm font-semibold text-text-primary transition hover:bg-surface-inset focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-50';
const fieldClass = 'min-h-11 w-full rounded-control border border-border-default bg-surface-card px-3 text-sm text-text-primary outline-none transition placeholder:text-text-subtle focus:border-accent focus:ring-2 focus:ring-accent/15 disabled:cursor-not-allowed disabled:opacity-60';

function novaChaveIdempotencia(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID();
  return `pedido-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function valoresIniciais(cliente?: ClienteOperacionalInput | null): ClienteFormValues {
  if (!cliente) return { ...EMPTY_CLIENTE_FORM_VALUES };
  return {
    ...EMPTY_CLIENTE_FORM_VALUES,
    nome: cliente.nome,
    telefone: cliente.telefone ?? '',
    instagram_usuario: cliente.instagram_usuario ?? '',
    preferencia_contato: cliente.preferencia_contato,
    origem: cliente.origem,
    cidade: cliente.cidade,
    estado: cliente.estado,
    cep: cliente.cep ?? '',
    logradouro: cliente.logradouro ?? '',
    numero: cliente.numero ?? '',
    complemento: cliente.complemento ?? '',
    bairro: cliente.bairro ?? '',
  };
}

function primeiroErro(erros: ClienteFormErrors): string {
  return [erros.nome, erros.telefone, erros.instagram_usuario, erros.origem, erros.estado, erros.cidade]
    .find(Boolean) ?? 'Revise os campos destacados.';
}

function clienteDaLista(cliente: ClienteOperacaoListaItem): ClienteOperacionalInput {
  const origem = ['whatsapp', 'facebook', 'mercado_livre', 'instagram', 'indicacao', 'balcao'].includes(cliente.origem ?? '')
    ? cliente.origem as ClienteOperacionalInput['origem']
    : 'balcao';
  return {
    id: cliente.id,
    nome: cliente.nome,
    telefone: cliente.telefone,
    instagram_usuario: cliente.instagram_usuario,
    preferencia_contato: cliente.preferencia_contato === 'instagram' ? 'instagram' : 'whatsapp',
    origem,
    cidade: cliente.cidade ?? '',
    estado: cliente.estado ?? '',
  };
}

export function RegistrarPedidoDrawer({
  open,
  onOpenChange,
  responsaveis,
  categorias,
  modelos,
  clientes = [],
  hasMoreClientes = false,
  loadingMoreClientes = false,
  onLoadMoreClientes,
  initialCliente,
  onSaved,
  onRefresh,
}: RegistrarPedidoDrawerProps) {
  const [etapa, setEtapa] = React.useState<0 | 1 | 2>(() => initialCliente?.id ? 1 : 0);
  const [modoCliente, setModoCliente] = React.useState<'existente' | 'novo' | null>(() => initialCliente?.id ? 'existente' : null);
  const [clienteExistenteId, setClienteExistenteId] = React.useState('');
  const [buscaClienteExistente, setBuscaClienteExistente] = React.useState('');
  const [clienteForm, setClienteForm] = React.useState<ClienteFormValues>(() => valoresIniciais(initialCliente));
  const [clienteSelecionado, setClienteSelecionado] = React.useState<ClienteDuplicidade | null>(null);
  const [duplicidades, setDuplicidades] = React.useState<ClienteDuplicidade[]>([]);
  const [confirmarSeparado, setConfirmarSeparado] = React.useState(false);
  const [pedido, setPedido] = React.useState<PedidoFormValues>(EMPTY_PEDIDO);
  const [errosCliente, setErrosCliente] = React.useState<ClienteFormErrors>({});
  const [erroGeral, setErroGeral] = React.useState('');
  const [carregandoDuplicidades, setCarregandoDuplicidades] = React.useState(false);
  const [salvando, setSalvando] = React.useState(false);
  const [pedidoErroCampo, setPedidoErroCampo] = React.useState<'descricao' | 'moto' | 'responsavel' | 'data' | null>(null);
  const chaveIdempotencia = React.useRef(novaChaveIdempotencia());
  const verificandoRef = React.useRef(false);
  const salvandoRef = React.useRef(false);
  const erroId = React.useId();
  const nomeClienteRef = React.useRef<HTMLElement | null>(null);
  const telefoneClienteRef = React.useRef<HTMLElement | null>(null);
  const instagramClienteRef = React.useRef<HTMLElement | null>(null);
  const origemClienteRef = React.useRef<HTMLElement | null>(null);
  const estadoClienteRef = React.useRef<HTMLElement | null>(null);
  const cidadeClienteRef = React.useRef<HTMLElement | null>(null);
  const descricaoRef = React.useRef<HTMLInputElement>(null);
  const motoTextoRef = React.useRef<HTMLInputElement>(null);
  const responsavelRef = React.useRef<HTMLButtonElement>(null);
  const dataRef = React.useRef<HTMLInputElement>(null);

  const limparFluxo = React.useCallback(() => {
    setEtapa(initialCliente?.id ? 1 : 0);
    setModoCliente(initialCliente?.id ? 'existente' : null);
    setClienteExistenteId('');
    setBuscaClienteExistente('');
    setClienteForm(valoresIniciais(initialCliente));
    setClienteSelecionado(null);
    setDuplicidades([]);
    setConfirmarSeparado(false);
    setPedido(EMPTY_PEDIDO);
    setErrosCliente({});
    setErroGeral('');
    setCarregandoDuplicidades(false);
    setSalvando(false);
    setPedidoErroCampo(null);
    verificandoRef.current = false;
    salvandoRef.current = false;
    chaveIdempotencia.current = novaChaveIdempotencia();
  }, [initialCliente]);

  React.useEffect(() => {
    if (!open) limparFluxo();
  }, [limparFluxo, open]);

  const seguirParaPedido = React.useCallback(() => {
    setErroGeral('');
    setEtapa(2);
  }, []);

  const verificarCliente = async () => {
    if (verificandoRef.current) return;
    if (initialCliente?.id) {
      setErroGeral('');
      setDuplicidades([]);
      seguirParaPedido();
      return;
    }
    const clienteExistente = clientes.find((cliente) => cliente.id === clienteExistenteId);
    if (modoCliente === 'existente' && clienteExistente) {
      setClienteForm(valoresIniciais(clienteDaLista(clienteExistente)));
      setErroGeral('');
      seguirParaPedido();
      return;
    }
    if (modoCliente === 'existente') {
      setErroGeral('Selecione o cliente para continuar.');
      return;
    }
    const erros = validarClienteForm(clienteForm);
    setErrosCliente(erros);
    if (Object.keys(erros).length > 0) {
      setErroGeral(primeiroErro(erros));
      const refs: Array<[keyof ClienteFormErrors, React.RefObject<HTMLElement | null>]> = [
        ['nome', nomeClienteRef],
        ['telefone', telefoneClienteRef],
        ['instagram_usuario', instagramClienteRef],
        ['origem', origemClienteRef],
        ['estado', estadoClienteRef],
        ['cidade', cidadeClienteRef],
      ];
      const primeiro = refs.find(([campo]) => erros[campo])?.[1].current;
      const foco = primeiro?.matches('input,select,button')
        ? primeiro
        : primeiro?.querySelector<HTMLElement>('input,select,button,[tabindex]:not([tabindex="-1"])');
      window.requestAnimationFrame(() => foco?.focus());
      return;
    }

    setErroGeral('');
    verificandoRef.current = true;
    setCarregandoDuplicidades(true);
    try {
      const payload = toClienteOperacionalInput(clienteForm);
      const resposta = await clientesApi.buscarDuplicidades({
        nome: payload.nome,
        telefone: payload.telefone,
        instagram_usuario: payload.instagram_usuario,
      });
      if (!resposta.success) {
        setErroGeral(resposta.error || 'Não foi possível verificar cadastros parecidos.');
        return;
      }
      if (resposta.data.length === 0) {
        setDuplicidades([]);
        seguirParaPedido();
        return;
      }
      setDuplicidades(resposta.data);
      setConfirmarSeparado(false);
    } catch {
      setErroGeral('Não foi possível verificar cadastros parecidos. Tente novamente.');
    } finally {
      verificandoRef.current = false;
      setCarregandoDuplicidades(false);
    }
  };

  const usarCliente = (cliente: ClienteDuplicidade) => {
    setClienteSelecionado(cliente);
    setDuplicidades([]);
    seguirParaPedido();
  };

  const montarCliente = (): ClienteOperacionalInput => {
    const base = toClienteOperacionalInput(clienteForm);
    if (initialCliente?.id) {
      return { ...base, id: initialCliente.id };
    }
    const clienteExistente = clientes.find((cliente) => cliente.id === clienteExistenteId);
    if (clienteExistente) return clienteDaLista(clienteExistente);
    if (clienteSelecionado) {
      return {
        ...base,
        id: clienteSelecionado.id,
        duplicidade_decisao: 'reutilizada',
        duplicidade_criterios: clienteSelecionado.criterios,
      };
    }
    if (confirmarSeparado && duplicidades.length > 0) {
      return {
        ...base,
        duplicidade_decisao: 'confirmada_separada',
        duplicidade_criterios: [...new Set(duplicidades.flatMap((item) => item.criterios))],
      };
    }
    return base;
  };

  const validarPedido = (): string => {
    if (!pedido.descricao.trim()) {
      setPedidoErroCampo('descricao');
      descricaoRef.current?.focus();
      return 'Informe a peça procurada.';
    }
    if (!pedido.modelo_moto_id && !pedido.moto_modelo_texto.trim()) {
      setPedidoErroCampo('moto');
      motoTextoRef.current?.focus();
      return 'Informe a moto pelo catálogo ou em texto livre.';
    }
    if (!pedido.responsavel_id) {
      setPedidoErroCampo('responsavel');
      responsavelRef.current?.focus();
      return 'Escolha o responsável pelo pedido.';
    }
    if (pedido.tem_data_combinada && (!pedido.prometido_para || Number.isNaN(new Date(pedido.prometido_para).getTime()))) {
      setPedidoErroCampo('data');
      dataRef.current?.focus();
      return 'Informe a data combinada com o cliente.';
    }
    setPedidoErroCampo(null);
    return '';
  };

  const registrar = async () => {
    if (salvandoRef.current) return;
    const erro = validarPedido();
    if (erro) {
      setErroGeral(erro);
      return;
    }

    setErroGeral('');
    salvandoRef.current = true;
    setSalvando(true);
    try {
      const resposta = await clientesApi.registrarPedido({
        cliente: montarCliente(),
        pedido: {
          descricao: pedido.descricao.trim(),
          modelo_moto_id: pedido.modelo_moto_id || null,
          moto_modelo_texto: pedido.moto_modelo_texto.trim() || null,
          categoria_id: pedido.categoria_id || null,
          ano_compatibilidade: pedido.ano_compatibilidade.trim() || null,
          observacoes: pedido.observacoes.trim() || null,
          responsavel_id: pedido.responsavel_id,
          prometido_para: pedido.tem_data_combinada ? new Date(pedido.prometido_para).toISOString() : null,
          idempotency_key: chaveIdempotencia.current,
        },
      });
      if (!resposta.success) {
        setErroGeral(resposta.error || 'Não foi possível registrar o pedido.');
        return;
      }

      await onRefresh?.();
      await onSaved({ clienteId: resposta.data.cliente.id, pedidoId: resposta.data.pedido.id });
      onOpenChange(false);
      limparFluxo();
    } catch {
      setErroGeral('Não foi possível registrar o pedido. Tente novamente.');
    } finally {
      salvandoRef.current = false;
      setSalvando(false);
    }
  };

  const podeCadastrarSeparado = duplicidades.length > 0 && confirmarSeparado;
  const clientesOrdenados = [...clientes].sort((a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime());
  const termoCliente = buscaClienteExistente.trim().toLocaleLowerCase('pt-BR');
  const clientesFiltrados = clientesOrdenados.filter((cliente) => {
    if (!termoCliente) return true;
    return [cliente.nome, cliente.telefone, cliente.instagram_usuario, cliente.cidade, cliente.estado]
      .some((valor) => valor?.toLocaleLowerCase('pt-BR').includes(termoCliente));
  });
  const clienteSelecionadoNaLista = clientes.find((cliente) => cliente.id === clienteExistenteId);
  const voltar = () => {
    if (etapa === 2) setEtapa(1);
    else if (!initialCliente?.id) {
      setEtapa(0);
      setModoCliente(null);
      setClienteExistenteId('');
      setBuscaClienteExistente('');
      setErroGeral('');
    } else onOpenChange(false);
  };
  const footer = (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
      <button
        type="button"
        className={secondaryButton}
        disabled={salvando || carregandoDuplicidades}
        onClick={etapa === 0 ? () => onOpenChange(false) : voltar}
      >
        {etapa > 0 ? <ArrowLeft aria-hidden="true" size={16} /> : null}
        {etapa > 0 ? 'Voltar' : 'Cancelar'}
      </button>
      {etapa === 0 ? null : etapa === 1 ? (
        <button type="button" className={primaryButton} disabled={carregandoDuplicidades || (!initialCliente?.id && modoCliente === 'existente' && !clienteExistenteId)} onClick={verificarCliente}>
          {carregandoDuplicidades ? <Loader2 aria-hidden="true" className="animate-spin" size={16} /> : <Search aria-hidden="true" size={16} />}
          Continuar
        </button>
      ) : (
        <button type="button" className={primaryButton} disabled={salvando} onClick={registrar}>
          {salvando ? <Loader2 aria-hidden="true" className="animate-spin" size={16} /> : <Check aria-hidden="true" size={16} />}
          Registrar pedido
        </button>
      )}
    </div>
  );

  return (
    <OperationalDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Registrar pedido"
      description={etapa === 0 ? 'Escolha como vincular este pedido' : etapa === 1 ? '1 de 2 · Identifique o cliente' : '2 de 2 · Registre o que ele procura'}
      size="wide"
      footer={footer}
    >
      <div className="space-y-5">
        {erroGeral ? (
          <div id={erroId} role="alert" className="rounded-card border border-danger/25 bg-danger/5 px-3 py-2 text-sm text-danger">
            {erroGeral}
          </div>
        ) : null}

        {etapa === 0 ? (
          <section aria-labelledby="tipo-cliente-title">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">Cliente do pedido</p>
            <h2 id="tipo-cliente-title" className="mt-1 text-xl font-semibold tracking-tight text-text-primary">Para quem é este pedido?</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={() => { setModoCliente('existente'); setEtapa(1); }} className="rounded-card border border-border-default bg-surface-card p-4 text-left transition hover:border-accent/35 hover:bg-surface-inset focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30">
                <strong className="block text-sm text-text-primary">Cliente já cadastrado</strong>
                <span className="mt-1 block text-sm leading-5 text-text-muted">Selecione um cadastro existente e registre o pedido para ele.</span>
              </button>
              <button type="button" onClick={() => { setModoCliente('novo'); setEtapa(1); }} className="rounded-card border border-border-default bg-surface-card p-4 text-left transition hover:border-accent/35 hover:bg-surface-inset focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30">
                <strong className="block text-sm text-text-primary">Novo cliente + pedido</strong>
                <span className="mt-1 block text-sm leading-5 text-text-muted">Crie o cadastro e informe a peça procurada no mesmo fluxo.</span>
              </button>
            </div>
          </section>
        ) : etapa === 1 && modoCliente === 'existente' && !initialCliente?.id ? (
          <section aria-labelledby="cliente-existente-title" className="space-y-4">
            <div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">Cliente do pedido</p><h2 id="cliente-existente-title" className="mt-1 text-xl font-semibold tracking-tight text-text-primary">Selecione o cliente</h2><p className="mt-1 text-sm text-text-muted">Pesquise pelo nome, contato ou cidade. O pedido será vinculado ao cadastro selecionado.</p></div>
            <label className="block text-sm font-medium text-text-primary">
              Buscar cliente
              <input type="search" aria-label="Buscar cliente" placeholder="Nome, WhatsApp, Instagram ou cidade" value={buscaClienteExistente} onChange={(evento) => setBuscaClienteExistente(evento.target.value)} className={`${fieldClass} mt-1.5`} />
            </label>
            {clienteSelecionadoNaLista ? <div role="status" className="flex items-center justify-between gap-3 rounded-control border border-accent/30 bg-accent-soft-bg px-3 py-2.5 text-sm"><span className="min-w-0"><strong className="block truncate text-text-primary">{clienteSelecionadoNaLista.nome}</strong><span className="text-xs text-text-secondary">Cadastro selecionado</span></span><button type="button" onClick={() => setClienteExistenteId('')} className="shrink-0 text-xs font-semibold text-accent hover:underline">Trocar</button></div> : null}
            <div className="rounded-card border border-border-default bg-surface-card p-3">
              <div className="mb-2 flex items-center justify-between gap-3"><p className="text-xs font-semibold text-text-primary">{termoCliente ? 'Resultados carregados' : 'Clientes recentes'}</p><span className="text-xs text-text-muted">{clientes.length} carregados</span></div>
              {clientes.length === 0 ? <p className="rounded-control bg-surface-inset px-3 py-4 text-center text-sm text-text-muted">Nenhum cliente carregado. Atualize os cadastros e tente novamente.</p> : clientesFiltrados.length === 0 ? <p className="rounded-control bg-surface-inset px-3 py-4 text-center text-sm text-text-muted">Nenhum cliente encontrado para essa busca.</p> : (
                <ul className="max-h-[min(40vh,360px)] space-y-2 overflow-y-auto">
                  {(termoCliente ? clientesFiltrados.slice(0, 8) : clientesFiltrados.slice(0, 4)).map((cliente) => {
                    const motos = cliente.motos as Array<{ principal?: boolean; modelo_moto?: { nome?: string } | null; modelo_texto?: string | null }>;
                    const motoPrincipal = motos.find((moto) => moto.principal) ?? motos[0];
                    const contato = cliente.telefone || (cliente.instagram_usuario ? `@${cliente.instagram_usuario}` : 'Contato não informado');
                    const local = [cliente.cidade, cliente.estado].filter(Boolean).join('/');
                    return <li key={cliente.id}><button type="button" aria-pressed={clienteExistenteId === cliente.id} onClick={() => { setClienteExistenteId(cliente.id); setErroGeral(''); }} className={`w-full rounded-control border px-3 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 ${clienteExistenteId === cliente.id ? 'border-accent bg-accent-soft-bg' : 'border-border-subtle bg-surface-card hover:border-accent/30 hover:bg-surface-inset'}`}>
                      <span className="flex items-center justify-between gap-3"><strong className="truncate text-sm text-text-primary">{cliente.nome}</strong><span className="shrink-0 text-xs font-medium text-accent">{clienteExistenteId === cliente.id ? 'Selecionado' : 'Selecionar'}</span></span>
                      <span className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-text-muted"><span>{contato}</span>{local ? <span>{local}</span> : null}</span>
                      <span className="mt-1 flex flex-wrap gap-x-2 text-[11px] text-text-muted"><span>{motoPrincipal?.modelo_moto?.nome || motoPrincipal?.modelo_texto || 'Moto não informada'}</span><span>{cliente.pedidos.length} {cliente.pedidos.length === 1 ? 'pedido' : 'pedidos'} registrados</span></span>
                    </button></li>;
                  })}
                </ul>
              )}
              {hasMoreClientes && onLoadMoreClientes ? <button type="button" disabled={loadingMoreClientes} onClick={onLoadMoreClientes} className="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-control border border-border-default bg-surface-card px-3 text-sm font-medium text-text-secondary transition hover:bg-surface-inset disabled:cursor-wait disabled:opacity-60">{loadingMoreClientes ? 'Carregando clientes…' : 'Carregar mais clientes'}</button> : null}
            </div>
          </section>
        ) : etapa === 1 ? (
          <>
            <ClienteFormFields
              value={clienteForm}
              onChange={(value) => {
                setClienteForm(value);
                setErrosCliente({});
                setDuplicidades([]);
                setClienteSelecionado(null);
                setErroGeral('');
              }}
              errors={errosCliente}
              disabled={carregandoDuplicidades}
              fieldRefs={{
                nome: nomeClienteRef,
                telefone: telefoneClienteRef,
                instagram_usuario: instagramClienteRef,
                origem: origemClienteRef,
                estado: estadoClienteRef,
                cidade: cidadeClienteRef,
              }}
            />

            {duplicidades.length > 0 ? (
              <section aria-labelledby="duplicidades-title" className="rounded-card border border-warning/30 bg-warning/5 p-4">
                <div className="flex items-start gap-3">
                  <UserRoundCheck aria-hidden="true" className="mt-0.5 shrink-0 text-warning" size={18} />
                  <div className="min-w-0 flex-1">
                    <h3 id="duplicidades-title" className="text-sm font-semibold text-text-primary">Cadastro parecido encontrado</h3>
                    <p className="mt-1 text-sm leading-5 text-text-muted">Confira antes de criar outro cadastro para o mesmo cliente.</p>
                    <div className="mt-3 space-y-2">
                      {duplicidades.map((cliente) => (
                        <div key={cliente.id} className="flex flex-col gap-3 rounded-control border border-border-default bg-surface-card p-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-text-primary">{cliente.nome}</p>
                            <p className="mt-0.5 text-xs text-text-muted">
                              {cliente.telefone || cliente.instagram_usuario || 'Contato não informado'}
                              {cliente.cidade ? ` · ${cliente.cidade}${cliente.estado ? `/${cliente.estado}` : ''}` : ''}
                            </p>
                          </div>
                          <button type="button" className={secondaryButton} onClick={() => usarCliente(cliente)}>
                            Usar {cliente.nome}
                          </button>
                        </div>
                      ))}
                    </div>
                    <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm text-text-primary">
                      <input
                        type="checkbox"
                        className="mt-0.5 size-4 rounded border-border-default text-accent focus:ring-accent/30"
                        checked={confirmarSeparado}
                        onChange={(event) => setConfirmarSeparado(event.target.checked)}
                      />
                      <span>É outra pessoa. Confirmo que desejo manter um cadastro separado.</span>
                    </label>
                    <button
                      type="button"
                      className={`${secondaryButton} mt-3`}
                      disabled={!podeCadastrarSeparado}
                      onClick={seguirParaPedido}
                    >
                      Cadastrar separado
                    </button>
                  </div>
                </div>
              </section>
            ) : null}
          </>
        ) : (
          <section aria-labelledby="pedido-title" className="space-y-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">Pedido do cliente</p>
              <h2 id="pedido-title" className="mt-1 text-xl font-semibold tracking-tight text-text-primary">Dados do pedido</h2>
              {clienteSelecionado ? <p className="mt-1 text-sm text-text-muted">Vinculado ao cadastro de {clienteSelecionado.nome}.</p> : null}
            </div>

            <label className="block text-sm font-medium text-text-primary">
              Peça procurada <span aria-hidden="true" className="text-danger">*</span>
              <input
                ref={descricaoRef}
                aria-label="Peça procurada"
                aria-invalid={pedidoErroCampo === 'descricao' || undefined}
                aria-describedby={pedidoErroCampo === 'descricao' ? erroId : undefined}
                className={`${fieldClass} mt-1.5`}
                value={pedido.descricao}
                onChange={(event) => setPedido((atual) => ({ ...atual, descricao: event.target.value }))}
                placeholder="Ex.: farol dianteiro"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <Select label="Moto do catálogo" ariaLabel="Moto do catálogo" error={pedidoErroCampo === 'moto' ? 'Escolha uma moto ou informe em texto livre.' : undefined} value={pedido.modelo_moto_id} onChange={(modelo_moto_id) => setPedido((atual) => ({ ...atual, modelo_moto_id }))} options={[{ value: '', label: 'Selecione se encontrar' }, ...modelos.map((modelo) => ({ value: modelo.id, label: modelo.nome }))]} size="mobile" />
              <label className="block text-sm font-medium text-text-primary">
                Moto em texto livre
                <input
                  ref={motoTextoRef}
                  aria-label="Moto em texto livre"
                  aria-invalid={pedidoErroCampo === 'moto' || undefined}
                  aria-describedby={pedidoErroCampo === 'moto' ? erroId : undefined}
                  className={`${fieldClass} mt-1.5`}
                  value={pedido.moto_modelo_texto}
                  onChange={(event) => setPedido((atual) => ({ ...atual, moto_modelo_texto: event.target.value }))}
                  placeholder="Ex.: CG 160 Fan"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium text-text-primary">
                Ano de compatibilidade
                <input
                  aria-label="Ano de compatibilidade"
                  className={`${fieldClass} mt-1.5`}
                  value={pedido.ano_compatibilidade}
                  onChange={(event) => setPedido((atual) => ({ ...atual, ano_compatibilidade: event.target.value }))}
                  placeholder="Ex.: 2019 a 2023"
                />
              </label>
              <Select label="Categoria da peça" ariaLabel="Categoria da peça" value={pedido.categoria_id} onChange={(categoria_id) => setPedido((atual) => ({ ...atual, categoria_id }))} options={[{ value: '', label: 'Sem categoria' }, ...categorias.map((categoria) => ({ value: categoria.id, label: categoria.nome }))]} size="mobile" />
            </div>

            <Select ref={responsavelRef} label="Responsável" ariaLabel="Responsável" error={pedidoErroCampo === 'responsavel' ? 'Escolha o responsável pelo pedido.' : undefined} value={pedido.responsavel_id} onChange={(responsavel_id) => setPedido((atual) => ({ ...atual, responsavel_id }))} options={[{ value: '', label: 'Selecione' }, ...responsaveis.map((responsavel) => ({ value: responsavel.id, label: responsavel.nome }))]} size="mobile" />

            <div className="rounded-card border border-border-default bg-surface-inset p-3">
              <label className="flex cursor-pointer items-center gap-3 text-sm font-medium text-text-primary">
                <input
                  type="checkbox"
                  className="size-4 rounded border-border-default text-accent focus:ring-accent/30"
                  checked={pedido.tem_data_combinada}
                  onChange={(event) => setPedido((atual) => ({ ...atual, tem_data_combinada: event.target.checked, prometido_para: event.target.checked ? atual.prometido_para : '' }))}
                />
                Data combinada com o cliente
              </label>
              {pedido.tem_data_combinada ? (
                <label className="mt-3 block text-sm font-medium text-text-primary">
                  Data combinada <span aria-hidden="true" className="text-danger">*</span>
                  <input
                    ref={dataRef}
                    type="datetime-local"
                    aria-label="Data combinada"
                    aria-invalid={pedidoErroCampo === 'data' || undefined}
                    aria-describedby={pedidoErroCampo === 'data' ? erroId : undefined}
                    className={`${fieldClass} mt-1.5`}
                    value={pedido.prometido_para}
                    onChange={(event) => setPedido((atual) => ({ ...atual, prometido_para: event.target.value }))}
                  />
                </label>
              ) : null}
            </div>

            <label className="block text-sm font-medium text-text-primary">
              Observações
              <textarea
                aria-label="Observações do pedido"
                className={`${fieldClass} mt-1.5 min-h-24 resize-y py-2.5`}
                value={pedido.observacoes}
                onChange={(event) => setPedido((atual) => ({ ...atual, observacoes: event.target.value }))}
                placeholder="Detalhes que ajudam a encontrar a peça"
              />
            </label>
          </section>
        )}
      </div>
    </OperationalDrawer>
  );
}
