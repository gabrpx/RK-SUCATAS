// Campo de busca do Estoque com sugestões animadas — mesma linguagem visual
// do action-search-bar (Kokonut UI), recriada como controlada e alimentada
// pelos itens já filtrados desta tela (ver nota "por que não o componente
// original" na Task 2 do plano de componentes animados do Estoque).
import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Package, Search, X } from 'lucide-react';
import { SPRING_MICRO } from '../../components/ui/motion';
import type { Estoque } from './types';

const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0);

interface EstoqueBuscaSugestoesProps {
  value: string;
  onChange: (value: string) => void;
  sugestoes: Estoque[];
  onSelecionar: (item: Estoque) => void;
  placeholder?: string;
}

export function EstoqueBuscaSugestoes({ value, onChange, sugestoes, onSelecionar, placeholder }: EstoqueBuscaSugestoesProps) {
  const [focado, setFocado] = useState(false);
  const blurTimeout = useRef<ReturnType<typeof setTimeout>>();

  const mostrarSugestoes = focado && value.trim().length > 0 && sugestoes.length > 0;

  return (
    <div className="relative">
      <div className="flex items-center gap-3 rounded-control border border-border-default bg-surface-inset px-4">
        <Search size={16} className="text-text-faint shrink-0" />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocado(true)}
          onBlur={() => {
            blurTimeout.current = setTimeout(() => setFocado(false), 150);
          }}
          placeholder={placeholder ?? 'Buscar peças por nome, código, categoria ou moto...'}
          role="combobox"
          aria-expanded={mostrarSugestoes}
          className="flex-1 py-3.5 bg-transparent outline-none text-sm text-text-primary placeholder:text-text-faint"
        />
        {value && (
          <button type="button" onClick={() => onChange('')} className="p-1.5 rounded-full hover:bg-surface-raised text-text-faint">
            <X size={14} />
          </button>
        )}
      </div>

      <AnimatePresence>
        {mostrarSugestoes && (
          <motion.ul
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={SPRING_MICRO}
            role="listbox"
            className="absolute left-0 right-0 top-full z-[120] mt-2 max-h-80 overflow-y-auto rounded-card border border-border-default bg-surface-card shadow-2xl py-1.5"
          >
            {sugestoes.map((item) => (
              <li key={item.id} role="option">
                <button
                  type="button"
                  onMouseDown={(e) => {
                    // onMouseDown (não onClick) dispara antes do onBlur do
                    // input — senão a lista fecha antes do clique registrar.
                    e.preventDefault();
                    clearTimeout(blurTimeout.current);
                    onSelecionar(item);
                    setFocado(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-surface-raised transition-colors"
                >
                  <div className="size-8 rounded-control overflow-hidden shrink-0 flex items-center justify-center bg-surface-inset">
                    {item.imagens[0] ? (
                      <img src={item.imagens[0]} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <Package size={14} className="text-text-faint" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-text-primary truncate">{item.nome}</p>
                    <p className="text-[10.5px] text-text-faint truncate">
                      {item.codigo} · {item.categoria?.nome || '-'}
                    </p>
                  </div>
                  <span className="text-xs font-medium text-text-secondary tabular-nums shrink-0">{formatCurrency(item.valor)}</span>
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
