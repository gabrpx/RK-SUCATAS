import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { MapPin, Plus, Tag, X } from 'lucide-react';
import { Combobox } from '../../components/ui/Combobox';
import type { EstoqueLocal } from '../estoque/types';
import { enderecosPrateleira, type CategoriaEstoque, type UnidadeEstoque } from './inventoryPreviewModel';

interface MapProps {
  operacional: boolean;
  locais: EstoqueLocal[];
  categorias: CategoriaEstoque[];
  categoriasPorSecao: Record<string, string[]>;
  unidades: UnidadeEstoque[];
  onCriarLocal: (local: Pick<EstoqueLocal, 'codigo' | 'deposito' | 'zona' | 'prateleira' | 'secao' | 'descricao'>) => Promise<void>;
  onAlternarCategoria: (codigo: string, categoriaId: string, adicionar: boolean) => Promise<void> | void;
}

const demoLocais: EstoqueLocal[] = enderecosPrateleira.map((item) => {
  const [prateleira, secao] = item.value.split('-');
  return { id: item.value, codigo: item.value, deposito: 'Demonstração', zona: 'Geral', prateleira, secao, descricao: null, ativo: true };
});

function chavePrateleira(local: EstoqueLocal) {
  return `${local.deposito}|${local.zona}|${local.prateleira}`;
}

const inputClass = 'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100';

