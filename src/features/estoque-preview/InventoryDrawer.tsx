import * as React from "react";
import { Dialog as DialogPrimitive, VisuallyHidden } from "radix-ui";
import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";

interface InventoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

const lightInventoryTokens = {
  "--surface-page": "#f7f9fc",
  "--surface-card": "#ffffff",
  "--surface-raised": "#f8fafc",
  "--surface-overlay": "#eff6ff",
  "--surface-inset": "#f8fafc",
  "--border-subtle": "#e5edf6",
  "--border-default": "#d7e2ef",
  "--text-primary": "#0f172a",
  "--text-secondary": "#475569",
  "--text-muted": "#64748b",
  "--text-faint": "#94a3b8",
  "--accent": "#2563eb",
  "--accent-hover": "#1d4ed8",
  "--accent-soft-bg": "#eff6ff",
  "--accent-soft-fg": "#1d4ed8",
  "--danger": "#dc2626",
  "--danger-bg": "#fef2f2",
} as React.CSSProperties;

/**
 * Usa a mesma interação do drawer de Tarefas (Radix + Motion), mas fixa a
 * aparência clara desta nova operação. Não altera o drawer compartilhado,
 * pois outras telas ainda dependem dos tokens visuais legados.
 */
export function InventoryDrawer({ isOpen, onClose, title, children }: InventoryDrawerProps) {
  return <DialogPrimitive.Root open={isOpen} onOpenChange={(aberto) => { if (!aberto) onClose(); }}>
    <AnimatePresence>
      {isOpen && <DialogPrimitive.Portal forceMount>
        <DialogPrimitive.Overlay asChild forceMount>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }} className="fixed inset-0 z-[90] bg-slate-900/25 backdrop-blur-[1px]" />
        </DialogPrimitive.Overlay>
        <DialogPrimitive.Content asChild forceMount>
          <motion.aside initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 28, stiffness: 280 }} style={lightInventoryTokens} className="fixed inset-y-0 right-0 z-[91] w-full max-w-[32rem] overflow-y-auto border-l border-slate-200 bg-white text-slate-900 shadow-2xl outline-none">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white/95 p-4 backdrop-blur"><DialogPrimitive.Title className="text-base font-bold tracking-tight text-slate-900">{title}</DialogPrimitive.Title><DialogPrimitive.Close aria-label="Fechar" className="cursor-pointer rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-4 focus:ring-blue-100"><X size={18} /></DialogPrimitive.Close></div>
            <VisuallyHidden.Root asChild><DialogPrimitive.Description>Conteúdo do drawer de estoque</DialogPrimitive.Description></VisuallyHidden.Root>
            <div className="p-4 sm:p-5">{children}</div>
          </motion.aside>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>}
    </AnimatePresence>
  </DialogPrimitive.Root>;
}
