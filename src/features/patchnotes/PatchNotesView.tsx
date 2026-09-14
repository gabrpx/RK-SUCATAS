// Aba "Novidades": changelog do produto, conteúdo estático mantido em
// data.ts a cada entrega relevante — não é uma tela de CRUD. Cada versão é um
// accordion: recolhido por padrão (só título/versão), abre no toque.
import { Fragment, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Sparkles, Wrench, ArrowUpCircle, ChevronDown } from 'lucide-react';
import { cn } from '../../utils';
import { StatusBadge } from '../../components/ui/StatusBadge';
import type { StatusTone } from '../../components/ui/StatusBadge';
import { PATCH_NOTES } from './data';
import type { PatchNoteTipo, PatchNoteEntrada } from './data';

const TIPO_LABEL: Record<PatchNoteTipo, string> = { feature: 'Novo', melhoria: 'Melhoria', fix: 'Correção' };
const TIPO_TOM: Record<PatchNoteTipo, StatusTone> = { feature: 'positive', melhoria: 'accent', fix: 'warning' };
const TIPO_ICONE: Record<PatchNoteTipo, typeof Sparkles> = { feature: Sparkles, melhoria: ArrowUpCircle, fix: Wrench };

function PatchNoteCard({ entrada }: { entrada: PatchNoteEntrada }) {
  const [aberto, setAberto] = useState(false);

  return (
    <div className="bg-surface-card border border-border-subtle rounded-card overflow-hidden">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className="w-full px-5 py-4 flex items-center justify-between gap-3 text-left"
      >
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-text-primary">{entrada.titulo}</h2>
          <p className="text-xs text-text-faint mt-0.5">
            Versão {entrada.versao} · {new Date(`${entrada.data}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
            {' · '}{entrada.itens.length} {entrada.itens.length === 1 ? 'item' : 'itens'}
          </p>
        </div>
        <motion.span
          animate={{ rotate: aberto ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="flex size-7 shrink-0 items-center justify-center rounded-control border border-border-default text-text-muted"
        >
          <ChevronDown size={16} />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {aberto && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <ul className={cn('divide-y divide-border-subtle border-t border-border-subtle')}>
              {entrada.itens.map((item, i) => {
                const Icone = TIPO_ICONE[item.tipo];
                return (
                  <li key={i} className="px-5 py-3 flex items-start gap-3">
                    <Icone size={15} className="text-text-faint shrink-0 mt-0.5" />
                    <p className="text-sm text-text-secondary flex-1">{item.texto}</p>
                    <span className="shrink-0">
                      <StatusBadge texto={TIPO_LABEL[item.tipo]} tom={TIPO_TOM[item.tipo]} />
                    </span>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function PatchNotesView() {
  return (
    <div className="space-y-6 pb-24 md:pb-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-medium text-text-primary">Novidades</h1>
        <p className="text-sm text-text-faint mt-0.5">O que mudou no sistema, atualização por atualização</p>
      </div>

      <div className="space-y-4">
        {PATCH_NOTES.map((entrada) => (
          <Fragment key={entrada.versao}>
            <PatchNoteCard entrada={entrada} />
          </Fragment>
        ))}
      </div>
    </div>
  );
}
