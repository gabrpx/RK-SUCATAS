import { Package, Pencil } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Modal, ModalSection } from '../../components/ui/Modal';
import { EstoqueItemExpandido } from './EstoqueItemExpandido';
import type { Categoria } from '../../types/catalog';
import type { Estoque } from './types';

interface EstoqueItemDetailDialogProps {
  aberto: boolean;
  item: Estoque | null;
  categorias: Categoria[];
  onFechar: () => void;
  onEditar?: (item: Estoque) => void;
}

export function EstoqueItemDetailDialog({ aberto, item, categorias, onFechar, onEditar }: EstoqueItemDetailDialogProps) {
  if (!item) return null;

  return (
    <Modal
      aberto={aberto}
      onFechar={onFechar}
      titulo="Detalhes do item"
      subtitulo="Item não agrupado · consulta"
      icone={Package}
      tamanho="lg"
      rodape={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onFechar}>Fechar</Button>
          {onEditar && <Button type="button" variant="accent-cta" onClick={() => onEditar(item)}><Pencil size={14} /> Editar item</Button>}
        </div>
      }
    >
      <ModalSection titulo="Identificação">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-text-primary">{item.nome}</h3>
          <p className="text-xs text-text-muted">{item.codigo ? `Código ${item.codigo} · ` : ''}{item.ano || 'Ano não informado'}</p>
          <p className="text-sm text-text-secondary">Este item ainda não pertence a uma gaveta.</p>
        </div>
      </ModalSection>
      <EstoqueItemExpandido item={item} categorias={categorias} />
    </Modal>
  );
}
