import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Loader2, MapPin, Pencil, Plus, Power, Tag, X } from 'lucide-react';
import { Combobox } from '../../components/ui/Combobox';
import type { EstoqueLocal } from '../estoque/types';
import { InventoryDialog } from './InventoryDrawer';
import { enderecosPrateleira, type CategoriaEstoque, type UnidadeEstoque } from './inventoryPreviewModel';

type Prioridade = 1 | 2 | 3;

interface MapProps {
  operacional: boolean;
  /** Permissão `estoque.editar` + conexão confirmada. Sem ela, o mapa é só consulta. */
  podeAlterar: boolean;
  locais: EstoqueLocal[];
  categorias: CategoriaEstoque[];
  categoriasPorSecao: Record<string, string[]>;
  prioridadesPorSecao?: Record<string, Record<string, number>>;
  unidades: UnidadeEstoque[];
  onCriarLocal: (local: Pick<EstoqueLocal, 'codigo' | 'deposito' | 'zona' | 'prateleira' | 'secao' | 'descricao'>) => Promise<void>;
  onAtualizarLocal?: (local: EstoqueLocal, alteracoes: { codigo?: string; descricao?: string | null; ativo?: boolean }) => Promise<void>;
  onAlternarCategoria: (codigo: string, categoriaId: string, adicionar: boolean) => Promise<void> | void;
  onDefinirPrioridade?: (codigo: string, categoriaId: string, prioridade: Prioridade) => Promise<void> | void;
}

const demoLocais: EstoqueLocal[] = enderecosPrateleira.map((item) => {
  const [prateleira, secao] = item.value.split('-');
  return { id: item.value, codigo: item.value, deposito: 'Demonstração', zona: 'Geral', prateleira, secao, descricao: null, ativo: true };
});

function chavePrateleira(local: EstoqueLocal) {
  return `${local.deposito}|${local.zona}|${local.prateleira}`;
}

const inputClass = 'h-11 w-full rounded-control font-normal border border-border-default bg-surface-card px-3 text-base text-text-primary outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 sm:text-sm';
const botaoTexto = 'inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-control px-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 disabled:cursor-not-allowed disabled:opacity-50';
const rotuloPrioridade: Record<Prioridade, string> = { 1: 'Principal', 2: 'Secundária', 3: 'Eventual' };

