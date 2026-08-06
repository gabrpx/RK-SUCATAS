// Calculadora de frete: cota via Melhor Envio do CEP da loja até o do cliente.
// Não depende do DataContext pro cálculo — mas lê o estoque pra permitir
// cotar a partir de uma peça, que é como o pedido chega na prática ("quanto
// fica pra mandar o farol da Titan pra Recife?").
import { useEffect, useMemo, useState } from 'react';
import { Truck, Loader2, Package, MapPin, DollarSign, Clock, Copy, Check, History, Box, Search, X, Save, PackagePlus, RefreshCw, Trash2, ClipboardCheck } from 'lucide-react';
import { cn } from '../../utils';
import { useData } from '../../context/DataContext';
import { aviso } from '../../components/ui/toast';
import { DataTable } from '../../components/ui/DataTable';
import type { DataTableColumn } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import type { StatusTone } from '../../components/ui/StatusBadge';
import { EmptyState } from '../../components/ui/EmptyState';
import { SeletorCliente } from '../clientes/SeletorCliente';
import { CEP_ORIGEM_LOJA } from '../../constants/loja';
import { calcularFrete, buscarCidadePorCep, enviosApi, type FreteQuote } from './api';
import { presetsCaixa, ultimasDimensoes, historicoCotacoes, formatarCep, cepValido, type Dimensoes, type PresetCaixa } from './presets';
import type { Envio, EnvioInput, EnvioStatus } from './types';

const STATUS_LABELS: Record<EnvioStatus, string> = {
  aguardando_postagem: 'Aguardando postagem',
  postado: 'Postado',
  em_transito: 'Em trânsito',
  entregue: 'Entregue',
  problema: 'Problema',
  cancelado: 'Cancelado',
};

const STATUS_TONS: Record<EnvioStatus, StatusTone> = {
  aguardando_postagem: 'neutral',
  postado: 'accent',
  em_transito: 'warning',
  entregue: 'positive',
  problema: 'danger',
  cancelado: 'neutral',
};

const EMPTY_ENVIO: EnvioInput = { cliente_id: null, cliente_nome: '', transportadora: '', servico: '', codigo_rastreio: '', melhor_envio_order_id: '', cep_destino: '', valor_frete: null };

const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0);

const DIMENSOES_VAZIAS: Dimensoes = { peso: '', largura: '', altura: '', comprimento: '' };

function precoDaCotacao(q: FreteQuote): number | null {
  const n = parseFloat(String(q.price));
  return Number.isFinite(n) ? n : null;
}

export const FreteView = () => {
  const [secao, setSecao] = useState<'cotacao' | 'envios'>('cotacao');

  return (
    <div className="space-y-5 pb-24 md:pb-6 max-w-4xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-medium text-text-primary">Frete</h1>
          <p className="text-sm text-text-faint mt-0.5">{secao === 'cotacao' ? 'Cotação de envio a partir da loja' : 'Envios registrados e rastreio'}</p>
        </div>
        <div className="flex items-center gap-1 rounded-control border border-border-default bg-surface-inset p-1 shrink-0">
          <button
            onClick={() => setSecao('cotacao')}
            className={cn(
              'h-8 px-3 rounded-control text-[11px] font-semibold uppercase tracking-wider transition-colors',
              secao === 'cotacao' ? 'bg-accent-soft-bg text-accent-soft-fg' : 'text-text-muted hover:text-text-secondary'
            )}
          >
            Cotação
          </button>
          <button
            onClick={() => setSecao('envios')}
            className={cn(
              'h-8 px-3 rounded-control text-[11px] font-semibold uppercase tracking-wider transition-colors',
              secao === 'envios' ? 'bg-accent-soft-bg text-accent-soft-fg' : 'text-text-muted hover:text-text-secondary'
            )}
          >
            Envios
          </button>
        </div>
      </div>
      {secao === 'cotacao' ? <CotacaoSection /> : <EnviosSection />}
    </div>
  );
};

