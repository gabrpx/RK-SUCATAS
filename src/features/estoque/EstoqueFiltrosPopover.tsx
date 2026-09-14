// Painel "Filtros" do Estoque — agrupa os controles que antes eram uma
// fileira de chips (estourava a largura no mobile) dentro de um popover.
// Nenhuma lógica de filtro muda aqui: só onde os controles aparecem.
import { Bike, Filter } from 'lucide-react';
import { cn } from '../../utils';
import { PopoverContent, PopoverHeader, PopoverRoot, PopoverTrigger } from '../../components/ui/popover';
import { Checkbox } from '../../components/ui/checkbox';
import { TreeDropdown, type TreeDropdownNode } from '../../components/TreeDropdown';

interface EstoqueFiltrosPopoverProps {
  categoriaFiltro: string;
  onCategoriaChange: (id: string) => void;
  categoriaNodes: TreeDropdownNode[];
  modeloFiltro: string;
  onModeloChange: (id: string) => void;
  modeloNodes: TreeDropdownNode[];
  soEstoqueBaixo: boolean;
  onToggleEstoqueBaixo: () => void;
  itensEstoqueBaixo: number;
  soSemPreco: boolean;
  onToggleSemPreco: () => void;
  soComAvaria: boolean;
  onToggleComAvaria: () => void;
  mostrarFiltroAvaria: boolean;
  itensComAvaria: number;
  soSemFoto: boolean;
  onToggleSemFoto: () => void;
  soSemLinkMl: boolean;
  onToggleSemLinkMl: () => void;
}

function FiltroCheckboxRow({
  label,
  checked,
  onChange,
  contagem,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
  contagem?: number;
}) {
  return (
    <label className="flex items-center justify-between gap-3 py-2.5 sm:py-1.5 px-2 sm:px-1 rounded-control cursor-pointer hover:bg-surface-raised">
      <span className="flex items-center gap-2 text-xs text-text-secondary">
        {label}
        {contagem !== undefined && (
          <span className={cn('px-1.5 py-0.5 rounded-badge text-[10px]', checked ? 'bg-warning/20 text-warning' : 'bg-surface-raised text-text-faint')}>
            {contagem}
          </span>
        )}
      </span>
      <Checkbox checked={checked} onCheckedChange={onChange} aria-label={label} />
    </label>
  );
}

export function EstoqueFiltrosPopover(props: EstoqueFiltrosPopoverProps) {
  const {
    categoriaFiltro, onCategoriaChange, categoriaNodes,
    modeloFiltro, onModeloChange, modeloNodes,
    soEstoqueBaixo, onToggleEstoqueBaixo, itensEstoqueBaixo,
    soSemPreco, onToggleSemPreco,
    soComAvaria, onToggleComAvaria, mostrarFiltroAvaria, itensComAvaria,
    soSemFoto, onToggleSemFoto,
    soSemLinkMl, onToggleSemLinkMl,
  } = props;

  const ativos =
    (categoriaFiltro !== 'Todas' ? 1 : 0) +
    (modeloFiltro !== 'Todas' ? 1 : 0) +
    [soEstoqueBaixo, soSemPreco, soComAvaria, soSemFoto, soSemLinkMl].filter(Boolean).length;

  return (
    <PopoverRoot>
      <PopoverTrigger>
        <Filter size={14} />
        Filtros
        {ativos > 0 && <span className="px-1.5 py-0.5 rounded-badge bg-accent-soft-bg text-accent-soft-fg text-[10px]">{ativos}</span>}
      </PopoverTrigger>
      <PopoverContent>
        <PopoverHeader>Categoria e moto</PopoverHeader>
        <div className="flex flex-wrap gap-2 px-1 pb-3">
          <TreeDropdown
            icon={<Filter size={14} />}
            value={categoriaFiltro}
            onChange={onCategoriaChange}
            nodes={categoriaNodes}
            emptyOption={{ value: 'Todas', label: 'Todas categorias' }}
            searchPlaceholder="Buscar categoria..."
            emptyMessage="Nenhuma categoria encontrada."
          />
          <TreeDropdown
            icon={<Bike size={14} />}
            value={modeloFiltro}
            onChange={onModeloChange}
            nodes={modeloNodes}
            emptyOption={{ value: 'Todas', label: 'Todos modelos' }}
            searchPlaceholder="Buscar moto..."
            emptyMessage="Nenhuma moto encontrada."
          />
        </div>

        <PopoverHeader>Situação</PopoverHeader>
        <div className="px-1 pb-1 space-y-0.5">
          <FiltroCheckboxRow label="Estoque baixo" checked={soEstoqueBaixo} onChange={onToggleEstoqueBaixo} contagem={itensEstoqueBaixo} />
          <FiltroCheckboxRow label="Sem preço" checked={soSemPreco} onChange={onToggleSemPreco} />
          {mostrarFiltroAvaria && (
            <FiltroCheckboxRow label="Com avaria" checked={soComAvaria} onChange={onToggleComAvaria} contagem={itensComAvaria} />
          )}
          <FiltroCheckboxRow label="Sem foto" checked={soSemFoto} onChange={onToggleSemFoto} />
          <FiltroCheckboxRow label="Sem link ML" checked={soSemLinkMl} onChange={onToggleSemLinkMl} />
        </div>
      </PopoverContent>
    </PopoverRoot>
  );
}
