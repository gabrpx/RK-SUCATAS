import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowUpRight, Command, FileSearch, Layers3, Package, Search, ShoppingCart, X } from "lucide-react";
import { useData } from "../context/DataContext";
import { cn, formatDateRelative } from "../utils";
import type { Estoque } from "../features/estoque/types";
import type { Venda } from "../features/vendas/types";
import { buildGlobalSearchResults, getSearchResultCounts, type GlobalSearchFilter, type GlobalSearchResult } from "./globalSearchModel";

interface GlobalSearchProps {
  theme: "light" | "dark";
  onSelectItem: (item: Estoque | Venda) => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  customClick?: () => void;
}

const FILTERS: Array<{ id: GlobalSearchFilter; label: string; icon: typeof Layers3 }> = [
  { id: "todos", label: "Todos", icon: Layers3 },
  { id: "estoque", label: "Estoque", icon: Package },
  { id: "tarefas", label: "Tarefas", icon: Command },
  { id: "vendas", label: "Vendas", icon: ShoppingCart },
];

const GROUP_LABEL: Record<GlobalSearchResult["kind"], string> = { estoque: "Estoque", tarefa: "Tarefas", venda: "Vendas" };

function ResultIcon({ kind }: { kind: GlobalSearchResult["kind"] }) {
  const Icon = kind === "estoque" ? Package : kind === "venda" ? ShoppingCart : Command;
  return <Icon size={17} strokeWidth={1.8} />;
}

function resultValue(result: GlobalSearchResult) {
  if (result.kind === "tarefa") return "Abrir fila";
  const value = result.kind === "estoque" ? result.data.valor : result.data.valor_total;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value));
}

function belongsToFilter(result: GlobalSearchResult, filter: GlobalSearchFilter) {
  if (filter === "todos") return true;
  if (filter === "tarefas") return result.kind === "tarefa";
  if (filter === "estoque") return result.kind === "estoque";
  return result.kind === "venda";
}

