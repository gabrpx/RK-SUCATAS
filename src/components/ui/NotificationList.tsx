// Pilha de notificações no estilo do animate-ui (community/notification-list):
// os cards ficam empilhados/sobrepostos e se abrem em leque ao passar o mouse
// (ou tocar). Portado pra este projeto: virou orientado a dados (recebe `itens`
// via props em vez do array fixo do template) e recolorido com os tokens do
// design system (nada de neutral-* cru). Cada card pode ter uma ação; o rodapé
// morfa de "Notificações" pra "Ver todas" quando a pilha abre.
'use client';

import * as React from 'react';
import { RotateCcw, ArrowUpRight } from 'lucide-react';
import { motion, type Transition } from 'motion/react';
import { cn } from '../../utils';
import { useHoverCapable } from './beui-tooltip';

export interface NotificationItem {
  id: string | number;
  /** Linha principal (o "o quê") — é o elemento mais forte do card. */
  title: string;
  /** Linha de apoio (contexto). */
  subtitle: string;
  /** Momento/tempo relativo, ex: "há 2 dias". */
  time: string;
  /** Contador opcional (ex: nº de itens agrupados). */
  count?: number;
  /** Ação ao clicar no card (ex: navegar pra tela relacionada). */
  onClick?: () => void;
}

interface NotificationListProps {
  itens: NotificationItem[];
  /** Rótulo do rodapé quando recolhido (default: "Notificações"). */
  label?: string;
  /** Texto/ação de "ver todas" no rodapé quando aberto. */
  verTudoLabel?: string;
  onVerTudo?: () => void;
  className?: string;
}

const transition: Transition = {
  type: 'spring',
  stiffness: 300,
  damping: 26,
};

const getCardVariants = (i: number) => ({
  collapsed: {
    marginTop: i === 0 ? 0 : -44,
    scaleX: 1 - i * 0.05,
  },
  expanded: {
    marginTop: i === 0 ? 0 : 4,
    scaleX: 1,
  },
});

const textSwitchTransition: Transition = {
  duration: 0.22,
  ease: 'easeInOut',
};

const notificationTextVariants = {
  collapsed: { opacity: 1, y: 0, pointerEvents: 'auto' },
  expanded: { opacity: 0, y: -16, pointerEvents: 'none' },
} as const;

const viewAllTextVariants = {
  collapsed: { opacity: 0, y: 16, pointerEvents: 'none' },
  expanded: { opacity: 1, y: 0, pointerEvents: 'auto' },
} as const;

export function NotificationList({
  itens,
  label = 'Notificações',
  verTudoLabel = 'Ver todas',
  onVerTudo,
  className,
}: NotificationListProps) {
  // Só os 3 primeiros entram na pilha visível — o resto fica pro "Ver todas".
  const visiveis = itens.slice(0, 3);

  // No desktop a pilha abre no hover (comportamento original, intacto). No
  // mobile não existe hover: sem isso, o toque cairia direto no onClick do card
  // do topo e navegaria pra outra tela. Aqui o primeiro toque só EXPANDE a
  // pilha in-place (mesmo painel do hover); os toques seguintes nos cards já
  // navegam normalmente.
  const canHover = useHoverCapable();
  const [expandidoTouch, setExpandidoTouch] = React.useState(false);
  const expandido = !canHover && expandidoTouch;

  return (
    <motion.div
      className={cn(
        'bg-surface-inset p-3 rounded-card w-full space-y-3 shadow-elevated-sm',
        className,
      )}
      initial="collapsed"
      animate={canHover ? undefined : expandidoTouch ? 'expanded' : 'collapsed'}
      whileHover={canHover ? 'expanded' : undefined}
      onClick={!canHover && !expandidoTouch ? () => setExpandidoTouch(true) : undefined}
    >
      <div>
        {visiveis.map((notificacao, i) => (
          <motion.div
            key={notificacao.id}
            onClick={
              // No mobile, enquanto a pilha está fechada o toque só expande
              // (tratado pelo container) — só navega depois de aberta.
              !canHover && !expandido ? undefined : notificacao.onClick
            }
            className={cn(
              'bg-surface-raised rounded-control px-4 py-2.5 shadow-elevated-sm transition-shadow duration-200 relative border border-border-subtle',
              notificacao.onClick && 'cursor-pointer hover:shadow-elevated-md',
            )}
            variants={getCardVariants(i)}
            transition={transition}
            style={{ zIndex: visiveis.length - i }}
          >
            <div className="flex justify-between items-center gap-2">
              <h4 className="text-sm font-medium text-text-primary truncate">{notificacao.title}</h4>
              {notificacao.count != null && (
                <div className="flex items-center text-xs gap-0.5 font-medium text-text-muted shrink-0">
                  <RotateCcw className="size-3" />
                  <span className="tabular-nums">{notificacao.count}</span>
                </div>
              )}
            </div>
            <div className="text-xs text-text-muted font-medium truncate">
              <span>{notificacao.time}</span>
              &nbsp;•&nbsp;
              <span>{notificacao.subtitle}</span>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <div className="size-5 rounded-full bg-accent-soft-bg text-accent-soft-fg text-xs flex items-center justify-center font-semibold tabular-nums shrink-0">
          {itens.length}
        </div>
        <span className="grid">
          <motion.span
            className="text-sm font-medium text-text-secondary row-start-1 col-start-1"
            variants={notificationTextVariants}
            transition={textSwitchTransition}
          >
            {label}
          </motion.span>
          <motion.span
            onClick={onVerTudo}
            className="text-sm font-medium text-accent-soft-fg flex items-center gap-1 cursor-pointer select-none row-start-1 col-start-1"
            variants={viewAllTextVariants}
            transition={textSwitchTransition}
          >
            {verTudoLabel} <ArrowUpRight className="size-4" />
          </motion.span>
        </span>
      </div>
    </motion.div>
  );
}
