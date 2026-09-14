// 1 linha de UNIDADE dentro do VarianteCard (T02, docs/mockups/T02-detalhe-gaveta.png):
// dot de status, "#N «nome»", nota de condição + avaria, preço (herdado ou
// próprio) à direita e uma ação de consulta. Edição acontece somente dentro
// da ficha, para que selecionar uma unidade nunca altere seu cadastro.
import { AlertTriangle, Eye, ImageOff } from 'lucide-react';
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
  onAbrirFicha: (unidade: EstoqueUnidade) => void;
}

export function UnidadeRow({ unidade, numero, nomePadrao, valorPadrao, notaPadrao, onAbrirFicha }: UnidadeRowProps) {
  const dadosProprios = Boolean(
    unidade.nome || unidade.fotos.length || unidade.avaria || unidade.descricao ||
    unidade.avaria_descricao || unidade.valor != null || unidade.condicao_nota != null
  );
  const dadosHerdados = !dadosProprios;
  const cadastroPendente = dadosProprios && !unidade.nome && unidade.fotos.length === 0;
  const nota = condicaoNotaDaUnidade(unidade, notaPadrao);
  const valor = valorDaUnidade(unidade, valorPadrao);
  const foto = unidade.fotos[0] ?? null;
  const nome = unidade.nome || nomePadrao;

  const dotClasse = cadastroPendente || unidade.avaria ? 'bg-warning' : 'bg-positive';

  return (
    <button
      type="button"
      onClick={() => onAbrirFicha(unidade)}
      aria-label={`Ver ficha da unidade ${numero}: ${nome}`}
      className="w-full flex items-center gap-3 py-2.5 px-2 rounded-control hover:bg-surface-raised transition-colors text-left min-h-11"
    >
      <span className={cn('flex-none size-1.5 rounded-full', dotClasse)} aria-hidden />

      <div
        className={cn(
          'flex-none size-9 rounded-control overflow-hidden bg-surface-inset flex items-center justify-center',
          (cadastroPendente || dadosHerdados) && 'border border-dashed border-warning/50 bg-transparent'
        )}
      >
        {foto ? (
          <img src={foto} alt={`Foto da unidade ${numero}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        ) : cadastroPendente ? (
          <AlertTriangle size={14} className="text-warning" aria-hidden />
        ) : null}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-text-primary truncate">
          #{numero} {nome ? `"${nome}"` : ''}
        </p>
        {cadastroPendente ? (
          <p className="text-xs text-warning truncate flex items-center gap-1">
            <AlertTriangle size={11} aria-hidden /> Sem nome e fotos
          </p>
        ) : (
          <p className="text-xs text-text-muted truncate">
            {dadosHerdados ? 'Dados da variante' : `${nota != null ? `Nota ${nota} · ` : ''}${unidade.avaria ? 'Com avaria' : 'Sem avaria'}`}
            {unidade.fotos.length > 1 ? ` · ${unidade.fotos.length} fotos` : unidade.fotos.length === 0 ? ' · Sem fotos' : ''}
          </p>
        )}
      </div>

      <span className="flex-none text-sm font-bold text-text-primary tabular-nums">{fmtMoeda(valor)}</span>
      {!foto && <ImageOff size={14} className="flex-none text-text-faint" aria-hidden />}
      <Eye size={14} className="flex-none text-text-faint" aria-hidden />
    </button>
  );
}
