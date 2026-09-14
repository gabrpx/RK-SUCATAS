import { useState } from 'react';
import { AlertTriangle, CheckCircle2, ImageOff, Pencil, Package } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { ImageZoom } from '../../../components/ui/image-zoom';
import { Modal, ModalSection } from '../../../components/ui/Modal';
import { cn } from '../../../utils';
import { condicaoNotaDaUnidade, valorDaUnidade } from '../valorEstoque';
import type { Estoque, EstoqueUnidade } from '../types';

interface UnidadeDetailDialogProps {
  aberto: boolean;
  unidade: EstoqueUnidade | null;
  numero: number;
  variante: Pick<Estoque, 'nome' | 'ano' | 'valor' | 'condicao_nota' | 'imagens'>;
  onFechar: () => void;
  onEditar: (unidade: EstoqueUnidade) => void;
}

const fmtMoeda = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

export function UnidadeDetailDialog({ aberto, unidade, numero, variante, onFechar, onEditar }: UnidadeDetailDialogProps) {
  const [fotoAtiva, setFotoAtiva] = useState(0);
  if (!unidade) return null;

  const fotos = unidade.fotos ?? [];
  const nota = condicaoNotaDaUnidade(unidade, variante.condicao_nota);
  const valor = valorDaUnidade(unidade, variante.valor);
  const usaValorDaVariante = unidade.valor == null;
  const usaNotaDaVariante = unidade.condicao_nota == null;

  return (
    <Modal
      aberto={aberto}
      onFechar={onFechar}
      titulo={`Ficha da unidade ${numero}`}
      subtitulo={unidade.nome || variante.nome}
      icone={Package}
      tamanho="lg"
      rodape={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onFechar}>Fechar</Button>
          <Button type="button" variant="accent-cta" onClick={() => onEditar(unidade)}>
            <Pencil size={14} /> Editar unidade
          </Button>
        </div>
      }
    >
      <div className="space-y-1 border-b border-border-subtle pb-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-text-faint">Identificação</p>
        <h3 className="text-lg font-semibold text-text-primary">{unidade.nome || variante.nome}</h3>
        {!unidade.nome && <p className="text-xs text-text-muted">Nome da variante</p>}
        <p className="text-xs text-text-faint">{variante.ano || 'Ano não informado'} · Unidade {numero}</p>
      </div>

      <ModalSection titulo="Resumo da unidade">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Info label="Preço efetivo" value={fmtMoeda(valor)} detail={usaValorDaVariante ? 'Usa preço da variante' : 'Preço próprio'} />
          <Info label="Condição" value={nota != null ? `Nota ${nota}` : 'Sem nota de condição'} detail={usaNotaDaVariante && nota != null ? 'Usa nota da variante' : undefined} />
          <Info label="Avaria" value={unidade.avaria ? 'Com avaria' : 'Sem avaria informada'} detail={unidade.avaria_descricao || undefined} />
          <Info label="Disponibilidade" value={unidade.vendida_em ? 'Vendida' : 'Disponível'} />
        </div>
      </ModalSection>

      {(unidade.descricao || unidade.avaria_descricao) && (
        <ModalSection titulo="Observações">
          {unidade.descricao && <p className="text-sm leading-relaxed text-text-secondary">{unidade.descricao}</p>}
          {unidade.avaria_descricao && <p className="mt-2 flex items-start gap-2 text-sm leading-relaxed text-warning"><AlertTriangle size={15} className="mt-0.5 shrink-0" />{unidade.avaria_descricao}</p>}
        </ModalSection>
      )}

      <ModalSection titulo={`Fotos da unidade${fotos.length ? ` · ${fotos.length}` : ''}`}>
        {fotos.length ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {fotos.map((foto, index) => (
              <div key={foto} onClick={() => setFotoAtiva(index)} className={cn('rounded-control border p-1', index === fotoAtiva ? 'border-accent' : 'border-border-default')}>
                <ImageZoom src={foto} alt={`Foto da unidade ${numero}`} className="aspect-square w-full rounded-control" triggerClassName="block w-full" referrerPolicy="no-referrer" />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-control border border-dashed border-border-default px-3 py-4 text-sm text-text-muted">
            <ImageOff size={17} /> Sem fotos desta unidade
          </div>
        )}
      </ModalSection>

      {variante.imagens.length > 0 && (
        <ModalSection titulo="Fotos de referência da variante" descricao="Imagens legadas da variante; não representam necessariamente esta unidade.">
          <div className="grid grid-cols-3 gap-2">
            {variante.imagens.map((foto, index) => <img key={foto} src={foto} alt={`Foto de referência da variante ${index + 1}`} className="aspect-square w-full rounded-control object-cover" referrerPolicy="no-referrer" />)}
          </div>
        </ModalSection>
      )}
    </Modal>
  );
}

function Info({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return <div className="rounded-control border border-border-subtle bg-surface-inset p-3"><p className="text-[10px] font-semibold uppercase tracking-wider text-text-faint">{label}</p><p className="mt-1 text-sm font-semibold text-text-primary">{value}</p>{detail && <p className="mt-1 text-[11px] text-text-muted">{detail}</p>}</div>;
}
