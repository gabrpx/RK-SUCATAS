// 1 linha de UNIDADE dentro do VarianteCard (T02, docs/mockups/T02-detalhe-gaveta.png):
// dot de status, "#N «nome»", nota de condição + avaria, preço (herdado ou
// próprio) à direita e uma ação de consulta. Edição acontece somente dentro
// da ficha, para que selecionar uma unidade nunca altere seu cadastro.
import { AlertTriangle, Eye, History, ImageOff } from 'lucide-react';
import type { Key } from 'react';
import { cn } from '../../../utils';
import { condicaoNotaDaUnidade, valorDaUnidade } from '../valorEstoque';
import { pendenciasDaUnidade } from './pendenciasGaveta';
import type { Estoque, EstoqueUnidade } from '../types';

const fmtMoeda = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n || 0);

interface UnidadeRowProps {
  key?: Key;
  unidade: EstoqueUnidade;
  numero: number;
  nomePadrao: string;
  valorPadrao: number;
  notaPadrao: number | null;
  onAbrirFicha: (unidade: EstoqueUnidade) => void;
  /** Variante-pai — necessária para distinguir foto legada de ausência de foto. */
  variante?: Estoque;
}

export function UnidadeRow({ unidade, numero, nomePadrao, valorPadrao, notaPadrao, onAbrirFicha, variante }: UnidadeRowProps) {
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

  const vendida = Boolean(unidade.vendida_em);
  const pendencias = vendida ? [] : pendenciasDaUnidade(unidade, variante);
  const fotoLegada = pendencias.includes('foto_legada');
  const fotoEfetiva = foto ?? (fotoLegada ? variante?.imagens?.[0] ?? null : null);

  const dotClasse = vendida ? 'bg-text-faint' : cadastroPendente || unidade.avaria ? 'bg-warning' : 'bg-positive';

  return (
    <button
      type="button"
      onClick={() => onAbrirFicha(unidade)}
      aria-label={`Ver ficha da unidade ${numero}: ${nome}`}
      className="w-full flex items-start gap-3 rounded-control px-2 py-2.5 text-left transition-colors hover:bg-surface-raised sm:items-center"
    >
      <span className={cn('flex-none size-1.5 rounded-full', dotClasse)} aria-hidden />

      <div
        className={cn(
          'relative flex-none size-9 rounded-control overflow-hidden bg-surface-inset flex items-center justify-center',
          (cadastroPendente || (dadosHerdados && !fotoEfetiva)) && 'border border-dashed border-warning/50 bg-transparent',
          fotoLegada && 'border border-dashed border-border-default'
        )}
      >
        {fotoEfetiva ? (
          <>
            <img src={fotoEfetiva} alt={`Foto da unidade ${numero}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            {fotoLegada && (
              <span
                className="absolute inset-x-0 bottom-0 flex items-center justify-center bg-black/55 py-px"
                title="Foto herdada da variante (ainda não é foto própria da unidade)"
              >
                <History size={9} className="text-white" aria-hidden />
              </span>
            )}
          </>
        ) : cadastroPendente ? (
          <AlertTriangle size={14} className="text-warning" aria-hidden />
        ) : null}
      </div>

      <div className="flex-1 min-w-0">
        <p className="break-words text-sm font-semibold leading-snug text-text-primary [overflow-wrap:anywhere]">
          #{numero} {nome ? `"${nome}"` : ''}
        </p>
        {vendida ? (
          <p className="text-xs leading-snug text-text-faint">Vendida</p>
        ) : cadastroPendente ? (
          <p className="flex items-start gap-1 text-xs leading-snug text-warning">
            <AlertTriangle size={11} aria-hidden /> Sem nome e fotos
          </p>
        ) : (
          <p className="break-words text-xs leading-snug text-text-muted [overflow-wrap:anywhere]">
            {dadosHerdados ? 'Dados da variante' : `${nota != null ? `Nota ${nota} · ` : ''}${unidade.avaria ? 'Com avaria' : 'Sem avaria'}`}
            {unidade.fotos.length > 1 ? ` · ${unidade.fotos.length} fotos` : ''}
            {fotoLegada ? ' · Foto legada' : unidade.fotos.length === 0 ? ' · Sem foto' : ''}
            {pendencias.includes('sem_preco') ? ' · Sem preço' : ''}
          </p>
        )}
      </div>

      <span className="flex-none text-sm font-bold text-text-primary tabular-nums">{fmtMoeda(valor)}</span>
      {pendencias.includes('sem_foto') && <ImageOff size={14} className="flex-none text-warning" aria-hidden />}
      <Eye size={14} className="flex-none text-text-faint" aria-hidden />
    </button>
  );
}
