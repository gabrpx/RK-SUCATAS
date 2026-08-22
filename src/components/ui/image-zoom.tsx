// Miniatura que abre em tela cheia ao clique. Equivalente local ao Image Zoom
// do animate-ui, escrito aqui pra já nascer nos tokens do design system e nas
// restrições desta base:
//
// - Abre SÓ no clique (nunca no hover): na WebView do Capacitor o hover é
//   simulado pelo toque e abriria sozinho ao rolar a lista.
// - O fundo é um scrim sólido, não `backdrop-blur` — blur está desligado em
//   telas ≤768px por custo de render (ver theme.css), então um efeito que
//   sumisse justamente no mobile não serviria.
// - A transição é `layoutId`: a miniatura vira a imagem grande, em vez de
//   aparecer uma segunda imagem do nada. Com `prefers-reduced-motion` a troca
//   é imediata.
//
// Renderiza em portal porque as miniaturas vivem dentro de painéis com
// `overflow: hidden` (linha expandida do Estoque), que recortariam o overlay.
import * as React from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { X } from 'lucide-react';

import { SPRING_SHEET } from './motion';
import { cn } from '../../utils';

type ImageZoomProps = {
  src: string;
  alt: string;
  /** Classe da MINIATURA (o overlay tem tamanho próprio). */
  className?: string;
  /**
   * Classe do botão que envolve a miniatura. Use quando a miniatura precisa
   * preencher um container que já existe (ex: a grade de fotos do upload, onde
   * o quadro tem borda, badge de capa e botão de remover por cima).
   */
  triggerClassName?: string;
  referrerPolicy?: React.ImgHTMLAttributes<HTMLImageElement>['referrerPolicy'];
};

export function ImageZoom({ src, alt, className, triggerClassName, referrerPolicy }: ImageZoomProps) {
  const [aberto, setAberto] = React.useState(false);
  const reduce = useReducedMotion();
  const transition = reduce ? { duration: 0 } : SPRING_SHEET;
  const layoutId = React.useId();

  React.useEffect(() => {
    if (!aberto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAberto(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [aberto]);

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setAberto(true);
        }}
        aria-label={`Ampliar ${alt}`}
        className={cn(
          'rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
          triggerClassName,
        )}
      >
        <motion.img
          layoutId={aberto ? undefined : layoutId}
          src={src}
          alt={alt}
          referrerPolicy={referrerPolicy}
          className={cn('block object-cover', className)}
        />
      </button>

      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {aberto && (
              <motion.div
                // Clicar em qualquer lugar fecha — é o gesto esperado num
                // visualizador de foto, e o X fica pra quem procura o controle.
                onClick={(e) => {
                  e.stopPropagation();
                  setAberto(false);
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={transition}
                className="fixed inset-0 z-[3000] flex items-center justify-center bg-overlay-scrim-strong p-4"
                role="dialog"
                aria-modal="true"
                aria-label={alt}
              >
                <motion.img
                  layoutId={layoutId}
                  src={src}
                  alt={alt}
                  referrerPolicy={referrerPolicy}
                  transition={transition}
                  className="max-h-full max-w-full rounded-card object-contain shadow-lg"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setAberto(false);
                  }}
                  aria-label="Fechar"
                  className="absolute right-4 top-4 flex size-11 items-center justify-center rounded-control border border-border-default bg-surface-card text-text-secondary hover:text-text-primary"
                >
                  <X size={18} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}
