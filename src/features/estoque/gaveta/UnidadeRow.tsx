// 1 linha de UNIDADE dentro do VarianteCard (T02, docs/mockups/T02-detalhe-gaveta.png):
// dot de status, "#N «nome»", nota de condição + avaria, preço (herdado ou
// próprio) à direita, ação de editar. Dados ausentes numa linha de backfill
// herdam a peça-mãe; unidade rápida criada só com preço continua marcada como
// cadastro mínimo até receber seus próprios dados.
import { AlertTriangle, Pencil } from 'lucide-react';
import { cn } from '../../../utils';
import { condicaoNotaDaUnidade, valorDaUnidade } from '../valorEstoque';
import type { EstoqueUnidade } from '../types';

const fmtMoeda = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n || 0);

interface UnidadeRowProps {
  unidade: EstoqueUnidade;
  numero: number;
  nomePadrao: string;
  valorPadrao: number;
  notaPadrao: number | null;
  fotoPadrao: string | null;
  onEditar: (unidade: EstoqueUnidade) => void;
}

export function UnidadeRow({ unidade, numero, nomePadrao, valorPadrao, notaPadrao, fotoPadrao, onEditar }: UnidadeRowProps) {
  // A linha vazia criada pelo backfill representa a peça legada e herda seus
  // dados. Já uma unidade rápida com preço próprio, mas sem nome/foto, ainda
  // precisa ser completada e mantém o aviso de cadastro mínimo.
  const cadastroMinimo = !unidade.nome && unidade.fotos.length === 0 && unidade.valor != null;
  const nota = condicaoNotaDaUnidade(unidade, notaPadrao);
  const valor = valorDaUnidade(unidade, valorPadrao);
  const foto = unidade.fotos[0] ?? fotoPadrao ?? null;
  const nome = unidade.nome || nomePadrao;

  const dotClasse = cadastroMinimo ? 'bg-warning' : unidade.avaria ? 'bg-warning' : 'bg-positive';

  return (
    <button
      type="button"
      onClick={() => onEditar(unidade)}
      className="w-full flex items-center gap-3 py-2.5 px-2 rounded-control hover:bg-surface-raised transition-colors text-left min-h-11"
    >
      <span className={cn('flex-none size-1.5 rounded-full', dotClasse)} aria-hidden />

      <div
        className={cn(
          'flex-none size-9 rounded-control overflow-hidden bg-surface-inset flex items-center justify-center',
          cadastroMinimo && 'border border-dashed border-warning/50 bg-transparent'
        )}
      >
        {foto ? (
          <img src={foto} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        ) : cadastroMinimo ? (
          <AlertTriangle size={14} className="text-warning" />
        ) : null}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-text-primary truncate">
          #{numero} {nome ? `"${nome}"` : ''}
        </p>
        {cadastroMinimo ? (
          <p className="text-xs text-warning truncate flex items-center gap-1">
            <AlertTriangle size={11} /> Incompleto · Cadastro mínimo
          </p>
        ) : (
          <p className="text-xs text-text-muted truncate">
            {nota != null ? `Nota ${nota} · ` : ''}
            {unidade.avaria ? 'Com avaria' : 'Sem avaria'}
          </p>
        )}
      </div>

      <span className="flex-none text-sm font-bold text-text-primary tabular-nums">{fmtMoeda(valor)}</span>
      <Pencil size={14} className="flex-none text-text-faint" />
    </button>
  );
}