export function InventoryMap({ operacional, locais, categorias, categoriasPorSecao, unidades, onCriarLocal, onAlternarCategoria }: MapProps) {
  const itens = operacional ? locais.filter((local) => local.ativo) : demoLocais;
  const prateleiras = useMemo(() => Array.from(new Map(itens.map((local) => [chavePrateleira(local), local])).entries()), [itens]);
  const [prateleiraSelecionada, setPrateleiraSelecionada] = useState('');
  const [busca, setBusca] = useState('');
  const [editando, setEditando] = useState<string | null>(null);
  const [selecionarCategoria, setSelecionarCategoria] = useState('');
  const [abrirCadastro, setAbrirCadastro] = useState(false);
  const [novo, setNovo] = useState({ codigo: '', deposito: 'Principal', zona: '', prateleira: '', secao: '', descricao: '' });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

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

  return <section aria-label="Mapa físico do estoque" className="space-y-4">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-[11px] font-bold uppercase tracking-[.12em] text-slate-500">Mapa físico{operacional ? '' : ' · demonstração'}</p><h2 className="mt-1 text-xl font-bold">Encontre a prateleira e suas peças</h2><p className="mt-1 text-sm text-slate-500">Uma seção pode receber várias categorias recomendadas. A categoria não impede exceções.</p></div>
      {operacional && <button type="button" onClick={() => setAbrirCadastro((valor) => !valor)} className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-700"><Plus size={16} />Cadastrar local</button>}
    </header>

    <AnimatePresence initial={false}>{abrirCadastro && <motion.form initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} onSubmit={(event) => { event.preventDefault(); void criarLocal(); }} className="overflow-hidden rounded-xl border border-blue-200 bg-blue-50 p-4">
      <h3 className="text-sm font-bold text-blue-900">Novo endereço físico</h3>
      <p className="mt-1 text-xs text-blue-800">Cadastre a posição real, com um código curto para etiquetas e busca.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{([
        ['codigo', 'Código curto', 'A-P01-S01'], ['deposito', 'Depósito', 'Principal'], ['zona', 'Zona', 'A'],
        ['prateleira', 'Prateleira', 'P01'], ['secao', 'Seção/posição', 'S01'], ['descricao', 'Descrição opcional', 'Ao lado da entrada'],
      ] as const).map(([chave, label, placeholder]) => <label key={chave} className="text-xs font-semibold text-slate-700">{label}<input className={`mt-1 ${inputClass}`} value={novo[chave]} placeholder={placeholder} onChange={(event) => setNovo((atual) => ({ ...atual, [chave]: event.target.value }))} /></label>)}</div>
      {erro && <p role="alert" className="mt-3 text-sm text-red-700">{erro}</p>}
      <div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => setAbrirCadastro(false)} className="rounded-lg px-3 py-2 text-sm text-slate-600">Cancelar</button><button type="submit" disabled={salvando} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{salvando ? 'Salvando…' : 'Salvar local'}</button></div>
    </motion.form>}</AnimatePresence>

    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"><Combobox label="Prateleira" placeholder="Escolha uma prateleira" options={prateleiras.map(([chave, local]) => ({ value: chave, label: `${local.deposito} · Zona ${local.zona} · ${local.prateleira}` }))} value={prateleiraSelecionada} onChange={(valor) => { setPrateleiraSelecionada(valor); setBusca(''); }} /><label className="text-xs font-medium text-slate-600">Buscar endereço, zona ou descrição<input type="search" value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Ex.: P01, motor, entrada" className={`mt-1.5 ${inputClass}`} /></label></div>

    {!visiveis.length && <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600">{itens.length ? 'Nenhum endereço corresponde à busca.' : 'Nenhum local cadastrado. Cadastre a primeira prateleira acima.'}</div>}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{visiveis.map((local) => {
      const selecionadas = categoriasPorSecao[local.codigo] ?? [];
      const nomes = selecionadas.flatMap((id) => categorias.filter((categoria) => categoria.id === id));
      const presentes = unidades.filter((unidade) => unidade.endereco === local.codigo && unidade.estado !== 'arquivada');
      return <article key={local.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3"><div><p className="font-mono text-xs font-bold tracking-wide text-blue-700">{local.codigo}</p><h3 className="mt-1 font-semibold text-slate-900">{local.deposito} · Zona {local.zona}</h3><p className="text-xs text-slate-500">Prateleira {local.prateleira}, seção {local.secao}{local.descricao ? ` · ${local.descricao}` : ''}</p></div><MapPin size={18} className="text-slate-400" /></div>
        <div className="mt-3 flex flex-wrap gap-1.5">{nomes.map((categoria) => <span key={categoria.id} className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-800">{categoria.nome}{editando === local.id && <button type="button" aria-label={`Remover ${categoria.nome} de ${local.codigo}`} onClick={() => void onAlternarCategoria(local.codigo, categoria.id, false)}><X size={12} /></button>}</span>)}{!nomes.length && <span className="text-xs text-slate-400">Sem categoria recomendada</span>}</div>
        <p className="mt-3 text-xs text-slate-600">{presentes.length} {presentes.length === 1 ? 'unidade' : 'unidades'} neste endereço</p>
        {presentes.slice(0, 4).map((unidade) => <span key={unidade.id} className="mt-1 block truncate rounded-lg bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700">{unidade.sku}</span>)}
        <button type="button" onClick={() => { setEditando(editando === local.id ? null : local.id); setSelecionarCategoria(''); }} className="mt-3 inline-flex min-h-10 items-center gap-2 text-xs font-semibold text-blue-700"><Tag size={14} />{editando === local.id ? 'Fechar categorias' : 'Designar categorias'}</button>
        <AnimatePresence initial={false}>{editando === local.id && <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-visible border-t border-slate-100 pt-3"><Combobox label="Adicionar categoria" placeholder="Busque entre todas as categorias" options={categorias.filter((categoria) => !selecionadas.includes(categoria.id)).map((categoria) => ({ value: categoria.id, label: categoria.nome }))} value={selecionarCategoria} onChange={(id) => { setSelecionarCategoria(''); void onAlternarCategoria(local.codigo, id, true); }} /><p className="mt-2 text-xs text-slate-500">Use a busca para encontrar a categoria. Você pode designar várias e remover uma pelo ×.</p></motion.div>}</AnimatePresence>
      </article>;
    })}</div>
  </section>;
}
