// Estados preventivos (T13, docs/mockups/T13-estados-preventivos.png): empty
// state de gavetas, barra de offline e alerta de nome duplicado ao criar
// gaveta. Só é montado nas telas de verdade na Task 13 (rota) — aqui só os
// componentes, sem assumir onde vivem.
import { useEffect, useState } from 'react';
import { Box, Plus, WifiOff } from 'lucide-react';
import { cn } from '../../../utils';
import { Button } from '../../../components/ui/button';
import { tokenizar, similaridade, CORTE_POSSIVEL } from '../detectarDuplicata';
import type { Gaveta } from '../types';

// ============================================================================
// Empty state — nenhuma gaveta cadastrada (nem itens não agrupados).
// CTA "+ Criar Gaveta" é o ÚNICO accent preenchido desta tela quando visível
// (a tela por trás não tem outro accent-cta ativo nesse estado).
// ============================================================================
interface EmptyGavetasProps {
  onNova: () => void;
}

export function EmptyGavetas({ onNova }: EmptyGavetasProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 px-4 text-center">
      <div className="size-14 rounded-control bg-surface-inset flex items-center justify-center text-text-faint">
        <Box size={28} strokeWidth={1.5} />
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-base font-bold text-text-primary">Nenhuma gaveta cadastrada</p>
        <p className="text-sm text-text-muted max-w-[22rem]">
          Crie sua primeira gaveta para começar a organizar o estoque.
        </p>
      </div>
      <Button type="button" variant="accent-cta" size="mobile" onClick={onNova}>
        <Plus size={16} /> Criar Gaveta
      </Button>
    </div>
  );
}

// ============================================================================
// Offline bar — indicador de status, não é "alerta" (regra do CLAUDE.md
// exige ação em todo alerta; aqui não existe nenhuma ação que o usuário possa
// tomar pra reconectar de dentro do app, então é status informativo puro,
// não um AlertBar). Full-width, fixo no topo da tela que a montar.
// ============================================================================
function useOnline(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));

  useEffect(() => {
    const marcarOnline = () => setOnline(true);
    const marcarOffline = () => setOnline(false);
    window.addEventListener('online', marcarOnline);
    window.addEventListener('offline', marcarOffline);
    return () => {
      window.removeEventListener('online', marcarOnline);
      window.removeEventListener('offline', marcarOffline);
    };
  }, []);

  return online;
}

export function OfflineBar() {
  const online = useOnline();
  if (online) return null;

  return (
    <div
      role="status"
      className="w-full flex items-center gap-2 px-4 py-2 bg-warning-bg text-warning text-xs font-semibold"
    >
      <WifiOff size={14} className="shrink-0" />
      <span>Sem conexão - dados locais podem estar desatualizados</span>
    </div>
  );
}

// ============================================================================
// Alerta de duplicata ao criar gaveta — reusa a MESMA lógica de similaridade
// de src/features/estoque/detectarDuplicata.ts (tokenizar + Jaccard +
// CORTE_POSSIVEL), já usada pra detectar peça duplicada; aqui só troca o
// universo comparado de Estoque[] pra Gaveta[]. Toda alerta tem ação (regra
// do CLAUDE.md): vincular à gaveta existente OU criar mesmo assim.
export function encontrarGavetaSemelhante(nome: string, gavetas: Gaveta[]): Gaveta | null {
  const tokens = tokenizar(nome);
  if (tokens.length === 0 || nome.trim().length < 3) return null;

  let melhor: { gaveta: Gaveta; score: number } | null = null;
  for (const gaveta of gavetas) {
    const score = similaridade(tokens, tokenizar(gaveta.nome));
    if (score < CORTE_POSSIVEL) continue;
    if (!melhor || score > melhor.score) melhor = { gaveta, score };
  }
  return melhor?.gaveta ?? null;
}

interface AlertaDuplicataGavetaProps {
  /** Nome da gaveta existente semelhante ao que está sendo digitado. */
  nome: string;
  onVincular: () => void;
  onCriarMesmoAssim: () => void;
}

export function AlertaDuplicataGaveta({ nome, onVincular, onCriarMesmoAssim }: AlertaDuplicataGavetaProps) {
  return (
    <div className={cn('flex flex-col gap-2 border rounded-card p-3 bg-warning-bg border-warning/40')}>
      <p className="text-xs text-warning">
        ⚠ Já existe uma gaveta com nome semelhante: «{nome}». Deseja adicionar variante a gaveta existente?
      </p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onVincular}
          className="text-2xs font-semibold uppercase tracking-wide underline underline-offset-2 text-warning hover:opacity-80"
        >
          Vincular à existente
        </button>
        <button
          type="button"
          onClick={onCriarMesmoAssim}
          className="text-2xs font-semibold uppercase tracking-wide underline underline-offset-2 text-warning hover:opacity-80"
        >
          Criar mesmo assim
        </button>
      </div>
    </div>
  );
}
