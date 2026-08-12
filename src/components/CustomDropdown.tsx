import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../utils';

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
  const dropdownRef = useRef<HTMLDivElement>(null);

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
          {!compact && <ChevronDown size={14} className={cn("transition-transform opacity-50 shrink-0", isOpen ? "rotate-180" : "")} />}
        </div>
      </button>

      {isOpen && (
        <div className={cn(
          "absolute top-full mt-2 rounded-2xl border shadow-2xl z-[150] overflow-y-auto max-h-60 py-2 animate-in fade-in slide-in-from-top-2 duration-200",
          compact ? "right-0 w-48" : "left-0 min-w-[180px] w-full",
          "bg-surface-raised/95 border-border-default shadow-black/50",
          "backdrop-blur-xl"
        )}>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={cn(
                "w-full text-left px-4 py-2.5 text-xs transition-colors flex items-center justify-between",
                value === option.value
                  ? ("bg-accent/10 text-accent font-bold")
                  : ("text-text-muted hover:bg-surface-inset")
              )}
            >
              {option.label}
              {value === option.value && (
                <div className={cn("w-1.5 h-1.5 rounded-full", "bg-accent")} />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
