import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Search, X, Package, Tag, Layers } from 'lucide-react';
import { useData } from '../context/DataContext';
import { cn, formatDateRelative, parseLocalDate } from '../utils';
import { NotaCadastroBadge } from './NotaCadastroBadge';
import { useScrollLock } from '../hooks/useScrollLock';
import type { Estoque } from '../features/estoque/types';
import type { Venda } from '../features/vendas/types';

interface GlobalSearchProps {
  onSelectItem: (item: Estoque | Venda) => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  customClick?: () => void;
}

function normalizarTexto(texto: string) {
  return (texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

const EstoqueItemCard = ({ item, onClick }: { item: Estoque; onClick: () => void }) => (
  <button
    onClick={onClick}
    className={cn(
      'w-full text-left p-2.5 rounded-lg flex items-center gap-3 transition-all border',
      'bg-zinc-900 border-zinc-800 hover:border-violet-500/50'
    )}
  >
    <div className={cn('w-12 h-12 rounded-lg overflow-hidden flex-shrink-0', 'bg-zinc-800')}>
      {item.imagens[0] ? (
        <img src={item.imagens[0]} alt={item.nome} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-zinc-400">
          <Package size={18} />
        </div>
      )}
    </div>
    <div className="flex-1 min-w-0">
      <p className={cn('font-bold text-xs mb-1 truncate', 'text-zinc-100')}>{item.nome}</p>
      <div className="flex flex-wrap gap-1">
        <span className={cn('flex items-center gap-0.5 px-1 py-0.5 rounded text-[8px] font-bold', 'bg-violet-500/10 text-violet-400')}>
          <Tag size={8} /> {item.codigo}
        </span>
        <span className={cn('flex items-center gap-0.5 px-1 py-0.5 rounded text-[8px] font-bold', 'bg-emerald-500/10 text-emerald-400')}>
          <Layers size={8} /> {item.categoria?.nome || '-'}
        </span>
        <span className={cn('flex items-center gap-0.5 px-1 py-0.5 rounded text-[8px] font-bold', 'bg-amber-500/10 text-amber-400')}>
          <Package size={8} /> {item.quantidade} un
        </span>
        <NotaCadastroBadge value={item.nota_cadastro} size="sm" />
      </div>
    </div>
    <p className="font-black text-emerald-500 text-xs [text-shadow:0_0_10px_rgba(16,185,129,0.5)]">
      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(item.valor))}
    </p>
  </button>
);

export const GlobalSearch: React.FC<GlobalSearchProps> = ({ onSelectItem, isOpen, setIsOpen, customClick }) => {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { estoque, vendas } = useData();

  useScrollLock(isOpen);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  const handleClose = () => {
    setIsOpen(false);
    setQuery('');
  };

  const getResults = () => {
    if (!query.trim()) return [];

    const normalizedQuery = normalizarTexto(query);
    const queryWords = normalizedQuery.split(' ').filter(Boolean);
    const results: { type: 'estoque' | 'venda'; data: Estoque | Venda; score: number }[] = [];

    estoque.forEach((item) => {
      const itemText = normalizarTexto(`${item.nome} ${item.codigo} ${item.categoria?.nome || ''}`);
      const exactNameMatch = normalizarTexto(item.nome) === normalizedQuery;
      const matchesAll = queryWords.every((word) => itemText.includes(word));
      if (exactNameMatch || matchesAll) {
        results.push({ type: 'estoque', data: item, score: exactNameMatch ? 10 : matchesAll ? 5 : 0 });
      }
    });

    vendas.forEach((venda) => {
      const vendaText = normalizarTexto(`${venda.nome_item} ${venda.forma_pagamento?.nome || ''} ${venda.cliente_nome || ''}`);
      const matchesAll = queryWords.every((word) => vendaText.includes(word));
      if (matchesAll) {
        results.push({ type: 'venda', data: venda, score: 6 });
      }
    });

    return results.sort((a, b) => b.score - a.score).slice(0, 8);
  };

  const results = getResults();

  return (
    <>
      <motion.button
        className={cn(
          'relative w-14 h-14 rounded-full flex items-center justify-center z-50 transition-all duration-300 group',
          'bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 shadow-xl'
        )}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.95 }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (customClick) customClick();
          else setIsOpen(true);
        }}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
      >
        <Search className={cn('w-6 h-6 transition-transform group-hover:scale-110', 'text-violet-400')} />
      </motion.button>

      {createPortal(
        <AnimatePresence>
          {isOpen && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={handleClose} />
              <motion.div
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 50 }}
                className={cn(
                  'fixed z-[110] rounded-3xl shadow-2xl overflow-hidden border flex flex-col',
                  'bottom-[6px] left-1/2 -translate-x-1/2 w-[95%] max-w-2xl max-h-[85vh]',
                  'bg-zinc-900 border-zinc-800'
                )}
              >
                <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
                  {query.trim() && results.length === 0 ? (
                    <div className="p-8 text-center text-zinc-500">Nenhum resultado encontrado para "{query}"</div>
                  ) : (
                    <div className="space-y-2">
                      {results.map((result, idx) => (
                        <React.Fragment key={idx}>
                          {result.type === 'estoque' && (
                            <EstoqueItemCard
                              item={result.data as Estoque}
                              onClick={() => {
                                onSelectItem(result.data);
                                handleClose();
                              }}
                            />
                          )}
                          {result.type === 'venda' && (
                            <div
                              className={cn('p-3 rounded-lg border cursor-pointer transition-all duration-200', 'bg-zinc-900/50 border-zinc-800 hover:bg-white/5')}
                              onClick={() => {
                                onSelectItem(result.data);
                                handleClose();
                              }}
                            >
                              <div className="flex justify-between items-start mb-2">
                                <span className={cn('font-bold text-sm truncate pr-2', 'text-zinc-200')}>{(result.data as Venda).nome_item}</span>
                                <span className="font-black text-sm whitespace-nowrap text-emerald-500 [text-shadow:0_0_10px_rgba(16,185,129,0.5)]">
                                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((result.data as Venda).valor_total)}
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                <span className={cn('px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider border shadow-sm', 'bg-zinc-800 text-zinc-300 border-zinc-700')}>
                                  {(result.data as Venda).forma_pagamento?.nome}
                                </span>
                                <span className={cn('px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider border shadow-sm', 'bg-blue-500/10 text-blue-400 border-blue-500/20')}>
                                  {formatDateRelative((result.data as Venda).data)}
                                </span>
                              </div>
                            </div>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  )}
                </div>

                <div className={cn('p-3 border-t', 'border-zinc-800 bg-zinc-900')}>
                  <div className="relative">
                    <Search className={cn('absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5', 'text-zinc-500')} />
                    <input
                      ref={inputRef}
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Buscar..."
                      className={cn(
                        'w-full pl-10 pr-10 py-2.5 rounded-lg outline-none transition-colors text-sm',
                        'bg-zinc-950 text-white placeholder-zinc-500 focus:ring-0'
                      )}
                    />
                    {query && (
                      <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5 text-zinc-400">
                        <X size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
};
