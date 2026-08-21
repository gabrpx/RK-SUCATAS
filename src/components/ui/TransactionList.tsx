// Lista de transações animada no estilo do transaction-list do watermelon.sh:
// ao clicar numa linha, ela "cresce" (morph via layoutId compartilhado) num
// cartão de detalhes, e o container anima a altura. Portado pra este projeto:
// largura fluida (não mais w-64 fixo), cores em tokens do design system, e o
// bloco de detalhes virou genérico (`detalhes: {label,valor}[]`) em vez dos
// campos de cartão de crédito do template. Enquadrado como um card padrão
// (mesmo visual do PanelCard) pra conviver com os outros cards do dashboard.
'use client';

import { AnimatePresence, motion, MotionConfig, type Transition } from 'motion/react';
import { Fragment, useState, type ReactNode } from 'react';
import { ArrowRight, X } from 'lucide-react';
import useMeasure from 'react-use-measure';

export interface TransactionDetalhe {
  label: string;
  valor: string;
}

export interface TransactionItemData {
  id: string;
  icon: ReactNode;
  name: string;
  category: string;
  /** Valor já formatado (moeda). */
  amount: string;
  /** Código/identificador curto mostrado no detalhe. */
  transactionId?: string;
  date?: string;
  time?: string;
  /** Linhas extras exibidas no cartão expandido. */
  detalhes?: TransactionDetalhe[];
  /** Ação opcional no detalhe (ex: abrir a venda completa). */
  onAbrir?: () => void;
}

interface TransactionListProps {
  transactions: TransactionItemData[];
  titulo?: string;
  verTudoLabel?: string;
  onVerTudo?: () => void;
}

const springConfig: Transition = { type: 'spring', bounce: 0, duration: 0.6 };
const opacityConfig: Transition = { duration: 0.4, ease: [0.19, 1, 0.22, 1] };

export function TransactionList({ transactions, titulo = 'Últimas vendas', verTudoLabel = 'Ver todas', onVerTudo }: TransactionListProps) {
  const [open, setOpen] = useState<string | null>(null);
  const isOpen = open === null;
  const [ref, bounds] = useMeasure();

  const selected = transactions.find((t) => t.id === open) ?? null;

  return (
    <div className="overflow-hidden rounded-card border border-border-subtle bg-surface-card">
      <div className="h-px w-full bg-gradient-surface-edge" />
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border-subtle">
        <h3 className="text-2xs font-semibold uppercase tracking-wide text-text-muted truncate">{titulo}</h3>
        {onVerTudo && (
          <button onClick={onVerTudo} className="shrink-0 text-2xs font-semibold uppercase tracking-wide text-accent-soft-fg hover:opacity-80 transition-opacity duration-fast">
            {verTudoLabel}
          </button>
        )}
      </div>

      <MotionConfig transition={springConfig}>
        <motion.div className="overflow-hidden" animate={{ height: bounds.height > 0 ? bounds.height : 'auto' }}>
          <div className="p-3" ref={ref}>
            <AnimatePresence mode="popLayout">
              {isOpen ? (
                <motion.div
                  key="collapsed"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={opacityConfig}
                  className="flex w-full flex-col gap-1"
                >
                  {transactions.map((item) => (
                    <Fragment key={item.id}>
                      <TransactionRow data={item} onClick={() => setOpen(item.id)} />
                    </Fragment>
                  ))}

                  {onVerTudo && (
                    <button
                      onClick={onVerTudo}
                      className="mt-1 flex items-center justify-center gap-1 rounded-control py-1.5 text-sm text-text-muted hover:text-text-secondary transition-colors duration-fast"
                    >
                      <span>{verTudoLabel}</span>
                      <ArrowRight size={14} />
                    </button>
                  )}
                </motion.div>
              ) : (
                selected && (
                  <motion.div exit={{ opacity: 0 }}>
                    <TransactionRowExpanded data={selected} onClose={() => setOpen(null)} />
                  </motion.div>
                )
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </MotionConfig>
    </div>
  );
}

function TransactionRow({ data, onClick }: { data: TransactionItemData; onClick: () => void }) {
  return (
    <div className="flex w-full cursor-pointer items-center gap-3 rounded-control px-2 py-2 hover:bg-surface-raised transition-colors duration-fast" onClick={onClick}>
      <motion.div
        className="flex size-9 shrink-0 items-center justify-center rounded-control bg-surface-inset text-positive"
        layoutId={`tx-icon-${data.id}`}
      >
        {data.icon}
      </motion.div>

      <div className="flex flex-1 flex-col justify-center min-w-0">
        <motion.p className="text-sm font-medium text-text-primary truncate" layoutId={`tx-name-${data.id}`}>
          {data.name}
        </motion.p>
        <motion.p className="text-xs text-text-muted truncate" layoutId={`tx-cat-${data.id}`}>
          {data.category}
        </motion.p>
      </div>

      <motion.p className="shrink-0 text-sm font-medium text-positive tabular-nums" layoutId={`tx-amount-${data.id}`}>
        {data.amount}
      </motion.p>
    </div>
  );
}

function TransactionRowExpanded({ data, onClose }: { data: TransactionItemData; onClose: () => void }) {
  return (
    <div className="flex w-full flex-col gap-3 px-2 py-1">
      <div className="flex items-start justify-between">
        <motion.div
          className="flex size-10 items-center justify-center rounded-control bg-surface-inset text-positive"
          layoutId={`tx-icon-${data.id}`}
        >
          {data.icon}
        </motion.div>
        <button
          onClick={onClose}
          className="flex items-center justify-center rounded-full bg-surface-raised p-2 text-text-muted hover:text-text-primary transition-colors duration-fast"
          aria-label="Fechar detalhes"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <motion.p className="font-semibold text-text-primary truncate" layoutId={`tx-name-${data.id}`}>
            {data.name}
          </motion.p>
          <motion.p className="text-sm text-text-muted truncate" layoutId={`tx-cat-${data.id}`}>
            {data.category}
          </motion.p>
        </div>
        <motion.p className="shrink-0 text-base font-semibold text-positive tabular-nums" layoutId={`tx-amount-${data.id}`}>
          {data.amount}
        </motion.p>
      </div>

      <motion.div
        className="flex flex-col gap-2 text-xs"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ ...opacityConfig, delay: 0.1 }}
      >
        <div className="border-t border-dashed border-border-default" />
        {data.transactionId && <p className="text-text-muted">#{data.transactionId}</p>}
        {(data.date || data.time) && (
          <p className="text-text-muted tabular-nums">{[data.date, data.time].filter(Boolean).join(' · ')}</p>
        )}
        {data.detalhes && data.detalhes.length > 0 && (
          <>
            <div className="border-t border-dashed border-border-default" />
            {data.detalhes.map((d) => (
              <p key={d.label} className="flex items-center justify-between gap-3 text-text-muted">
                <span>{d.label}</span>
                <span className="font-medium text-text-secondary text-right">{d.valor}</span>
              </p>
            ))}
          </>
        )}
        {data.onAbrir && (
          <button
            onClick={data.onAbrir}
            className="mt-1 flex items-center justify-center gap-1 rounded-control py-1.5 text-sm font-medium text-accent-soft-fg hover:opacity-80 transition-opacity duration-fast"
          >
            <span>Ver venda</span>
            <ArrowRight size={14} />
          </button>
        )}
      </motion.div>
    </div>
  );
}