export const GlobalSearch: React.FC<GlobalSearchProps> = ({ theme, onSelectItem, isOpen, setIsOpen, customClick }) => {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<GlobalSearchFilter>("todos");
  const [activeIndex, setActiveIndex] = useState(0);
  const [shouldLockScroll, setShouldLockScroll] = useState(isOpen);
  const inputRef = useRef<HTMLInputElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const shouldReduceMotion = useReducedMotion();
  const { estoque, vendas, loading } = useData();

  const allResults = useMemo(() => buildGlobalSearchResults({ estoque, vendas, query, filter: "todos" }), [estoque, query, vendas]);
  const counts = useMemo(() => getSearchResultCounts(allResults), [allResults]);
  const visibleResults = useMemo(() => allResults.filter((result) => belongsToFilter(result, filter)), [allResults, filter]);
  const groupedResults = useMemo(() => visibleResults.reduce<Record<GlobalSearchResult["kind"], GlobalSearchResult[]>>((groups, result) => {
    groups[result.kind].push(result);
    return groups;
  }, { estoque: [], tarefa: [], venda: [] }), [visibleResults]);

  useEffect(() => {
    if (!isOpen) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    setShouldLockScroll(true);
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }, [isOpen]);

  useEffect(() => {
    if (!shouldLockScroll) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [shouldLockScroll]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (!isOpen) setIsOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, setIsOpen]);

  useEffect(() => { setActiveIndex(0); }, [filter, query]);

  useEffect(() => {
    if (!isOpen) return;
    const activeResult = visibleResults[activeIndex];
    if (!activeResult) return;
    document
      .getElementById(`global-search-result-${activeResult.kind}-${activeResult.id}`)
      ?.scrollIntoView({ block: "nearest", behavior: shouldReduceMotion ? "auto" : "smooth" });
  }, [activeIndex, isOpen, shouldReduceMotion, visibleResults]);

  const close = () => {
    setIsOpen(false);
    setQuery("");
    setFilter("todos");
  };

  const selectResult = (result: GlobalSearchResult) => {
    if (result.kind === "tarefa") {
      window.location.assign("/tarefas");
      return;
    }
    onSelectItem(result.data as Estoque | Venda);
    close();
  };

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") { event.preventDefault(); close(); return; }
    if (event.key === "ArrowDown") { event.preventDefault(); setActiveIndex((current) => Math.min(current + 1, visibleResults.length - 1)); return; }
    if (event.key === "ArrowUp") { event.preventDefault(); setActiveIndex((current) => Math.max(current - 1, 0)); return; }
    if (event.key === "Enter" && visibleResults[activeIndex]) { event.preventDefault(); selectResult(visibleResults[activeIndex]); }
  };

  const palette = (
    <AnimatePresence initial={false} onExitComplete={() => {
      setShouldLockScroll(false);
      previousFocusRef.current?.focus?.();
    }}>
      {isOpen && (
        <motion.div role="presentation" className="fixed inset-0 z-[9999] grid place-items-center bg-slate-950/45 p-3 backdrop-blur-sm sm:p-6" initial={shouldReduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={shouldReduceMotion ? undefined : { opacity: 0 }} onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
          <motion.section role="dialog" aria-modal="true" aria-labelledby="global-search-title" initial={shouldReduceMotion ? false : { opacity: 0, y: 16, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={shouldReduceMotion ? undefined : { opacity: 0, y: 12, scale: 0.985 }} transition={{ type: "spring", stiffness: 420, damping: 34, mass: 0.76 }} layout="size" className={cn("flex w-full max-w-3xl max-h-[calc(100dvh-1.5rem)] flex-col overflow-hidden rounded-2xl border shadow-[0_28px_90px_rgba(15,23,42,0.3)]", theme === "dark" ? "border-zinc-700 bg-zinc-950 text-zinc-100" : "border-slate-200 bg-white text-slate-900")}>
            <header className={cn("border-b px-4 py-4 sm:px-5", theme === "dark" ? "border-zinc-800" : "border-slate-200")}>
              <div className="flex items-center gap-3"><span className={cn("grid size-9 place-items-center rounded-xl", theme === "dark" ? "bg-indigo-400/10 text-indigo-300" : "bg-indigo-50 text-indigo-600")}><Search size={18} /></span><div className="min-w-0 flex-1"><p className={cn("font-mono text-[10px] font-semibold uppercase tracking-[0.16em]", theme === "dark" ? "text-zinc-500" : "text-slate-400")}>Busca global</p><h2 id="global-search-title" className="text-base font-semibold tracking-tight">Encontre e abra o próximo contexto</h2></div><button type="button" aria-label="Fechar busca global" onClick={close} className={cn("rounded-lg p-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500", theme === "dark" ? "text-zinc-400 hover:bg-white/10 hover:text-white" : "text-slate-400 hover:bg-slate-100 hover:text-slate-700")}><X size={18} /></button></div>
              <div className="relative mt-4"><Search className={cn("pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2", theme === "dark" ? "text-zinc-500" : "text-slate-400")} /><input ref={inputRef} role="combobox" aria-autocomplete="list" aria-controls="global-search-results" aria-activedescendant={visibleResults[activeIndex] ? `global-search-result-${visibleResults[activeIndex].kind}-${visibleResults[activeIndex].id}` : undefined} value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={handleInputKeyDown} placeholder="Buscar peça, código, cliente, venda ou tarefa…" className={cn("h-11 w-full rounded-xl border pl-10 pr-20 text-sm outline-none transition-colors focus:ring-2 focus:ring-indigo-500/25", theme === "dark" ? "border-zinc-800 bg-zinc-900 text-zinc-100 placeholder:text-zinc-600 focus:border-indigo-400" : "border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500")} /><kbd className={cn("pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border px-1.5 py-0.5 font-mono text-[10px]", theme === "dark" ? "border-zinc-700 text-zinc-500" : "border-slate-200 text-slate-400")}>ESC</kbd></div>
              <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:thin] [scrollbar-color:rgb(165_180_252)_transparent] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-indigo-300 [&::-webkit-scrollbar-track]:bg-transparent">{FILTERS.map(({ id, label, icon: Icon }) => <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)} className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500", filter === id ? (theme === "dark" ? "border-indigo-300/35 bg-indigo-300/10 text-indigo-200" : "border-indigo-200 bg-indigo-50 text-indigo-700") : (theme === "dark" ? "border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300" : "border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700"))}><Icon size={13} /> {label} <span className="font-mono text-[10px] opacity-75">{counts[id]}</span></button>)}</div>
            </header>
            <motion.div id="global-search-results" role="listbox" aria-label="Resultados da busca global" layout="size" className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4 [scrollbar-color:rgb(129_140_248)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-indigo-400/75 [&::-webkit-scrollbar-thumb:hover]:bg-indigo-500 [&::-webkit-scrollbar-track]:bg-transparent" onWheel={(event) => event.stopPropagation()} onTouchMove={(event) => event.stopPropagation()}>
              {loading && visibleResults.length === 0 ? <div className={cn("grid min-h-40 place-items-center text-sm", theme === "dark" ? "text-zinc-500" : "text-slate-500")}><span className="inline-flex items-center gap-2"><span className="size-2 animate-pulse rounded-full bg-indigo-500" /> Atualizando dados operacionais…</span></div> : visibleResults.length === 0 ? <div className={cn("grid min-h-48 place-items-center rounded-xl border border-dashed p-6 text-center", theme === "dark" ? "border-zinc-800 text-zinc-500" : "border-slate-200 text-slate-500")}><div><FileSearch className="mx-auto mb-3 text-indigo-400" size={28} /><p className="font-medium">Nenhum contexto encontrado</p><p className="mt-1 text-xs">Tente outro termo ou filtre por um domínio diferente.</p></div></div> : <AnimatePresence initial={false} mode="popLayout">{(["tarefa", "estoque", "venda"] as const).map((kind) => {
                const results = groupedResults[kind];
                if (!results.length) return null;
                return <motion.section key={kind} layout="position" initial={shouldReduceMotion ? false : { opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={shouldReduceMotion ? undefined : { opacity: 0, y: -4 }} className="mb-4 last:mb-0"><p className={cn("mb-2 px-1 font-mono text-[10px] font-semibold uppercase tracking-[0.14em]", theme === "dark" ? "text-zinc-500" : "text-slate-400")}>{GROUP_LABEL[kind]}</p><div className="space-y-1.5">{results.map((result) => {
                  const index = visibleResults.indexOf(result);
                  const isActive = index === activeIndex;
                  return <button key={`${result.kind}-${result.id}`} id={`global-search-result-${result.kind}-${result.id}`} type="button" role="option" aria-selected={isActive} onMouseEnter={() => setActiveIndex(index)} onClick={() => selectResult(result)} className={cn("flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500", isActive ? (theme === "dark" ? "border-indigo-300/35 bg-indigo-300/10" : "border-indigo-200 bg-indigo-50") : (theme === "dark" ? "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"))}><span className={cn("grid size-9 shrink-0 place-items-center rounded-lg", result.kind === "tarefa" ? (theme === "dark" ? "bg-violet-400/10 text-violet-300" : "bg-violet-50 text-violet-600") : result.kind === "venda" ? (theme === "dark" ? "bg-emerald-400/10 text-emerald-300" : "bg-emerald-50 text-emerald-600") : (theme === "dark" ? "bg-amber-300/10 text-amber-200" : "bg-amber-50 text-amber-700"))}><ResultIcon kind={result.kind} /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{result.label}</span><span className={cn("mt-0.5 block truncate text-xs", theme === "dark" ? "text-zinc-500" : "text-slate-500")}>{result.kind === "venda" ? `${result.description} · ${formatDateRelative(result.data.data)}` : result.description}</span></span><span className={cn("shrink-0 text-right text-xs font-semibold", result.kind === "tarefa" ? (theme === "dark" ? "text-violet-200" : "text-violet-700") : "text-emerald-500")}>{resultValue(result)}{result.kind === "tarefa" && <ArrowUpRight className="ml-1 inline" size={13} />}</span></button>;
                })}</div></motion.section>;
              })}</AnimatePresence>}
            </motion.div>
            <footer className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 border-t px-4 py-2.5 text-[10px]", theme === "dark" ? "border-zinc-800 text-zinc-500" : "border-slate-200 text-slate-400")}><span><kbd className="font-mono">↑↓</kbd> navegar</span><span><kbd className="font-mono">↵</kbd> abrir</span><span><kbd className="font-mono">ESC</kbd> fechar</span><span className="ml-auto">{visibleResults.length} contexto(s)</span></footer>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return <><span className="group relative inline-flex"><motion.button type="button" aria-label="Abrir busca global" aria-keyshortcuts="Control+K Meta+K" className={cn("relative flex size-14 items-center justify-center rounded-full border shadow-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500", theme === "dark" ? "border-zinc-700 bg-zinc-800 text-violet-300 hover:bg-zinc-700" : "border-zinc-200 bg-white text-violet-600 hover:bg-slate-50")} whileHover={shouldReduceMotion ? undefined : { scale: 1.02 }} whileTap={shouldReduceMotion ? undefined : { scale: 0.96 }} onClick={() => { customClick?.(); setIsOpen(true); }}><Search className="size-6" /></motion.button><span role="tooltip" className="pointer-events-none absolute bottom-full right-0 z-10 mb-2 w-max rounded-md bg-slate-900 px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">Busca global · Ctrl K</span></span>{createPortal(palette, document.body)}</>;
};
