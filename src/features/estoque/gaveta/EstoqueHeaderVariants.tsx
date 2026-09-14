import { useState } from 'react';
import { Box, Bike, Network, Package, Plus, SlidersHorizontal } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { Button } from '../../../components/ui/button';
import { cn } from '../../../utils';
import { Tabs, TabsList, TabsTrigger } from '../../../components/animate-ui/components/animate/tabs';
import { AnimatedBackground } from '../../../components/animate-ui/primitives/effects/animated-background';
import { BorderTrail } from '../../../components/animate-ui/primitives/effects/border-trail';
import { Magnetic } from '../../../components/animate-ui/primitives/effects/magnetic';
import { Popover, PopoverContent, PopoverTrigger } from '../../../components/animate-ui/components/radix/popover';

export type EstoqueViewId = 'gavetas' | 'lista' | 'por_moto' | 'organograma';

export interface EstoqueHeaderProps {
  resumo?: { itens: number; valorTotal: number; semValor: number };
  visualizacao: EstoqueViewId;
  onVisualizacaoChange: (valor: EstoqueViewId) => void;
  onNovaGaveta: () => void;
}

const views = [
  { id: 'gavetas' as const, label: 'Gavetas', Icon: Box },
  { id: 'lista' as const, label: 'Lista', Icon: Package },
  { id: 'por_moto' as const, label: 'Por moto', Icon: Bike },
  { id: 'organograma' as const, label: 'Organograma', Icon: Network },
];

const moeda = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n || 0);

function Title({ resumo, compact = false }: { resumo?: EstoqueHeaderProps['resumo']; compact?: boolean }) {
  return <div className="min-w-0"><h1 className={cn('font-bold text-text-primary', compact ? 'text-lg' : 'text-xl')}>Estoque</h1>{!!resumo?.itens && <p className="mt-0.5 truncate text-xs text-text-faint">Hoje: {resumo.itens} {resumo.itens === 1 ? 'peça' : 'peças'} · {moeda(resumo.valorTotal)}</p>}</div>;
}

function Nova({ onClick }: { onClick: () => void }) {
  return <Button variant="accent-cta" size="sm" onClick={onClick}><Plus size={15} /> Nova Gaveta</Button>;
}

function UnderlineNav({ value, onChange }: { value: EstoqueViewId; onChange: (v: EstoqueViewId) => void }) {
  return <div className="max-w-full overflow-x-auto scrollbar-none"><Tabs value={value} onValueChange={(v) => onChange(v as EstoqueViewId)}><TabsList variant="underline" className="min-w-max">{views.map(({ id, label, Icon }) => <TabsTrigger key={id} value={id} className="h-10 rounded-none px-1 text-xs font-semibold"><Icon size={14} />{label}</TabsTrigger>)}</TabsList></Tabs></div>;
}

export function EstoqueHeaderTrilho(props: EstoqueHeaderProps) {
  return <header className="space-y-2 border-b border-border-subtle pb-1"><div className="flex items-center justify-between gap-3"><Title resumo={props.resumo} /><Nova onClick={props.onNovaGaveta} /></div><UnderlineNav value={props.visualizacao} onChange={props.onVisualizacaoChange} /></header>;
}

export function EstoqueHeaderDock(props: EstoqueHeaderProps) {
  const reduce = useReducedMotion();
  return <header className="space-y-3 border-b border-border-subtle pb-3"><div className="flex items-center justify-between gap-3"><Title resumo={props.resumo} compact /><Nova onClick={props.onNovaGaveta} /></div><div className="flex w-full gap-1 overflow-x-auto rounded-control bg-surface-inset p-1 scrollbar-none"><AnimatedBackground defaultValue={props.visualizacao} onValueChange={(v) => v && props.onVisualizacaoChange(v as EstoqueViewId)} className="rounded-control border border-border-default bg-surface-overlay" transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 32 }}>{views.map(({ id, label, Icon }) => <button data-id={id} key={id} type="button" aria-label={label} className="min-w-10 flex-1"><span className="flex h-9 items-center justify-center gap-1.5 px-2 text-xs font-semibold text-text-muted"><Icon size={15} /><span className={cn(props.visualizacao === id ? 'inline' : 'hidden sm:inline')}>{label}</span></span></button>)}</AnimatedBackground></div></header>;
}

