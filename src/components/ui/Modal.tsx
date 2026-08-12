// Casca compartilhada dos modais. Nasceu do Estoque, onde cada modal repetia
// backdrop, animação e header na mão e cada um tinha ficado um pouco
// diferente do outro.
//
// Por baixo usa o Dialog do Radix (foco preso, Esc, scroll-lock) — a API
// externa (aberto/onFechar/titulo/rodape) e a aparência (bottom-sheet no
// celular, centralizado no desktop) continuam as mesmas de antes.
import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { Dialog as DialogPrimitive, VisuallyHidden } from 'radix-ui';
import { X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../utils';

export type ModalSize = 'sm' | 'md' | 'lg';

const SIZE_CLASSES: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
};

export interface ModalProps {
  aberto: boolean;
  onFechar: () => void;
  titulo: string;
  /** Linha de apoio abaixo do título — contexto, contagem, aviso curto */
  subtitulo?: string;
  icone?: LucideIcon;
  tamanho?: ModalSize;
  /** Barra fixa no rodapé, normalmente os botões de ação */
  rodape?: ReactNode;
  children: ReactNode;
}

export function Modal({ aberto, onFechar, titulo, subtitulo, icone: Icone, tamanho = 'md', rodape, children }: ModalProps) {
  return (
    <DialogPrimitive.Root open={aberto} onOpenChange={(open) => { if (!open) onFechar(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-[3000] bg-overlay-scrim backdrop-blur-sm flex items-end md:items-center justify-center md:p-4"
          onClick={onFechar}
        >
          <DialogPrimitive.Content asChild onClick={(e) => e.stopPropagation()}>
            <motion.div
              initial={{ y: 24, opacity: 0, scale: 0.99 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 24, opacity: 0, scale: 0.99 }}
              transition={{ type: 'spring', damping: 30, stiffness: 340 }}
              className={cn(
                'relative w-full flex flex-col overflow-hidden bg-surface-page text-text-primary border border-border-subtle shadow-2xl outline-none',
                'max-h-[92vh] md:max-h-[85vh] rounded-t-card md:rounded-card',
                SIZE_CLASSES[tamanho]
              )}
            >
              {/* Pegador visual do bottom-sheet — só faz sentido no mobile */}
              <div className="md:hidden flex justify-center pt-3 pb-1 shrink-0">
                <div className="w-10 h-1 rounded-full bg-border-default" />
              </div>

              <header className="flex items-start gap-3 px-5 py-4 md:px-6 md:py-5 border-b border-border-subtle shrink-0">
                {Icone && (
                  <div className="size-9 rounded-control bg-accent-soft-bg text-accent-soft-fg flex items-center justify-center shrink-0">
                    <Icone size={17} />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <DialogPrimitive.Title asChild>
                    <h2 className="text-base md:text-lg font-medium leading-tight truncate">{titulo}</h2>
                  </DialogPrimitive.Title>
                  {subtitulo ? (
                    <DialogPrimitive.Description asChild>
                      <p className="text-xs text-text-faint mt-0.5">{subtitulo}</p>
                    </DialogPrimitive.Description>
                  ) : (
                    <VisuallyHidden.Root asChild>
                      <DialogPrimitive.Description>{titulo}</DialogPrimitive.Description>
                    </VisuallyHidden.Root>
                  )}
                </div>
                <DialogPrimitive.Close
                  aria-label="Fechar"
                  className="size-8 shrink-0 flex items-center justify-center rounded-control text-text-faint hover:bg-surface-raised hover:text-text-primary transition-colors"
                >
                  <X size={18} />
                </DialogPrimitive.Close>
              </header>

              <div className="flex-1 overflow-y-auto px-5 py-5 md:px-6">{children}</div>

              {rodape && <footer className="px-5 py-4 md:px-6 border-t border-border-subtle bg-surface-page shrink-0">{rodape}</footer>}
            </motion.div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Overlay>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

// Agrupa campos relacionados dentro do modal. Sem isso o formulário de peça
// vira uma lista longa de rótulos soltos e fica difícil achar onde parou.
export function ModalSection({ titulo, descricao, children }: { titulo: string; descricao?: string; children: ReactNode }) {
  return (
    <section className="py-5 first:pt-0 last:pb-0 border-b border-border-subtle/60 last:border-b-0 space-y-4">
      <div>
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted">{titulo}</h3>
        {descricao && <p className="text-xs text-text-faint mt-1">{descricao}</p>}
      </div>
      {children}
    </section>
  );
}