export function InventoryMap({ operacional, podeAlterar, locais, categorias, categoriasPorSecao, prioridadesPorSecao = {}, unidades, onCriarLocal, onAtualizarLocal, onAlternarCategoria, onDefinirPrioridade }: MapProps) {
  const [mostrarInativos, setMostrarInativos] = useState(false);
  const itens = operacional ? locais.filter((local) => local.ativo || mostrarInativos) : demoLocais;
  const prateleiras = useMemo(() => Array.from(new Map(itens.map((local) => [chavePrateleira(local), local])).entries()), [itens]);
  const [prateleiraSelecionada, setPrateleiraSelecionada] = useState('');
  const [busca, setBusca] = useState('');
  const [editando, setEditando] = useState<string | null>(null);
  const [editandoLocal, setEditandoLocal] = useState<{ id: string; codigo: string; descricao: string } | null>(null);
  const [selecionarCategoria, setSelecionarCategoria] = useState('');
  const [abrirCadastro, setAbrirCadastro] = useState(false);
  const [novo, setNovo] = useState({ codigo: '', deposito: 'Principal', zona: '', prateleira: '', secao: '', descricao: '' });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [erroLocal, setErroLocal] = useState<string | null>(null);
  const [desativar, setDesativar] = useState<EstoqueLocal | null>(null);
  const inativos = operacional ? locais.filter((local) => !local.ativo).length : 0;

  useEffect(() => {
    if (!prateleiras.some(([chave]) => chave === prateleiraSelecionada)) setPrateleiraSelecionada(prateleiras[0]?.[0] ?? '');
  }, [prateleiras, prateleiraSelecionada]);

  const visiveis = itens.filter((local) => {
    const termo = busca.trim().toLocaleLowerCase('pt-BR');
    if (termo) return [local.codigo, local.descricao, local.deposito, local.zona, local.prateleira, local.secao]
      .some((valor) => valor?.toLocaleLowerCase('pt-BR').includes(termo));
    return chavePrateleira(local) === prateleiraSelecionada;
  });

  async function criarLocal() {
    if (salvando) return;
    setSalvando(true); setErro(null);
    try {
      await onCriarLocal(novo);
      setNovo({ codigo: '', deposito: 'Principal', zona: '', prateleira: '', secao: '', descricao: '' });
      setAbrirCadastro(false);
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível cadastrar o local.');
    } finally { setSalvando(false); }
  }

  async function atualizarLocal(local: EstoqueLocal, alteracoes: { codigo?: string; descricao?: string | null; ativo?: boolean }) {
    if (!onAtualizarLocal || salvando) return false;
    setSalvando(true); setErroLocal(null);
    try {
      await onAtualizarLocal(local, alteracoes);
      return true;
    } catch (falha) {
      setErroLocal(falha instanceof Error ? falha.message : 'Não foi possível atualizar o local.');
      return false;
    } finally { setSalvando(false); }
  }

  const unidadesNoLocal = (codigo: string) => unidades.filter((unidade) => unidade.endereco === codigo && unidade.estado !== 'arquivada');
  const podeEditarLocal = operacional && podeAlterar && Boolean(onAtualizarLocal);

  return <section aria-label="Mapa físico do estoque" className="space-y-4">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-[11px] font-bold uppercase tracking-[.12em] text-text-muted">Mapa físico{operacional ? '' : ' · demonstração'}</p><h2 className="mt-1 text-xl font-bold">Encontre a prateleira e suas peças</h2><p className="mt-1 text-sm text-text-muted">Uma seção pode receber várias categorias recomendadas, com prioridade. A categoria não impede exceções.</p></div>
      {operacional && podeAlterar && <button type="button" aria-expanded={abrirCadastro} onClick={() => setAbrirCadastro((valor) => !valor)} className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-control border border-border-default bg-surface-card px-3 text-sm font-semibold text-text-secondary transition hover:border-accent/40 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 active:scale-[.98]"><Plus size={16} />Cadastrar local</button>}
    </header>

    <AnimatePresence initial={false}>{abrirCadastro && <motion.form initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} onSubmit={(event) => { event.preventDefault(); void criarLocal(); }} className="overflow-hidden rounded-card border border-accent/25 bg-accent-soft-bg p-4">
      <h3 className="text-sm font-bold text-accent-soft-fg">Novo endereço físico</h3>
      <p className="mt-1 text-xs text-accent-soft-fg">Cadastre a posição real, com um código curto para etiquetas e busca.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{([
        ['codigo', 'Código curto', 'A-P01-S01'], ['deposito', 'Depósito', 'Principal'], ['zona', 'Zona', 'A'],
        ['prateleira', 'Prateleira', 'P01'], ['secao', 'Seção/posição', 'S01'], ['descricao', 'Descrição opcional', 'Ao lado da entrada'],
      ] as const).map(([chave, label, placeholder]) => <label key={chave} className="text-xs font-semibold text-text-secondary">{label}<input className={`mt-1 ${inputClass}`} value={novo[chave]} placeholder={placeholder} onChange={(event) => setNovo((atual) => ({ ...atual, [chave]: event.target.value }))} /></label>)}</div>
      {erro && <p role="alert" className="mt-3 text-sm text-danger">{erro}</p>}
      <div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => setAbrirCadastro(false)} className="h-11 cursor-pointer rounded-control px-3 text-sm text-text-secondary hover:bg-surface-card">Cancelar</button><button type="submit" disabled={salvando} className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-control bg-accent px-4 text-sm font-semibold text-white transition hover:bg-accent-hover disabled:opacity-60">{salvando && <Loader2 size={16} className="animate-spin" />}{salvando ? 'Salvando…' : 'Salvar local'}</button></div>
    </motion.form>}</AnimatePresence>

    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"><Combobox label="Prateleira" placeholder="Escolha uma prateleira" options={prateleiras.map(([chave, local]) => ({ value: chave, label: `${local.deposito} · Zona ${local.zona} · ${local.prateleira}` }))} value={prateleiraSelecionada} onChange={(valor) => { setPrateleiraSelecionada(valor); setBusca(''); }} size="lg" /><label className="flex flex-col gap-1.5 text-sm font-semibold text-text-secondary">Buscar endereço, zona ou descrição<input type="search" value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Ex.: P01, motor, entrada" className={inputClass} /></label></div>
    {operacional && inativos > 0 && <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm text-text-secondary"><input type="checkbox" className="size-4 accent-[var(--accent)]" checked={mostrarInativos} onChange={(event) => setMostrarInativos(event.target.checked)} />Mostrar {inativos} {inativos === 1 ? 'local desativado' : 'locais desativados'}</label>}
    {erroLocal && <p role="alert" className="rounded-control border border-danger/30 bg-danger-bg p-3 text-sm text-danger">{erroLocal}</p>}

    {!visiveis.length && <div className="rounded-card border border-dashed border-border-default bg-surface-card p-8 text-center text-sm text-text-secondary">{itens.length ? 'Nenhum endereço corresponde à busca.' : operacional && podeAlterar ? 'Nenhum local cadastrado. Use “Cadastrar local” para registrar a primeira prateleira.' : 'Nenhum local cadastrado ainda.'}</div>}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"><AnimatePresence initial={false}>{visiveis.map((local) => {
      const selecionadas = categoriasPorSecao[local.codigo] ?? [];
      const prioridades = prioridadesPorSecao[local.codigo] ?? {};
      const nomes = selecionadas.flatMap((id) => categorias.filter((categoria) => categoria.id === id))
        .sort((a, b) => (prioridades[a.id] ?? 1) - (prioridades[b.id] ?? 1));
      const presentes = unidadesNoLocal(local.codigo);
      const emEdicao = editandoLocal?.id === local.id;
      return <motion.article layout key={local.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className={`min-w-0 rounded-card border bg-surface-card p-4 shadow-sm ${local.ativo ? 'border-border-default' : 'border-dashed border-border-default opacity-80'}`}>
        <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-bold tracking-wide text-accent">{local.codigo}{!local.ativo && <span className="ml-2 rounded-full bg-surface-inset px-2 py-0.5 text-[10px] font-semibold text-text-muted">Desativado</span>}</p><h3 className="mt-1 font-semibold text-text-primary">{local.deposito} · Zona {local.zona}</h3><p className="text-xs text-text-muted">Prateleira {local.prateleira}, seção {local.secao}{local.descricao ? ` · ${local.descricao}` : ''}</p></div><MapPin size={18} className="shrink-0 text-text-faint" /></div>
        <AnimatePresence initial={false}>{emEdicao && editandoLocal && <motion.form initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} onSubmit={async (event) => { event.preventDefault(); if (await atualizarLocal(local, { codigo: editandoLocal.codigo, descricao: editandoLocal.descricao || null })) setEditandoLocal(null); }} className="mt-3 space-y-2 overflow-hidden border-t border-border-subtle pt-3">
          <label className="block text-xs font-semibold text-text-secondary">Código curto<input className={`mt-1 ${inputClass}`} value={editandoLocal.codigo} onChange={(event) => setEditandoLocal({ ...editandoLocal, codigo: event.target.value })} /></label>
          <label className="block text-xs font-semibold text-text-secondary">Descrição<input className={`mt-1 ${inputClass}`} value={editandoLocal.descricao} onChange={(event) => setEditandoLocal({ ...editandoLocal, descricao: event.target.value })} placeholder="Ex.: ao lado da entrada" /></label>
          <div className="flex justify-end gap-2"><button type="button" onClick={() => setEditandoLocal(null)} className="h-11 cursor-pointer rounded-control px-3 text-sm text-text-secondary hover:bg-surface-inset">Cancelar</button><button type="submit" disabled={salvando} className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-control border border-accent/40 bg-accent-soft-bg px-3 text-sm font-semibold text-accent-soft-fg transition hover:border-accent disabled:opacity-60">{salvando && <Loader2 size={14} className="animate-spin" />}Salvar local</button></div>
        </motion.form>}</AnimatePresence>
        <ul aria-label={`Categorias recomendadas de ${local.codigo}`} className="mt-3 flex flex-wrap gap-1.5">{nomes.map((categoria) => {
          const prioridade = (prioridades[categoria.id] ?? 1) as Prioridade;
          return <li key={categoria.id} className="inline-flex items-center gap-1 rounded-full bg-accent-soft-bg py-0.5 pl-2.5 pr-0.5 text-[11px] font-semibold text-accent-soft-fg">
            <span>{categoria.nome}</span>
            {operacional && <span className="rounded-full bg-surface-card px-1.5 py-0.5 text-[10px] font-semibold text-text-muted">{rotuloPrioridade[prioridade]}</span>}
            {editando === local.id && <button type="button" aria-label={`Remover ${categoria.nome} de ${local.codigo}`} onClick={() => void onAlternarCategoria(local.codigo, categoria.id, false)} className="grid size-11 -my-3 cursor-pointer place-items-center rounded-full text-accent-soft-fg transition hover:bg-danger-bg hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/30"><X size={14} /></button>}
          </li>;
        })}{!nomes.length && <li className="text-xs text-text-faint">Sem categoria recomendada</li>}</ul>
        <p className="mt-3 text-xs text-text-secondary"><strong className="text-sm text-text-primary">{presentes.length}</strong> {presentes.length === 1 ? 'unidade' : 'unidades'} neste endereço</p>
        {presentes.slice(0, 4).map((unidade) => <span key={unidade.id} className="mt-1 block truncate rounded-control bg-surface-inset px-2 py-1 text-xs font-semibold text-text-secondary">{unidade.sku}{unidade.estado === 'reservada' ? ' · reservada' : ''}</span>)}
        {(podeAlterar || !operacional) && <div className="mt-2 flex flex-wrap items-center gap-1">
          <button type="button" aria-expanded={editando === local.id} onClick={() => { setEditando(editando === local.id ? null : local.id); setSelecionarCategoria(''); }} className={`${botaoTexto} text-accent hover:bg-accent-soft-bg`}><Tag size={14} />{editando === local.id ? 'Fechar categorias' : 'Designar categorias'}</button>
          {podeEditarLocal && local.ativo && !emEdicao && <button type="button" onClick={() => setEditandoLocal({ id: local.id, codigo: local.codigo, descricao: local.descricao ?? '' })} className={`${botaoTexto} text-text-secondary hover:bg-surface-inset`}><Pencil size={14} />Editar local</button>}
          {podeEditarLocal && (local.ativo
            ? <button type="button" onClick={() => setDesativar(local)} className={`${botaoTexto} text-danger hover:bg-danger-bg`}><Power size={14} />Desativar</button>
            : <button type="button" disabled={salvando} onClick={() => void atualizarLocal(local, { ativo: true })} className={`${botaoTexto} text-positive hover:bg-positive-bg`}><Power size={14} />Reativar</button>)}
        </div>}
        <AnimatePresence initial={false}>{editando === local.id && <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-visible border-t border-border-subtle pt-3">
          <Combobox label="Adicionar categoria" placeholder="Busque entre todas as categorias" options={categorias.filter((categoria) => !selecionadas.includes(categoria.id)).map((categoria) => ({ value: categoria.id, label: categoria.nome }))} value={selecionarCategoria} onChange={(id) => { setSelecionarCategoria(''); void onAlternarCategoria(local.codigo, id, true); }} size="lg" />
          {operacional && onDefinirPrioridade && nomes.length > 0 && <fieldset className="mt-3 space-y-2"><legend className="text-xs font-semibold text-text-secondary">Prioridade de cada categoria</legend>{nomes.map((categoria) => {
            const atual = (prioridades[categoria.id] ?? 1) as Prioridade;
            return <div key={categoria.id} className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs text-text-primary">{categoria.nome}</span><div role="radiogroup" aria-label={`Prioridade de ${categoria.nome} em ${local.codigo}`} className="flex rounded-control border border-border-default p-0.5">{([1, 2, 3] as const).map((nivel) => <button key={nivel} type="button" role="radio" aria-checked={atual === nivel} onClick={() => { if (atual !== nivel) void onDefinirPrioridade(local.codigo, categoria.id, nivel); }} className={`min-h-9 cursor-pointer rounded-[6px] px-2.5 text-[11px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 ${atual === nivel ? 'bg-accent-soft-bg text-accent-soft-fg' : 'text-text-muted hover:text-text-primary'}`}>{rotuloPrioridade[nivel]}</button>)}</div></div>;
          })}</fieldset>}
          <p className="mt-2 text-xs text-text-muted">Use a busca para encontrar a categoria. Você pode designar várias e remover uma pelo ×.</p>
        </motion.div>}</AnimatePresence>
      </motion.article>;
    })}</AnimatePresence></div>

    <InventoryDialog isOpen={Boolean(desativar)} onClose={() => setDesativar(null)} eyebrow="Mapa físico" title={desativar ? `Desativar ${desativar.codigo}?` : 'Desativar local'}
      description={desativar && (unidadesNoLocal(desativar.codigo).length
        ? <>Este local ainda guarda <strong>{unidadesNoLocal(desativar.codigo).length}</strong> {unidadesNoLocal(desativar.codigo).length === 1 ? 'unidade' : 'unidades'}. Mova-as para outro endereço antes de desativar — nenhuma peça pode ficar apontando para um local escondido.</>
        : <>O local deixa de aparecer nas opções de cadastro e organização. O histórico continua preservado e você pode reativá-lo depois.</>)}
      footer={<>
        <button type="button" onClick={() => setDesativar(null)} className="h-11 cursor-pointer rounded-control px-3 text-sm font-medium text-text-secondary hover:bg-surface-inset">{desativar && unidadesNoLocal(desativar.codigo).length ? 'Entendi' : 'Cancelar'}</button>
        {desativar && !unidadesNoLocal(desativar.codigo).length && <button type="button" disabled={salvando} onClick={async () => { if (desativar && await atualizarLocal(desativar, { ativo: false })) setDesativar(null); }} className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-control bg-danger px-4 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60">{salvando && <Loader2 size={16} className="animate-spin" />}Desativar local</button>}
      </>}>
      {desativar && unidadesNoLocal(desativar.codigo).length > 0 && <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto overscroll-contain">{unidadesNoLocal(desativar.codigo).map((unidade) => <li key={unidade.id} className="rounded-control bg-surface-inset px-2 py-1 text-xs font-semibold text-text-secondary">{unidade.sku}</li>)}</ul>}
    </InventoryDialog>
  </section>;
}