export function EstoqueHeaderComando(props: EstoqueHeaderProps) {
  const ativa = views.find((v) => v.id === props.visualizacao)!;
  return <header className="flex items-center justify-between gap-3 border-b border-border-subtle pb-3"><Title resumo={props.resumo} /><div className="flex items-center gap-2"><Popover><PopoverTrigger asChild><button type="button" className="flex h-8 items-center gap-1.5 rounded-control border border-border-default bg-surface-inset px-2.5 text-xs font-semibold text-text-secondary"><ativa.Icon size={14} />{ativa.label}<SlidersHorizontal size={13} /></button></PopoverTrigger><PopoverContent align="end" className="w-52 p-1.5">{views.map(({ id, label, Icon }) => <button key={id} type="button" onClick={() => props.onVisualizacaoChange(id)} className={cn('flex h-10 w-full items-center gap-2 rounded-control px-3 text-sm', id === props.visualizacao ? 'bg-surface-overlay text-text-primary' : 'text-text-muted hover:bg-surface-raised')}><Icon size={15} />{label}</button>)}</PopoverContent></Popover><Magnetic strength={0.18} range={70} onlyOnHover><Nova onClick={props.onNovaGaveta} /></Magnetic></div></header>;
}

export function EstoqueHeaderControle(props: EstoqueHeaderProps) {
  return <header className="relative overflow-hidden rounded-card border border-border-default bg-surface-card p-3"><BorderTrail size={48} className="bg-accent" transition={{ duration: 7, repeat: Infinity, ease: 'linear' }} /><div className="flex items-center justify-between gap-3"><Title resumo={props.resumo} /><Nova onClick={props.onNovaGaveta} /></div><div className="mt-3 grid grid-cols-4 gap-1 border-t border-border-subtle pt-2">{views.map(({ id, label, Icon }) => <button key={id} type="button" onClick={() => props.onVisualizacaoChange(id)} className={cn('flex min-w-0 flex-col items-center gap-1 rounded-control py-2 text-[10px] font-semibold transition-colors', id === props.visualizacao ? 'bg-accent-soft text-accent-soft-fg' : 'text-text-muted hover:bg-surface-raised')}><Icon size={15} /><span className="max-w-full truncate">{label}</span></button>)}</div></header>;
}

export function EstoqueHeaderEditorial(props: EstoqueHeaderProps) {
  return <header className="border-y border-border-subtle py-3"><div className="flex items-end justify-between gap-3"><div><p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-accent">Controle de peças</p><Title resumo={props.resumo} /></div><Nova onClick={props.onNovaGaveta} /></div><div className="mt-3 flex gap-5 overflow-x-auto scrollbar-none">{views.map(({ id, label }) => <button key={id} type="button" onClick={() => props.onVisualizacaoChange(id)} className={cn('relative h-8 shrink-0 text-xs font-semibold', id === props.visualizacao ? 'text-text-primary' : 'text-text-faint')}><span>{label}</span>{id === props.visualizacao && <motion.span layoutId="editorial-view" className="absolute inset-x-0 bottom-0 h-px bg-accent" />}</button>)}</div></header>;
}

const variants = [
  { nome: 'Trilho', Component: EstoqueHeaderTrilho },
  { nome: 'Dock', Component: EstoqueHeaderDock },
  { nome: 'Comando', Component: EstoqueHeaderComando },
  { nome: 'Controle', Component: EstoqueHeaderControle },
  { nome: 'Editorial', Component: EstoqueHeaderEditorial },
];

export function EstoqueHeaderGallery(props: EstoqueHeaderProps) {
  const [opcao, setOpcao] = useState(0);
  const Ativa = variants[opcao].Component;
  return <section aria-label="Comparação de cabeçalhos" className="space-y-3"><div className="flex items-center justify-between gap-3"><p className="text-[10px] font-semibold uppercase tracking-wider text-text-faint">Comparar cabeçalhos</p><p className="text-xs font-semibold text-text-secondary">{String(opcao + 1).padStart(2, '0')} · {variants[opcao].nome}</p></div><div className="flex gap-1" aria-label="Escolher alternativa">{variants.map((variant, index) => <button key={variant.nome} type="button" aria-label={`Opção ${index + 1}: ${variant.nome}`} onClick={() => setOpcao(index)} className={cn('h-7 flex-1 rounded-control text-[10px] font-bold transition-colors', opcao === index ? 'bg-accent text-white' : 'bg-surface-inset text-text-muted hover:text-text-primary')}>{String(index + 1).padStart(2, '0')}</button>)}</div><motion.div key={opcao} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}><Ativa {...props} /></motion.div></section>;
}
