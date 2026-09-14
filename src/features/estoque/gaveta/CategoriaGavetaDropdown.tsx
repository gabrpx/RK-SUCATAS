import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '../../../components/animate-ui/components/radix/dropdown-menu';
import { cn } from '../../../utils';

export interface CategoriaGavetaOption {
  id: string;
  nome: string;
}

interface CategoriaGavetaDropdownProps {
  id: string;
  label: string;
  value: string;
  options: CategoriaGavetaOption[];
  onChange: (value: string) => void;
}

const inputClass =
  'w-full border rounded-control py-2.5 px-4 text-sm outline-none transition-all focus:ring-2 focus:ring-accent/50 bg-surface-inset border-border-default text-text-primary placeholder:text-text-faint';
const SEM_CATEGORIA = '__sem_categoria__';

export function CategoriaGavetaDropdown({ id, label, value, options, onChange }: CategoriaGavetaDropdownProps) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const buscaRef = useRef<HTMLInputElement>(null);
  const selecionada = options.find((opcao) => opcao.id === value);

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase('pt-BR');
    if (!termo) return options;
    return options.filter((opcao) => opcao.nome.toLocaleLowerCase('pt-BR').includes(termo));
  }, [busca, options]);

  useEffect(() => {
    if (aberto) requestAnimationFrame(() => buscaRef.current?.focus());
    else setBusca('');
  }, [aberto]);

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold uppercase tracking-wider text-text-muted" htmlFor={id}>
        {label}
      </label>
      <DropdownMenu open={aberto} onOpenChange={setAberto}>
        <DropdownMenuTrigger asChild>
          <button
            id={id}
            type="button"
            aria-label={label}
            aria-haspopup="menu"
            className={cn(
              inputClass,
              'flex h-11 items-center justify-between text-left',
              aberto && 'border-accent ring-2 ring-accent/20'
            )}
          >
            <span className={cn(!selecionada && 'text-text-faint')}>
              {selecionada?.nome ?? 'Selecione uma categoria'}
            </span>
            <ChevronDown size={16} className="shrink-0 text-text-muted" aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          open={aberto}
          align="start"
          sideOffset={6}
          className="w-[min(28rem,calc(100vw-3rem))] p-1.5"
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          <DropdownMenuLabel className="px-2 pb-1 pt-0.5">Escolha uma categoria</DropdownMenuLabel>
          <div className="relative mb-1.5">
            <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-faint" aria-hidden />
            <input
              ref={buscaRef}
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  setAberto(false);
                  return;
                }
                event.stopPropagation();
              }}
              aria-label="Buscar categoria"
              placeholder="Digite para filtrar..."
              className={cn(inputClass, 'h-10 pl-8 pr-3')}
            />
          </div>
          <div className="max-h-56 overflow-y-auto pr-0.5" role="none">
            <DropdownMenuRadioGroup
              value={value || SEM_CATEGORIA}
              onValueChange={(proximo) => {
                onChange(proximo === SEM_CATEGORIA ? '' : proximo);
                setAberto(false);
              }}
            >
              {filtradas.map((opcao) => (
                <DropdownMenuRadioItem key={opcao.id || 'sem-categoria'} value={opcao.id || SEM_CATEGORIA} className="min-h-10 pr-8">
                  {opcao.nome}
                  {opcao.id === value && <Check size={14} className="ml-auto text-accent" aria-hidden />}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            {filtradas.length === 0 && <p className="px-2.5 py-3 text-sm text-text-faint">Nenhuma categoria encontrada.</p>}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
