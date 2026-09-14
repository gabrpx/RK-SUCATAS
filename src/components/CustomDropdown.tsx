import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '../utils';
import { SPRING_SHEET, SPRING_MICRO } from './ui/motion';

interface Option {
  value: string;
  label: string;
}

interface CustomDropdownProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  icon?: React.ReactNode;
  hideValue?: boolean;
  compact?: boolean; // Novo: modo apenas ícone redondo
  variant?: 'pill' | 'form'; // Novo: variante para formulários
  label?: string;
  placeholder?: string;
}

export const CustomDropdown: React.FC<CustomDropdownProps> = ({
  options,
  value,
  onChange,
  className,
  icon,
  hideValue,
  compact,
  variant = 'pill',
  label,
  placeholder
}) => {
  const [isOpen, setIsOpen] = useState(false);
  // Item sob o cursor/teclado — ancora o realce deslizante (layoutId) no
  // estilo do menu animado do animate-ui. Cai pro item selecionado quando o
  // mouse sai.
  const [hoverValue, setHoverValue] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  // Um layoutId único por instância pra dois dropdowns abertos não
  // "compartilharem" o mesmo realce animado.
  const highlightId = useRef(`dd-hl-${Math.random().toString(36).slice(2)}`).current;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => opt.value === value);
  const isDefault = value === 'Todas' || value === 'criado_em' || value === '';
  const realceEm = hoverValue ?? value;

  const pillStyles = cn(
    "flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all duration-300 border text-sm font-medium whitespace-nowrap shadow-sm",
    "bg-surface-inset border-border-default text-text-primary hover:border-border-default"
  );

  // Estilo "Form" para modais
  const formStyles = cn(
    "w-full border rounded-xl py-2.5 px-4 text-sm focus:outline-none transition-all flex items-center justify-between",
    "bg-surface-inset border-border-default text-text-primary hover:border-border-default",
    isOpen && "border-accent ring-1 ring-accent/20"
  );

  return (
    <div className={cn("relative", className)} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        title={selectedOption?.label}
        className={cn(
          variant === 'form' ? formStyles : (compact ? "w-10 h-10 rounded-xl flex items-center justify-center border transition-all shadow-sm" : pillStyles),
          isOpen && variant !== 'form' && "ring-2 ring-accent/20 border-accent/50",
          compact && !isDefault ? ("bg-accent/10 border-accent/30 text-accent") : compact ? ("bg-surface-inset border-border-default text-text-muted") : ""
        )}
      >
        <div className="flex items-center justify-between w-full gap-2">
          <div className="flex items-center gap-2 overflow-hidden">
            {icon && <span className={cn("transition-colors shrink-0", !isDefault && variant !== 'form' && "text-accent")}>{icon}</span>}
            {!compact && <span className="truncate">{selectedOption?.label || placeholder || 'Selecione...'}</span>}
          </div>
          {!compact && (
            <motion.span animate={{ rotate: isOpen ? 180 : 0 }} transition={SPRING_MICRO} className="shrink-0">
              <ChevronDown size={14} className="opacity-50" />
            </motion.span>
          )}
        </div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -6 }}
            transition={SPRING_SHEET}
            style={{ transformOrigin: 'top' }}
            onMouseLeave={() => setHoverValue(null)}
            className={cn(
              "absolute top-full mt-2 rounded-2xl border shadow-2xl z-[150] overflow-y-auto max-h-60 py-2",
              compact ? "right-0 w-48" : "left-0 min-w-[180px] w-full",
              "bg-surface-raised/95 border-border-default shadow-black/50",
              "backdrop-blur-xl"
            )}
          >
            {options.map((option) => {
              const ativo = value === option.value;
              const realçado = realceEm === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onMouseEnter={() => setHoverValue(option.value)}
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "relative w-full text-left px-4 py-2.5 text-xs transition-colors flex items-center justify-between",
                    ativo ? "text-accent font-bold" : "text-text-muted"
                  )}
                >
                  {/* Realce deslizante: um único bloco que se move (layoutId)
                      entre os itens conforme o cursor/seleção muda. */}
                  {realçado && (
                    <motion.span
                      layoutId={highlightId}
                      transition={SPRING_MICRO}
                      className={cn(
                        "absolute inset-x-1 inset-y-0.5 rounded-lg -z-0",
                        ativo ? "bg-accent/10" : "bg-surface-inset"
                      )}
                    />
                  )}
                  <span className="relative z-10">{option.label}</span>
                  {ativo && <div className="relative z-10 w-1.5 h-1.5 rounded-full bg-accent" />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
