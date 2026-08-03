// Gestão de promoções — desconto com prazo aplicado a uma peça específica, um
// modelo de moto (a peça precisa estar vinculada a ele ou a alguma variação
// por ano dele — ver src/features/motos/motoTree.ts), uma categoria (mesma
// lógica de subárvore) ou o estoque inteiro. Sem job/cron: o preço
// promocional é calculado a cada consulta pelo backend (ver
// src/server/routes/estoque.ts > anexarPromocoes), comparando a janela de
// datas com "agora" — aqui só cadastra, encerra ou exclui.
import { useEffect, useMemo, useState } from 'react';
import { Tag, Plus, Ban, RotateCcw, Trash2, Loader2, X, Search } from 'lucide-react';
import { cn } from '../../utils';
import { useData } from '../../context/DataContext';
import { useCatalogos } from '../../hooks/useCatalogos';
import { aviso } from '../../components/ui/toast';
import { DataTable } from '../../components/ui/DataTable';
import type { DataTableColumn } from '../../components/ui/DataTable';
import { StatusBadge } from '../../components/ui/StatusBadge';
import type { StatusTone } from '../../components/ui/StatusBadge';
import { EmptyState } from '../../components/ui/EmptyState';
import { TreeDropdown, type TreeDropdownNode } from '../../components/TreeDropdown';
import { getAncestorChain as getAncestorChainMoto } from '../motos/motoTree';
import { getAncestorChain as getAncestorChainCategoria } from '../categorias/categoriaTree';
import { promocoesApi } from './api';
import type { EscopoPromocao, Promocao, TipoDesconto } from './types';

const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0);
const formatDataHora = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

const ESCOPO_LABEL: Record<EscopoPromocao, string> = {
  peca: 'Peça específica',
  modelo_moto: 'Modelo de moto',
  categoria: 'Categoria',
  global: 'Estoque inteiro',
};

type StatusPromocao = 'ativa' | 'agendada' | 'encerrada';

function statusDaPromocao(p: Promocao): StatusPromocao {
  if (!p.ativo) return 'encerrada';
  const agora = Date.now();
  if (agora < new Date(p.data_inicio).getTime()) return 'agendada';
  if (p.data_fim && agora > new Date(p.data_fim).getTime()) return 'encerrada';
  return 'ativa';
}

const STATUS_TOM: Record<StatusPromocao, StatusTone> = { ativa: 'positive', agendada: 'warning', encerrada: 'neutral' };
const STATUS_LABEL: Record<StatusPromocao, string> = { ativa: 'Ativa', agendada: 'Agendada', encerrada: 'Encerrada' };

