// Combobox de cliente: digitar filtra sugestões de clientes cadastrados,
// clicar numa sugestão vincula (cliente_id); continuar editando o texto
// depois de vincular desfaz o vínculo e volta a valer como nome livre — usado
// em Vendas/Orçamentos (que aceitam cliente sem cadastro) e em Tarefas (que
// só usa a parte de cliente_id, sem nome livre).
import { useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';
import { cn } from '../../utils';
import { useData } from '../../context/DataContext';
import type { Cliente } from './types';

export interface SeletorClienteProps {
  clienteId: string | null;
  nome: string;
  onChange: (clienteId: string | null, nome: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  // Lista explícita de clientes, para telas que não querem depender do
  // contexto global (ex.: o novo estoque). Sem ela, usa os clientes do contexto.
  clientes?: Cliente[];
  ariaLabel?: string;
}

export function SeletorCliente({ clienteId, nome, onChange, placeholder = 'Nome do cliente (opcional)', className, disabled, clientes: clientesProp, ariaLabel }: SeletorClienteProps) {
  const { clientes: clientesContexto } = useData();
  const clientes = clientesProp ?? clientesContexto;
  const [aberto, setAberto] = useState(false);
  const fecharTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sugestoes = useMemo(() => {
    const termo = nome.trim().toLowerCase();
    if (!termo) return [];
    return clientes.filter((c) => c.ativo && (c.nome.toLowerCase().includes(termo) || (c.telefone || '').includes(termo))).slice(0, 8);
  }, [clientes, nome]);

  const selecionar = (id: string, nomeCliente: string) => {
    onChange(id, nomeCliente);
    setAberto(false);
  };

  const limpar = () => {
    onChange(null, '');
  };

  const inputClass = cn(
    'w-full border rounded-control py-2.5 pl-4 pr-16 text-sm outline-none transition-all focus:ring-2 focus:ring-accent/50 bg-surface-inset border-border-default text-text-primary placeholder:text-text-faint',
    disabled && 'opacity-60 cursor-not-allowed'
  );

  return (
    <div className={cn('relative', className)}>
      <input
        aria-label={ariaLabel}
        value={nome}
        disabled={disabled}
        onChange={(e) => {
          // Editar o texto sempre desfaz um vínculo anterior — o nome só
          // volta a ser "de um cadastro" quando uma sugestão é escolhida de novo.
          onChange(null, e.target.value);
          setAberto(true);
        }}
        onFocus={() => setAberto(true)}
        onBlur={() => {
          // Delay pro onMouseDown da sugestão disparar antes do blur fechar a lista.
          fecharTimeout.current = setTimeout(() => setAberto(false), 150);
        }}
        placeholder={placeholder}
        className={inputClass}
      />
      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
        {clienteId && <Check size={14} className="text-positive" />}
        {nome && (
          <button type="button" tabIndex={-1} onMouseDown={(e) => e.preventDefault()} onClick={limpar} className="text-text-faint hover:text-text-primary">
            <X size={14} />
          </button>
        )}
        {!nome && <ChevronDown size={14} className="text-text-faint" />}
      </div>

      {aberto && sugestoes.length > 0 && (
        <div className="absolute z-10 mt-1 w-full bg-surface-card border border-border-default rounded-control shadow-2xl overflow-hidden max-h-56 overflow-y-auto">
          {sugestoes.map((c) => (
            <button
              key={c.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                if (fecharTimeout.current) clearTimeout(fecharTimeout.current);
                selecionar(c.id, c.nome);
              }}
              className="w-full text-left px-4 py-2 text-sm hover:bg-surface-raised flex items-center justify-between gap-2"
            >
              <span className="text-text-primary truncate">{c.nome}</span>
              {c.telefone && <span className="text-xs text-text-faint shrink-0">{c.telefone}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
