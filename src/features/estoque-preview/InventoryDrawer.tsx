import * as React from "react";
import { Dialog as DialogPrimitive, VisuallyHidden } from "radix-ui";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { X } from "lucide-react";
import { OperationalDrawer } from "../../components/ui/OperationalDrawer";
import { OperationalTokensContext, operationalLightTokens } from "../../components/ui/operationalTokens";

export interface InventoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

/**
 * Tokens claros do novo estoque = paleta da tela Tarefas (slate/blue, modo claro).
 * O tema global ainda é o escuro legado; por isso a prévia redefine TODOS os
 * tokens semânticos que usa — inclusive positive/warning/negative/info e
 * sombras — para que classes como `text-positive` ou `shadow-sm`
 * não herdem valores escuros dentro das superfícies claras. Portais (drawer,
 * diálogo) reaplicam este objeto porque são montados fora do `<main>`.
 */
export { operationalLightTokens as lightInventoryTokens };

/**
 * Tokens aplicados pelo novo estoque e pelos portais dele. Na rota isolada
 * (/estoque-preview) é o tema claro acima; dentro do app (/estoque) o valor é
 * `undefined` e tudo herda o tema escuro global, igual às outras telas.
 */
export { OperationalTokensContext as InventoryTokensContext };

// Portais ficam acima do cabeçalho fixo do app (z 100) e da navegação móvel.
const Z_DIALOG = { zIndex: "calc(var(--z-modal) + 10)" } as React.CSSProperties;

/**
 * Usa a mesma interação do drawer de Tarefas (Radix + Motion), mas fixa a
 * aparência clara desta nova operação. Não altera o drawer compartilhado,
 * pois outras telas ainda dependem dos tokens visuais legados.
 */
export function InventoryDrawer({ isOpen, onClose, title, children, footer }: InventoryDrawerProps) {
  return <OperationalDrawer open={isOpen} onOpenChange={(aberto) => { if (!aberto) onClose(); }} title={title} description="Conteúdo do drawer de estoque" footer={footer}>{children}</OperationalDrawer>;
}

interface InventoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer: React.ReactNode;
}

/**
 * Diálogo central claro para confirmações do estoque (arquivar, restaurar,
 * desativar local). Radix garante foco preso, Escape e retorno de foco; Motion
 * dá entrada/saída suaves e respeita `prefers-reduced-motion`.
 */
export function InventoryDialog({ isOpen, onClose, title, eyebrow, description, children, footer }: InventoryDialogProps) {
  const reduzirMovimento = useReducedMotion();
  const tokens = React.useContext(OperationalTokensContext);
  return <DialogPrimitive.Root open={isOpen} onOpenChange={(aberto) => { if (!aberto) onClose(); }}>
    <AnimatePresence>
      {isOpen && <DialogPrimitive.Portal forceMount>
        <DialogPrimitive.Overlay asChild forceMount>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} style={{ ...tokens, ...Z_DIALOG }} className="fixed inset-0 bg-overlay-scrim" />
        </DialogPrimitive.Overlay>
        <div style={{ ...tokens, ...Z_DIALOG }} className="pointer-events-none fixed inset-0 grid place-items-center p-4">
          <DialogPrimitive.Content asChild forceMount>
            <motion.section initial={reduzirMovimento ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={reduzirMovimento ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 4 }} transition={{ type: "spring", stiffness: 380, damping: 32 }} className="pointer-events-auto w-full max-w-md rounded-card border border-border-default bg-surface-card p-6 font-[Geist,Inter,ui-sans-serif,system-ui,sans-serif] text-text-primary shadow-lg outline-none">
              {eyebrow && <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">{eyebrow}</p>}
              <DialogPrimitive.Title className="mt-1 text-xl font-semibold">{title}</DialogPrimitive.Title>
              {description ? <DialogPrimitive.Description asChild><div className="mt-3 text-sm leading-6 text-text-secondary">{description}</div></DialogPrimitive.Description> : <VisuallyHidden.Root asChild><DialogPrimitive.Description>{title}</DialogPrimitive.Description></VisuallyHidden.Root>}
              {children}
              <div className="mt-5 flex flex-wrap justify-end gap-2">{footer}</div>
            </motion.section>
          </DialogPrimitive.Content>
        </div>
      </DialogPrimitive.Portal>}
    </AnimatePresence>
  </DialogPrimitive.Root>;
}