// yyyy-MM-ddTHH:mm no fuso local, formato que <input type="datetime-local"> espera.
function agoraParaInputLocal(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

interface FormState {
  escopo: EscopoPromocao;
  alvoId: string;
  tipoDesconto: TipoDesconto;
  valor: string;
  descricao: string;
  dataInicio: string;
  semPrazo: boolean;
  dataFim: string;
}

function formVazio(): FormState {
  return { escopo: 'peca', alvoId: '', tipoDesconto: 'percentual', valor: '', descricao: '', dataInicio: agoraParaInputLocal(), semPrazo: true, dataFim: '' };
}

export function PromocoesView() {
  const { estoque: items } = useData();
  const { categorias, modelos } = useCatalogos();

  const [promocoes, setPromocoes] = useState<Promocao[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(formVazio());
  const [buscaPeca, setBuscaPeca] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState<string | null>(null);

  const [itemParaExcluir, setItemParaExcluir] = useState<Promocao | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  const carregar = async () => {
    setLoading(true);
    setErro(null);
    try {
      const result = await promocoesApi.listar();
      if (!result.success) throw new Error(result.error);
      setPromocoes(result.data);
    } catch (err: any) {
      setErro(err.message || 'Erro ao carregar promoções');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  const migracaoPendente = !!erro && /promocoes|schema cache/i.test(erro);

  const modeloNodes = useMemo<TreeDropdownNode[]>(
    () => modelos.map((m) => ({ id: m.id, nome: m.nome, parent_id: m.parent_id, ordem: m.ordem, secundario: m.ano })),
    [modelos]
  );
  const categoriaNodes = useMemo<TreeDropdownNode[]>(
    () => categorias.map((c) => ({ id: c.id, nome: c.nome, parent_id: c.parent_id, ordem: c.ordem })),
    [categorias]
  );

  const nomeDoAlvo = (p: Promocao): string => {
    if (p.escopo === 'global') return 'Todo o estoque';
    if (!p.alvo_id) return '—';
    if (p.escopo === 'peca') return items.find((i) => i.id === p.alvo_id)?.nome ?? 'Peça removida';
    if (p.escopo === 'modelo_moto') {
      const cadeia = getAncestorChainMoto(p.alvo_id, modelos);
      return cadeia.length > 0 ? cadeia.map((n) => n.nome).join(' › ') : 'Modelo removido';
    }
    const cadeia = getAncestorChainCategoria(p.alvo_id, categorias);
    return cadeia.length > 0 ? cadeia.map((n) => n.nome).join(' › ') : 'Categoria removida';
  };

  const resultadosPeca = useMemo(() => {
    if (!buscaPeca.trim()) return [];
    const termo = buscaPeca.toLowerCase();
    return items.filter((i) => i.nome.toLowerCase().includes(termo) || i.codigo?.toLowerCase().includes(termo)).slice(0, 8);
  }, [buscaPeca, items]);

  const pecaSelecionada = form.escopo === 'peca' ? items.find((i) => i.id === form.alvoId) ?? null : null;

  const abrirCriar = () => {
    setForm(formVazio());
    setBuscaPeca('');
    setErroForm(null);
    setIsFormOpen(true);
  };

  const salvar = async () => {
    setErroForm(null);
    if (form.escopo !== 'global' && !form.alvoId) return setErroForm('Selecione o alvo da promoção.');
    const valorNum = Number(form.valor);
    if (!Number.isFinite(valorNum) || valorNum <= 0) return setErroForm('Informe um valor de desconto maior que zero.');
    if (form.tipoDesconto === 'percentual' && valorNum > 100) return setErroForm('Desconto percentual não pode passar de 100%.');
    if (!form.semPrazo && !form.dataFim) return setErroForm('Informe a data de término ou marque "sem prazo definido".');
    if (!form.semPrazo && new Date(form.dataFim) <= new Date(form.dataInicio)) return setErroForm('A data de término precisa ser depois do início.');

    setSalvando(true);
    try {
      const result = await promocoesApi.criar({
        escopo: form.escopo,
        alvo_id: form.escopo === 'global' ? null : form.alvoId,
        tipo_desconto: form.tipoDesconto,
        valor: valorNum,
        descricao: form.descricao.trim() || null,
        data_inicio: new Date(form.dataInicio).toISOString(),
        data_fim: form.semPrazo ? null : new Date(form.dataFim).toISOString(),
      });
      if (!result.success) throw new Error(result.error);
      setIsFormOpen(false);
      await carregar();
      aviso.sucesso('Promoção criada');
    } catch (err: any) {
      setErroForm(err.message || 'Erro ao criar promoção');
    } finally {
      setSalvando(false);
    }
  };

  const alternarAtivo = async (promo: Promocao) => {
    try {
      const result = await promocoesApi.atualizar(promo.id, { ativo: !promo.ativo });
      if (!result.success) throw new Error(result.error);
      await carregar();
    } catch (err: any) {
      aviso.falha(err, 'Erro ao atualizar promoção');
    }
  };

  const confirmarExclusao = async () => {
    if (!itemParaExcluir) return;
    setExcluindo(true);
    try {
      const result = await promocoesApi.excluir(itemParaExcluir.id);
      if (!result.success) throw new Error(result.error);
      setItemParaExcluir(null);
      await carregar();
    } catch (err: any) {
      aviso.falha(err, 'Erro ao excluir promoção');
    } finally {
      setExcluindo(false);
    }
  };

  const inputClass =
    'w-full border rounded-control py-2.5 px-4 text-sm outline-none transition-all focus:ring-2 focus:ring-accent/50 bg-surface-inset border-border-default text-text-primary placeholder:text-text-faint';
  const labelClass = 'text-xs font-semibold uppercase tracking-wider mb-1.5 block text-text-muted';

  const colunas: DataTableColumn<Promocao>[] = [
    {
      key: 'promocao',
      header: 'Promoção',
      render: (p) => (
        <div className="min-w-0">
          <p className="text-sm font-medium text-text-primary truncate">{p.descricao || ESCOPO_LABEL[p.escopo]}</p>
          <p className="text-xs text-text-faint truncate">
            {ESCOPO_LABEL[p.escopo]} · {nomeDoAlvo(p)}
          </p>
        </div>
      ),
    },
    {
      key: 'desconto',
      header: 'Desconto',
      render: (p) => <StatusBadge tom="accent" texto={p.tipo_desconto === 'percentual' ? `-${p.valor}%` : `-${formatCurrency(p.valor)}`} />,
    },
    {
      key: 'janela',
      header: 'Janela',
      render: (p) => (
        <div className="text-xs text-text-secondary">
          <p>{formatDataHora(p.data_inicio)}</p>
          <p className="text-text-faint">até {p.data_fim ? formatDataHora(p.data_fim) : 'sem prazo definido'}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (p) => <StatusBadge tom={STATUS_TOM[statusDaPromocao(p)]} texto={STATUS_LABEL[statusDaPromocao(p)]} />,
    },
    {
      key: 'acoes',
      header: 'Ações',
      align: 'right',
      render: (p) => (
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={() => alternarAtivo(p)}
            title={p.ativo ? 'Encerrar agora' : 'Reativar'}
            className={cn('size-7 flex items-center justify-center rounded-control hover:bg-surface-raised', p.ativo ? 'text-danger' : 'text-positive')}
          >
            {p.ativo ? <Ban size={14} /> : <RotateCcw size={14} />}
          </button>
          <button
            type="button"
            onClick={() => setItemParaExcluir(p)}
            title="Excluir"
            className="size-7 flex items-center justify-center rounded-control text-text-muted hover:bg-surface-raised hover:text-danger"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ];

  function renderMobileCard(p: Promocao) {
    const status = statusDaPromocao(p);
    return (
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-text-primary truncate">{p.descricao || ESCOPO_LABEL[p.escopo]}</p>
          <p className="text-xs text-text-faint truncate">
            {ESCOPO_LABEL[p.escopo]} · {nomeDoAlvo(p)}
          </p>
          <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
            <StatusBadge tom="accent" texto={p.tipo_desconto === 'percentual' ? `-${p.valor}%` : `-${formatCurrency(p.valor)}`} />
            <StatusBadge tom={STATUS_TOM[status]} texto={STATUS_LABEL[status]} />
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => alternarAtivo(p)}
            title={p.ativo ? 'Encerrar agora' : 'Reativar'}
            className={cn('size-7 flex items-center justify-center rounded-control hover:bg-surface-raised', p.ativo ? 'text-danger' : 'text-positive')}
          >
            {p.ativo ? <Ban size={14} /> : <RotateCcw size={14} />}
          </button>
          <button
            type="button"
            onClick={() => setItemParaExcluir(p)}
            title="Excluir"
            className="size-7 flex items-center justify-center rounded-control text-text-muted hover:bg-surface-raised hover:text-danger"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-medium text-text-primary">Promoções</h3>
          <p className="text-sm text-text-faint mt-0.5">Desconto com prazo em uma peça, um modelo, uma categoria ou o estoque inteiro</p>
        </div>
        <button
          onClick={abrirCriar}
          className="h-10 px-5 rounded-control bg-accent text-white text-[11px] font-semibold uppercase tracking-wider shadow-sm flex items-center gap-2 hover:opacity-90 shrink-0"
        >
          <Plus size={16} /> Nova promoção
        </button>
      </div>

      {migracaoPendente ? (
        <div className="rounded-card border border-warning/25 bg-warning-bg/40 p-4">
          <p className="text-sm font-medium text-warning">Promoções ainda não foi ativado neste banco</p>
          <p className="text-xs text-text-secondary mt-1">Rode supabase/migration_018_promocoes.sql no editor SQL do Supabase pra habilitar esta tela.</p>
        </div>
      ) : (
        <>
          {erro && <p className="text-sm text-danger">{erro}</p>}

          <DataTable
            colunas={colunas}
            dados={loading ? [] : promocoes}
            getRowKey={(p) => p.id}
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
                <EmptyState icone={Tag} mensagem="Nenhuma promoção cadastrada ainda." acaoLabel="Criar promoção" onAcao={abrirCriar} />
              )
            }
          />
        </>
      )}

      {isFormOpen && (
        <div className="fixed inset-0 z-[3000] bg-black/70 backdrop-blur-sm flex items-end md:items-center justify-center" onClick={() => setIsFormOpen(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto flex flex-col rounded-t-card md:rounded-card bg-surface-page text-text-primary border border-border-subtle"
          >
            <div className="flex items-center justify-between p-6 border-b border-border-subtle">
              <h2 className="text-lg font-medium">Nova promoção</h2>
              <button onClick={() => setIsFormOpen(false)} className="p-1.5 rounded-full text-text-faint hover:bg-surface-raised">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {erroForm && <p className="text-sm text-danger">{erroForm}</p>}

              <div>
                <label className={labelClass}>Aplicar em</label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(ESCOPO_LABEL) as EscopoPromocao[]).map((escopo) => (
                    <button
                      key={escopo}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, escopo, alvoId: '' }))}
                      className={cn(
                        'py-2.5 rounded-control font-semibold text-xs border transition-all',
                        form.escopo === escopo ? 'bg-accent border-accent text-white' : 'border-border-default text-text-muted hover:border-accent/50 hover:text-accent-soft-fg'
                      )}
                    >
                      {ESCOPO_LABEL[escopo]}
                    </button>
                  ))}
                </div>
              </div>

              {form.escopo === 'peca' && (
                <div>
                  <label className={labelClass}>Peça</label>
                  {pecaSelecionada ? (
                    <div className="flex items-center justify-between gap-3 rounded-control border border-accent/30 bg-accent-soft-bg/30 px-4 py-2.5">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-text-primary truncate">{pecaSelecionada.nome}</p>
                        <p className="text-xs text-text-faint">
                          {pecaSelecionada.codigo} · {formatCurrency(pecaSelecionada.valor)}
                        </p>
                      </div>
                      <button type="button" onClick={() => setForm((f) => ({ ...f, alvoId: '' }))} className="p-1.5 rounded-control text-text-faint hover:bg-surface-raised shrink-0">
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center gap-2 rounded-control border border-border-default bg-surface-inset px-3">
                        <Search size={14} className="text-text-faint shrink-0" />
                        <input
                          value={buscaPeca}
                          onChange={(e) => setBuscaPeca(e.target.value)}
                          placeholder="Buscar peça por nome ou código..."
                          className="flex-1 py-2.5 bg-transparent outline-none text-sm text-text-primary placeholder:text-text-faint"
                        />
                      </div>
                      {resultadosPeca.length > 0 && (
                        <div className="mt-2 rounded-control border border-border-default divide-y divide-border-subtle overflow-hidden">
                          {resultadosPeca.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => {
                                setForm((f) => ({ ...f, alvoId: item.id }));
                                setBuscaPeca('');
                              }}
                              className="w-full text-left px-4 py-2.5 flex items-center justify-between gap-3 text-sm hover:bg-surface-raised"
                            >
                              <div className="min-w-0">
                                <p className="text-text-primary truncate">{item.nome}</p>
                                <p className="text-xs text-text-faint">{item.codigo}</p>
                              </div>
                              <span className="text-text-secondary shrink-0">{formatCurrency(item.valor)}</span>
                            </button>
                          ))}
                        </div>
                      )}
                      {buscaPeca.trim() && resultadosPeca.length === 0 && <p className="text-xs text-text-faint mt-2">Nenhuma peça encontrada.</p>}
                    </div>
                  )}
                </div>
              )}

              {form.escopo === 'modelo_moto' && (
                <div>
                  <label className={labelClass}>Modelo de moto</label>
                  <TreeDropdown
                    variant="form"
                    nodes={modeloNodes}
                    value={form.alvoId}
                    onChange={(id) => setForm((f) => ({ ...f, alvoId: id }))}
                    placeholder="Selecione o modelo..."
                    searchPlaceholder="Buscar moto..."
                  />
                  <p className="text-[11px] text-text-faint mt-1.5">Vale também pra qualquer variação por ano cadastrada abaixo dele.</p>
                </div>
              )}

              {form.escopo === 'categoria' && (
                <div>
                  <label className={labelClass}>Categoria</label>
                  <TreeDropdown
                    variant="form"
                    nodes={categoriaNodes}
                    value={form.alvoId}
                    onChange={(id) => setForm((f) => ({ ...f, alvoId: id }))}
                    placeholder="Selecione a categoria..."
                    searchPlaceholder="Buscar categoria..."
                  />
                  <p className="text-[11px] text-text-faint mt-1.5">Vale também pra qualquer subcategoria abaixo dela.</p>
                </div>
              )}

              {form.escopo === 'global' && <p className="text-xs text-text-faint">O desconto vale pra toda peça em estoque, sem exceção.</p>}

              <div>
                <label className={labelClass}>Tipo de desconto</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, tipoDesconto: 'percentual' }))}
                    className={cn(
                      'py-2.5 rounded-control font-semibold text-xs border transition-all',
                      form.tipoDesconto === 'percentual' ? 'bg-accent border-accent text-white' : 'border-border-default text-text-muted'
                    )}
                  >
                    Percentual (%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, tipoDesconto: 'valor_fixo' }))}
                    className={cn(
                      'py-2.5 rounded-control font-semibold text-xs border transition-all',
                      form.tipoDesconto === 'valor_fixo' ? 'bg-accent border-accent text-white' : 'border-border-default text-text-muted'
                    )}
                  >
                    Valor fixo (R$)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>{form.tipoDesconto === 'percentual' ? 'Desconto (%)' : 'Desconto (R$)'}</label>
                  <input
                    type="number"
                    min="0"
                    step={form.tipoDesconto === 'percentual' ? '1' : '0.01'}
                    max={form.tipoDesconto === 'percentual' ? 100 : undefined}
                    value={form.valor}
                    onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))}
                    placeholder={form.tipoDesconto === 'percentual' ? '10' : '50,00'}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Descrição (opcional)</label>
                  <input
                    value={form.descricao}
                    onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                    placeholder="Ex: Promoção pedaleiras"
                    className={inputClass}
                  />
                </div>
              </div>

              {pecaSelecionada && Number(form.valor) > 0 && (
                <p className="text-xs text-text-faint">
                  {formatCurrency(pecaSelecionada.valor)} →{' '}
                  <span className="text-accent-soft-fg font-medium">
                    {formatCurrency(
                      form.tipoDesconto === 'percentual'
                        ? Math.max(0, pecaSelecionada.valor * (1 - Number(form.valor) / 100))
                        : Math.max(0, pecaSelecionada.valor - Number(form.valor))
                    )}
                  </span>
                </p>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Início</label>
                  <input
                    type="datetime-local"
                    value={form.dataInicio}
                    onChange={(e) => setForm((f) => ({ ...f, dataInicio: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Término</label>
                  <input
                    type="datetime-local"
                    value={form.dataFim}
                    disabled={form.semPrazo}
                    onChange={(e) => setForm((f) => ({ ...f, dataFim: e.target.value }))}
                    className={cn(inputClass, form.semPrazo && 'opacity-50')}
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.semPrazo}
                  onChange={(e) => setForm((f) => ({ ...f, semPrazo: e.target.checked }))}
                  className="size-4 accent-[var(--accent)]"
                />
                Sem prazo definido — só termina quando eu encerrar
              </label>
            </div>

            <div className="flex gap-3 p-6 border-t border-border-subtle">
              <button onClick={() => setIsFormOpen(false)} className="flex-1 py-3 rounded-control font-medium text-sm border border-border-default text-text-secondary hover:bg-surface-raised">
                Cancelar
              </button>
              <button onClick={salvar} disabled={salvando} className="flex-1 py-3 rounded-control font-medium text-sm bg-accent text-white hover:opacity-90 disabled:opacity-50">
                {salvando ? 'Salvando...' : 'Criar promoção'}
              </button>
            </div>
          </div>
        </div>
      )}

      {itemParaExcluir && (
        <div className="fixed inset-0 z-[3000] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setItemParaExcluir(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-card border border-border-subtle bg-surface-page p-6 text-center">
            <h3 className="text-lg font-medium mb-2">Excluir promoção?</h3>
            <p className="text-sm text-text-faint mb-4">{itemParaExcluir.descricao || ESCOPO_LABEL[itemParaExcluir.escopo]} — essa ação não pode ser desfeita.</p>
            <div className="flex gap-3">
              <button onClick={() => setItemParaExcluir(null)} className="flex-1 py-3 rounded-control font-medium text-sm border border-border-default text-text-secondary hover:bg-surface-raised">
                Cancelar
              </button>
              <button onClick={confirmarExclusao} disabled={excluindo} className="flex-1 py-3 rounded-control font-medium text-sm bg-danger text-surface-page hover:opacity-90 disabled:opacity-50">
                {excluindo ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
