import * as React from "react";
import { Dialog as DialogPrimitive, VisuallyHidden } from "radix-ui";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { X } from "lucide-react";

interface InventoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

/**
 * Tokens claros do novo estoque = paleta da tela Tarefas (slate/blue, modo claro).
 * O tema global ainda é o escuro legado; por isso a prévia redefine TODOS os
 * tokens semânticos que usa — inclusive positive/warning/negative/info e
 * sombras — para que classes como `text-positive` ou `shadow-sm`
 * não herdem valores escuros dentro das superfícies claras. Portais (drawer,
 * diálogo) reaplicam este objeto porque são montados fora do `<main>`.
 */
export const lightInventoryTokens = {
  "--surface-page": "#f8fafc",
  "--surface-card": "#ffffff",
  "--surface-raised": "#f8fafc",
  "--surface-overlay": "#eff6ff",
  "--surface-inset": "#f8fafc",
  "--border-subtle": "#f1f5f9",
  "--border-default": "#e2e8f0",
  "--text-primary": "#0f172a",
  "--text-secondary": "#475569",
  "--text-muted": "#64748b",
  "--text-faint": "#94a3b8",
  "--accent": "#2563eb",
  "--accent-hover": "#1d4ed8",
  "--accent-soft-bg": "#eff6ff",
  "--accent-soft-fg": "#1d4ed8",
  // Disponível para venda.
  "--positive": "#047857",
  "--positive-bg": "#ecfdf5",
  // Ruptura (peça sem nenhuma unidade física).
  "--negative": "#c2410c",
  "--negative-bg": "#fff7ed",
  // Pendência de organização (sem endereço) / aviso de instalação.
  "--warning": "#b45309",
  "--warning-bg": "#fffbeb",
  "--danger": "#dc2626",
  "--danger-bg": "#fef2f2",
  "--info": "#6d28d9",
  "--info-bg": "#f5f3ff",
  "--overlay-scrim": "rgba(15, 23, 42, 0.25)",
  "--shadow-elevated-sm": "0 1px 2px rgba(15, 23, 42, 0.04)",
  "--shadow-elevated-md": "0 8px 24px rgba(15, 23, 42, 0.06)",
  "--shadow-lg": "0 16px 40px -12px rgba(15, 23, 42, 0.18)",
  "--elevation-1": "0 1px 2px rgba(15, 23, 42, 0.04)",
  "--elevation-2": "0 4px 12px -2px rgba(15, 23, 42, 0.08)",
  "--elevation-3": "0 12px 32px -8px rgba(15, 23, 42, 0.16)",
  "--elevation-4": "0 24px 60px -16px rgba(15, 23, 42, 0.22)",
  // Raios da tela Tarefas: cartões rounded-lg (8px), controles rounded-md (6px).
  "--radius-card": "8px",
  "--radius-control": "6px",
} as React.CSSProperties;

/**
 * Tokens aplicados pelo novo estoque e pelos portais dele. Na rota isolada
 * (/estoque-preview) é o tema claro acima; dentro do app (/estoque) o valor é
 * `undefined` e tudo herda o tema escuro global, igual às outras telas.
 */
export const InventoryTokensContext = React.createContext<React.CSSProperties | undefined>(lightInventoryTokens);

// Portais ficam acima do cabeçalho fixo do app (z 100) e da navegação móvel.
const Z_DRAWER = { zIndex: "var(--z-modal)" } as React.CSSProperties;
const Z_DIALOG = { zIndex: "calc(var(--z-modal) + 10)" } as React.CSSProperties;

const springLateral = { type: "spring", damping: 28, stiffness: 280 } as const;

/**
 * Usa a mesma interação do drawer de Tarefas (Radix + Motion), mas fixa a
 * aparência clara desta nova operação. Não altera o drawer compartilhado,
 * pois outras telas ainda dependem dos tokens visuais legados.
 */
export function InventoryDrawer({ isOpen, onClose, title, children }: InventoryDrawerProps) {
  const reduzirMovimento = useReducedMotion();
  const tokens = React.useContext(InventoryTokensContext);
  return <DialogPrimitive.Root open={isOpen} onOpenChange={(aberto) => { if (!aberto) onClose(); }}>
    <AnimatePresence>
      {isOpen && <DialogPrimitive.Portal forceMount>
        <DialogPrimitive.Overlay asChild forceMount>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} style={{ ...tokens, ...Z_DRAWER }} className="fixed inset-0 bg-overlay-scrim backdrop-blur-[1px]" />
        </DialogPrimitive.Overlay>
        <DialogPrimitive.Content asChild forceMount>
          <motion.aside initial={reduzirMovimento ? { opacity: 0 } : { x: "100%" }} animate={reduzirMovimento ? { opacity: 1 } : { x: 0 }} exit={reduzirMovimento ? { opacity: 0 } : { x: "100%" }} transition={reduzirMovimento ? { duration: 0.15 } : springLateral} style={{ ...tokens, ...Z_DRAWER }} className="fixed inset-y-0 right-0 w-full max-w-[32rem] overflow-y-auto overscroll-contain border-l border-border-default bg-surface-card font-[Geist,Inter,ui-sans-serif,system-ui,sans-serif] text-text-primary shadow-lg outline-none">
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border-default bg-surface-card/95 p-4 pt-[max(2.75rem,calc(env(safe-area-inset-top)+0.75rem))] backdrop-blur sm:py-4"><DialogPrimitive.Title className="min-w-0 break-words text-base font-semibold tracking-tight text-text-primary">{title}</DialogPrimitive.Title><DialogPrimitive.Close aria-label="Fechar" className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-control text-text-muted transition hover:bg-surface-inset hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"><X size={18} /></DialogPrimitive.Close></div>
            <VisuallyHidden.Root asChild><DialogPrimitive.Description>Conteúdo do drawer de estoque</DialogPrimitive.Description></VisuallyHidden.Root>
            <div className="p-4 sm:p-5">{children}</div>
          </motion.aside>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>}
    </AnimatePresence>
  </DialogPrimitive.Root>;
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
  const tokens = React.useContext(InventoryTokensContext);
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