function CotacaoSection() {
  const { estoque } = useData();

  const [cep, setCep] = useState('');
  const [dimensoes, setDimensoes] = useState<Dimensoes>(() => ultimasDimensoes.ler() ?? DIMENSOES_VAZIAS);
  const [sortBy, setSortBy] = useState<'price' | 'time'>('price');
  const [destinationCity, setDestinationCity] = useState('');
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<FreteQuote[]>([]);
  const [copiado, setCopiado] = useState(false);
  const [presets, setPresets] = useState<PresetCaixa[]>(() => presetsCaixa.listar());
  const [historico, setHistorico] = useState(() => historicoCotacoes.listar());
  const [buscaPeca, setBuscaPeca] = useState('');
  const [pecaEscolhida, setPecaEscolhida] = useState<{ nome: string; valor: number } | null>(null);

  const cepPronto = cepValido(cep);
  const dimensoesPreenchidas = Object.values(dimensoes).every((v) => Number(v) > 0);

  // Busca a cidade assim que o CEP fica completo — confirma na hora que é o
  // destino certo, em vez de descobrir só depois de cotar.
  useEffect(() => {
    if (!cepPronto) {
      setDestinationCity('');
      return;
    }
    let cancelado = false;
    buscarCidadePorCep(cep).then((cidade) => {
      if (!cancelado) setDestinationCity(cidade);
    });
    return () => {
      cancelado = true;
    };
  }, [cep, cepPronto]);

  const resultadosPeca = useMemo(() => {
    const termo = buscaPeca.trim().toLowerCase();
    if (termo.length < 2) return [];
    return estoque.filter((e) => e.nome.toLowerCase().includes(termo) || e.codigo?.toLowerCase().includes(termo)).slice(0, 5);
  }, [buscaPeca, estoque]);

  const ordenadas = useMemo(
    () =>
      options
        .filter((opt) => precoDaCotacao(opt) !== null)
        .sort((a, b) =>
          sortBy === 'price'
            ? (precoDaCotacao(a) ?? 0) - (precoDaCotacao(b) ?? 0)
            : parseInt(String(a.delivery_time || 999)) - parseInt(String(b.delivery_time || 999))
        ),
    [options, sortBy]
  );

  const handleCalculate = async () => {
    if (!cepPronto) return aviso.atencao('Informe um CEP de destino com 8 dígitos');
    if (!dimensoesPreenchidas) return aviso.atencao('Preencha peso e as três medidas da caixa');

    setLoading(true);
    setOptions([]);
    try {
      const quotes = await calcularFrete({ cep_origem: CEP_ORIGEM_LOJA, cep_destino: cep, ...dimensoes });
      const validas = quotes.filter((q) => precoDaCotacao(q) !== null);
      setOptions(quotes);

      if (validas.length === 0) {
        aviso.atencao('Nenhuma transportadora atende esse trecho', { descricao: 'Confira o CEP e as medidas da caixa.' });
        return;
      }

      ultimasDimensoes.gravar(dimensoes);
      const maisBarata = validas.reduce((a, b) => ((precoDaCotacao(a) ?? 0) <= (precoDaCotacao(b) ?? 0) ? a : b));
      historicoCotacoes.registrar({
        ...dimensoes,
        cep,
        cidade: destinationCity,
        menorPreco: precoDaCotacao(maisBarata),
        transportadora: maisBarata.company?.name ?? null,
        quando: new Date().toISOString(),
      });
      setHistorico(historicoCotacoes.listar());
    } catch (err) {
      // Antes isso caía só no console e a tela ficava parada, sem explicação.
      aviso.falha(err, 'Não foi possível calcular o frete');
    } finally {
      setLoading(false);
    }
  };

  const aplicarPreset = (preset: PresetCaixa) => {
    setDimensoes({ peso: preset.peso, largura: preset.largura, altura: preset.altura, comprimento: preset.comprimento });
  };

  const salvarComoPreset = () => {
    const nome = `${dimensoes.largura}x${dimensoes.altura}x${dimensoes.comprimento} · ${dimensoes.peso}kg`;
    if (presets.some((p) => p.nome === nome)) return aviso.info('Essa caixa já está salva');
    const novos = [...presets, { id: crypto.randomUUID(), nome, ...dimensoes }];
    setPresets(novos);
    presetsCaixa.salvar(novos);
    aviso.sucesso('Caixa salva', { descricao: nome });
  };

  const removerPreset = (id: string) => {
    const novos = presets.filter((p) => p.id !== id);
    setPresets(novos);
    presetsCaixa.salvar(novos);
  };

  // Texto pronto pra colar no WhatsApp — é como a resposta chega no cliente.
  const copiarResumo = async () => {
    const linhas = ordenadas
      .slice(0, 3)
      .map((o) => `• ${o.company?.name || 'Transportadora'} ${o.name || ''}: ${formatCurrency(precoDaCotacao(o) ?? 0)}${o.delivery_time ? ` (${o.delivery_time} dias)` : ''}`)
      .join('\n');
    const cabecalho = pecaEscolhida ? `*${pecaEscolhida.nome}*\n` : '';
    const texto = `${cabecalho}Frete para ${destinationCity || cep} (${formatarCep(cep)}):\n${linhas}`;
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
      aviso.sucesso('Cotação copiada');
    } catch {
      aviso.erro('Não foi possível copiar');
    }
  };

  const inputClass =
    'w-full border rounded-control py-2.5 px-4 text-sm outline-none transition-all focus:ring-2 focus:ring-accent/50 bg-surface-inset border-border-default text-text-primary placeholder:text-text-faint';
  const labelClass = 'text-xs font-semibold uppercase tracking-wider mb-1.5 block text-text-muted';

  return (
    <div className="space-y-5">
      <div className="rounded-card border border-border-subtle bg-surface-card p-5 space-y-5">
        {/* Cotar a partir de uma peça: puxa o nome pro texto do WhatsApp e
            deixa claro do que se está falando quando a cotação for enviada. */}
        <div>
          <label className={labelClass}>Peça (opcional)</label>
          {pecaEscolhida ? (
            <div className="flex items-center justify-between gap-3 rounded-control border border-border-default bg-surface-inset px-4 py-2.5">
              <div className="min-w-0">
                <p className="text-sm text-text-primary truncate">{pecaEscolhida.nome}</p>
                <p className="text-xs text-text-faint">{formatCurrency(pecaEscolhida.valor)}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPecaEscolhida(null);
                  setBuscaPeca('');
                }}
                className="shrink-0 size-7 flex items-center justify-center rounded-control text-text-muted hover:bg-surface-raised"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <div className="relative">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-faint" />
              <input
                value={buscaPeca}
                onChange={(e) => setBuscaPeca(e.target.value)}
                placeholder="Buscar peça pra citar na cotação..."
                className={cn(inputClass, 'pl-10')}
              />
              {resultadosPeca.length > 0 && (
                <div className="absolute z-20 mt-1 w-full rounded-control border border-border-default bg-surface-raised shadow-2xl overflow-hidden">
                  {resultadosPeca.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setPecaEscolhida({ nome: item.nome, valor: Number(item.valor) });
                        setBuscaPeca('');
                      }}
                      className="w-full text-left px-4 py-2.5 hover:bg-surface-inset flex items-center justify-between gap-3"
                    >
                      <span className="text-sm text-text-primary truncate">{item.nome}</span>
                      <span className="text-xs text-text-faint shrink-0">{item.codigo}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div>
          <label className={labelClass}>
            <span className="inline-flex items-center gap-1.5">
              <MapPin size={12} /> CEP de destino
            </span>
          </label>
          <input
            value={cep}
            onChange={(e) => setCep(formatarCep(e.target.value))}
            placeholder="00000-000"
            inputMode="numeric"
            className={cn(inputClass, cep && !cepPronto && 'border-warning/50')}
          />
          <p className="text-xs mt-1.5 h-4">
            {destinationCity ? (
              <span className="text-positive">{destinationCity}</span>
            ) : cep && !cepPronto ? (
              <span className="text-warning">Faltam {8 - cep.replace(/\D/g, '').length} dígito(s)</span>
            ) : null}
          </p>
        </div>

        {/* Presets: o atalho que evita redigitar a mesma caixa o dia inteiro */}
        <div>
          <label className={labelClass}>
            <span className="inline-flex items-center gap-1.5">
              <Box size={12} /> Caixas salvas
            </span>
          </label>
          <div className="flex flex-wrap gap-2">
            {presets.map((preset) => (
              <span key={preset.id} className="group inline-flex items-center rounded-control border border-border-default bg-surface-inset">
                <button
                  type="button"
                  onClick={() => aplicarPreset(preset)}
                  className="px-3 py-2 text-xs font-medium text-text-secondary hover:text-accent-soft-fg"
                >
                  {preset.nome}
                </button>
                <button
                  type="button"
                  onClick={() => removerPreset(preset.id)}
                  title="Remover caixa"
                  className="px-2 py-2 text-text-faint hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
            {dimensoesPreenchidas && (
              <button
                type="button"
                onClick={salvarComoPreset}
                className="inline-flex items-center gap-1.5 rounded-control border border-dashed border-border-default px-3 py-2 text-xs font-medium text-text-muted hover:text-accent-soft-fg hover:border-accent/50"
              >
                <Save size={12} /> Salvar esta
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {([
            ['peso', 'Peso (kg)', '1.5'],
            ['largura', 'Largura (cm)', '20'],
            ['altura', 'Altura (cm)', '15'],
            ['comprimento', 'Compr. (cm)', '30'],
          ] as const).map(([campo, rotulo, exemplo]) => (
            <div key={campo}>
              <label className={labelClass}>{rotulo}</label>
              <input
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={dimensoes[campo]}
                onChange={(e) => setDimensoes((d) => ({ ...d, [campo]: e.target.value }))}
                placeholder={exemplo}
                className={inputClass}
              />
            </div>
          ))}
        </div>

        <button
          onClick={handleCalculate}
          disabled={loading}
          className="w-full h-12 rounded-control bg-accent text-white font-semibold text-xs uppercase tracking-[0.2em] shadow-sm hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : <><Truck size={16} /> Calcular frete</>}
        </button>
      </div>

      {/* ------------------------------------------------------- resultados */}
      {ordenadas.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-medium text-text-primary">
                {ordenadas.length} opç{ordenadas.length === 1 ? 'ão' : 'ões'} para {destinationCity || formatarCep(cep)}
              </h2>
              <p className="text-xs text-text-faint mt-0.5">
                {dimensoes.largura}×{dimensoes.altura}×{dimensoes.comprimento} cm · {dimensoes.peso} kg
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSortBy('price')}
                className={cn(
                  'h-9 px-3 rounded-control border text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5',
                  sortBy === 'price' ? 'bg-accent-soft-bg border-accent/30 text-accent-soft-fg' : 'bg-surface-inset border-border-default text-text-muted'
                )}
              >
                <DollarSign size={13} /> Mais barato
              </button>
              <button
                onClick={() => setSortBy('time')}
                className={cn(
                  'h-9 px-3 rounded-control border text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5',
                  sortBy === 'time' ? 'bg-accent-soft-bg border-accent/30 text-accent-soft-fg' : 'bg-surface-inset border-border-default text-text-muted'
                )}
              >
                <Clock size={13} /> Mais rápido
              </button>
              <button
                onClick={copiarResumo}
                title="Copiar as 3 melhores pro WhatsApp"
                className="h-9 px-3 rounded-control border border-border-default bg-surface-inset text-text-muted hover:text-text-primary text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5"
              >
                {copiado ? <Check size={13} className="text-positive" /> : <Copy size={13} />}
                <span className="hidden sm:inline">{copiado ? 'Copiado' : 'Copiar'}</span>
              </button>
            </div>
          </div>

          <ul className="space-y-2">
            {ordenadas.map((opt, i) => {
              const preco = precoDaCotacao(opt) ?? 0;
              // Só o primeiro da ordenação atual ganha destaque — a cor
              // aponta a recomendação, não decora.
              const recomendada = i === 0;
              return (
                <li
                  key={`${opt.company?.name}-${opt.name}-${i}`}
                  className={cn(
                    'flex items-center justify-between gap-4 rounded-card border bg-surface-card p-4',
                    recomendada ? 'border-positive/40' : 'border-border-subtle'
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn('size-9 rounded-control flex items-center justify-center shrink-0', recomendada ? 'bg-positive-bg text-positive' : 'bg-surface-inset text-text-faint')}>
                      <Package size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">
                        {opt.company?.name || 'Transportadora'} <span className="text-text-faint font-normal">{opt.name}</span>
                      </p>
                      <p className="text-xs text-text-faint">{opt.delivery_time ? `Chega em ${opt.delivery_time} dias` : 'Prazo não informado'}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={cn('text-base font-medium tabular-nums', recomendada ? 'text-positive' : 'text-text-primary')}>{formatCurrency(preco)}</p>
                    {recomendada && <p className="text-[10px] uppercase tracking-wider text-positive">{sortBy === 'price' ? 'Mais barato' : 'Mais rápido'}</p>}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* --------------------------------------------------------- histórico */}
      {historico.length > 0 && ordenadas.length === 0 && (
        <div className="rounded-card border border-border-subtle bg-surface-card p-5">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted flex items-center gap-2">
              <History size={13} /> Últimas cotações
            </h2>
            <button
              onClick={() => {
                historicoCotacoes.limpar();
                setHistorico([]);
              }}
              className="text-xs text-text-faint hover:text-danger"
            >
              Limpar
            </button>
          </div>
          <ul className="divide-y divide-border-subtle/60">
            {historico.map((h) => (
              <li key={h.quando} className="flex items-center justify-between gap-3 py-2.5">
                <button
                  type="button"
                  // Refazer a cotação com um toque: mesmo CEP, mesma caixa.
                  onClick={() => {
                    setCep(formatarCep(h.cep));
                    setDimensoes({ peso: h.peso, largura: h.largura, altura: h.altura, comprimento: h.comprimento });
                  }}
                  className="min-w-0 text-left flex-1 group"
                >
                  <p className="text-sm text-text-primary truncate group-hover:text-accent-soft-fg">{h.cidade || formatarCep(h.cep)}</p>
                  <p className="text-xs text-text-faint">
                    {h.largura}×{h.altura}×{h.comprimento} cm · {h.peso} kg
                  </p>
                </button>
                {h.menorPreco !== null && (
                  <span className="text-xs text-text-secondary tabular-nums shrink-0">
                    {formatCurrency(h.menorPreco)}
                    {h.transportadora && <span className="text-text-faint"> · {h.transportadora}</span>}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function EnviosSection() {
  const { envios, refreshData, loading } = useData();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState<EnvioInput>(EMPTY_ENVIO);
  const [salvando, setSalvando] = useState(false);
  const [rastreandoId, setRastreandoId] = useState<string | null>(null);
  const [rastreandoTodos, setRastreandoTodos] = useState(false);

  const inputClass =
    'w-full border rounded-control py-2.5 px-4 text-sm outline-none transition-all focus:ring-2 focus:ring-accent/50 bg-surface-inset border-border-default text-text-primary placeholder:text-text-faint';
  const labelClass = 'text-xs font-semibold uppercase tracking-wider mb-1.5 block text-text-muted';

  const salvar = async () => {
    setSalvando(true);
    try {
      const result = await enviosApi.criar({
        cliente_id: form.cliente_id || null,
        cliente_nome: form.cliente_nome?.trim() || null,
        transportadora: form.transportadora?.trim() || null,
        servico: form.servico?.trim() || null,
        codigo_rastreio: form.codigo_rastreio?.trim() || null,
        melhor_envio_order_id: form.melhor_envio_order_id?.trim() || null,
        cep_destino: form.cep_destino?.trim() || null,
        valor_frete: form.valor_frete || null,
      });
      if (!result.success) throw new Error(result.error);
      setIsFormOpen(false);
      setForm(EMPTY_ENVIO);
      await refreshData();
      aviso.sucesso('Envio registrado');
    } catch (err: any) {
      aviso.falha(err, 'Erro ao registrar envio');
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async (envio: Envio) => {
    try {
      const result = await enviosApi.excluir(envio.id);
      if (!result.success) throw new Error(result.error);
      await refreshData();
    } catch (err: any) {
      aviso.falha(err, 'Erro ao excluir envio');
    }
  };

  const mudarStatus = async (envio: Envio, status: EnvioStatus) => {
    try {
      const result = await enviosApi.atualizar(envio.id, { status });
      if (!result.success) throw new Error(result.error);
      await refreshData();
    } catch (err: any) {
      aviso.falha(err, 'Erro ao atualizar status');
    }
  };

  const rastrear = async (envio: Envio) => {
    setRastreandoId(envio.id);
    try {
      const result = await enviosApi.rastrear(envio.id);
      if (!result.success) throw new Error(result.error);
      await refreshData();
      if (result.data.status_detalhe?.startsWith('Não foi possível')) {
        aviso.atencao('Rastreio não disponível', { descricao: result.data.status_detalhe });
      } else {
        aviso.sucesso('Status atualizado');
      }
    } catch (err: any) {
      aviso.falha(err, 'Erro ao rastrear envio');
    } finally {
      setRastreandoId(null);
    }
  };

  const rastrearTodos = async () => {
    const rastreaveis = envios.filter((e) => e.melhor_envio_order_id && e.status !== 'entregue' && e.status !== 'cancelado');
    if (rastreaveis.length === 0) return aviso.info('Nenhum envio com pedido do Melhor Envio pra rastrear');
    setRastreandoTodos(true);
    try {
      await Promise.all(rastreaveis.map((e) => enviosApi.rastrear(e.id)));
      await refreshData();
      aviso.sucesso(`${rastreaveis.length} envio(s) verificado(s)`);
    } catch (err: any) {
      aviso.falha(err, 'Erro ao rastrear envios');
    } finally {
      setRastreandoTodos(false);
    }
  };

  const colunas: DataTableColumn<Envio>[] = [
    { key: 'cliente', header: 'Cliente', render: (e) => e.cliente?.nome || e.cliente_nome || '—' },
    { key: 'transportadora', header: 'Transportadora', render: (e) => [e.transportadora, e.servico].filter(Boolean).join(' · ') || '—' },
    { key: 'codigo', header: 'Código', render: (e) => e.codigo_rastreio || '—' },
    {
      key: 'status',
      header: 'Status',
      render: (e) => (
        <select
          value={e.status}
          onChange={(ev) => mudarStatus(e, ev.target.value as EnvioStatus)}
          onClick={(ev) => ev.stopPropagation()}
          className="bg-transparent text-xs border-none outline-none cursor-pointer text-text-secondary"
        >
          {(Object.keys(STATUS_LABELS) as EnvioStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      ),
    },
    {
      key: 'acoes',
      header: 'Ações',
      align: 'right',
      render: (e) => (
        <div className="flex items-center justify-end gap-1" onClick={(ev) => ev.stopPropagation()}>
          {e.melhor_envio_order_id && (
            <button
              onClick={() => rastrear(e)}
              disabled={rastreandoId === e.id}
              title="Atualizar status via Melhor Envio"
              className="size-7 flex items-center justify-center rounded-control text-text-muted hover:bg-surface-raised hover:text-text-primary disabled:opacity-50"
            >
              {rastreandoId === e.id ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            </button>
          )}
          <button onClick={() => excluir(e)} title="Excluir" className="size-7 flex items-center justify-center rounded-control text-text-muted hover:bg-surface-raised hover:text-danger">
            <Trash2 size={13} />
          </button>
        </div>
      ),
    },
  ];

  function renderMobileCard(e: Envio) {
    return (
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-text-primary truncate">{e.cliente?.nome || e.cliente_nome || 'Sem cliente'}</p>
          <p className="text-xs text-text-faint truncate">{[e.transportadora, e.codigo_rastreio].filter(Boolean).join(' · ') || '—'}</p>
        </div>
        <StatusBadge texto={STATUS_LABELS[e.status]} tom={STATUS_TONS[e.status]} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          onClick={rastrearTodos}
          disabled={rastreandoTodos}
          className="h-10 px-4 rounded-control border border-border-default bg-surface-inset text-text-secondary text-[11px] font-semibold uppercase tracking-wider hover:bg-surface-raised disabled:opacity-50 flex items-center gap-2"
        >
          {rastreandoTodos ? <Loader2 size={14} className="animate-spin" /> : <ClipboardCheck size={14} />} Atualizar todos
        </button>
        <button
          onClick={() => setIsFormOpen(true)}
          className="h-10 px-5 rounded-control bg-accent text-white text-[11px] font-semibold uppercase tracking-wider shadow-sm flex items-center gap-2 hover:opacity-90"
        >
          <PackagePlus size={16} /> Registrar envio
        </button>
      </div>

      <DataTable
        colunas={colunas}
        dados={loading ? [] : envios}
        getRowKey={(e) => e.id}
        renderMobileCard={renderMobileCard}
        paginaAtual={1}
        totalPaginas={1}
        onMudarPagina={() => {}}
        emptyState={
          loading ? (
            <div className="py-12 flex items-center justify-center text-text-faint">
              <Loader2 size={20} className="animate-spin" />
            </div>
          ) : (
            <EmptyState icone={Truck} mensagem="Nenhum envio registrado ainda." acaoLabel="Registrar o primeiro" onAcao={() => setIsFormOpen(true)} />
          )
        }
      />

      {isFormOpen && (
        <div className="fixed inset-0 z-[3000] bg-black/70 backdrop-blur-sm flex items-end md:items-center justify-center overflow-y-auto" onClick={() => setIsFormOpen(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md flex flex-col overflow-hidden rounded-t-card md:rounded-card bg-surface-page text-text-primary border border-border-subtle my-auto"
          >
            <div className="p-6 border-b border-border-subtle">
              <h2 className="text-lg font-medium">Registrar envio</h2>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className={labelClass}>Cliente</label>
                <SeletorCliente
                  clienteId={form.cliente_id || null}
                  nome={form.cliente_nome || ''}
                  onChange={(clienteId, nome) => setForm((f) => ({ ...f, cliente_id: clienteId, cliente_nome: nome }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Transportadora</label>
                  <input value={form.transportadora || ''} onChange={(e) => setForm((f) => ({ ...f, transportadora: e.target.value }))} className={inputClass} placeholder="Ex: Correios" />
                </div>
                <div>
                  <label className={labelClass}>Serviço</label>
                  <input value={form.servico || ''} onChange={(e) => setForm((f) => ({ ...f, servico: e.target.value }))} className={inputClass} placeholder="Ex: SEDEX" />
                </div>
              </div>
              <div>
                <label className={labelClass}>Código de rastreio</label>
                <input value={form.codigo_rastreio || ''} onChange={(e) => setForm((f) => ({ ...f, codigo_rastreio: e.target.value }))} className={inputClass} placeholder="Opcional" />
              </div>
              <div>
                <label className={labelClass}>Nº do pedido no Melhor Envio</label>
                <input
                  value={form.melhor_envio_order_id || ''}
                  onChange={(e) => setForm((f) => ({ ...f, melhor_envio_order_id: e.target.value }))}
                  className={inputClass}
                  placeholder="Só se foi comprado por lá — habilita rastreio automático"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>CEP destino</label>
                  <input value={form.cep_destino || ''} onChange={(e) => setForm((f) => ({ ...f, cep_destino: e.target.value }))} className={inputClass} placeholder="00000-000" />
                </div>
                <div>
                  <label className={labelClass}>Valor do frete</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.valor_frete ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, valor_frete: e.target.value === '' ? null : Number(e.target.value) }))}
                    className={inputClass}
                    placeholder="0,00"
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-3 p-6 border-t border-border-subtle">
              <button onClick={() => setIsFormOpen(false)} className="flex-1 py-3 rounded-control font-medium text-sm border border-border-default text-text-secondary hover:bg-surface-raised">
                Cancelar
              </button>
              <button onClick={salvar} disabled={salvando} className="flex-1 py-3 rounded-control font-medium text-sm bg-accent text-white hover:opacity-90 disabled:opacity-50">
                {salvando ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
