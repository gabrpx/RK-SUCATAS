// Vocabulário único de animação pro Motion (springs não cabem em CSS var —
// duration/easing baseados em CSS ficam em theme.css). Todo componente que
// anima entrada/saída de painel, sheet ou modal usa um destes dois presets
// em vez de inventar um spring próprio (ver Modal.tsx e MobileBottomNav.tsx,
// que antes tinham cada um o seu).
import type { Transition } from 'motion/react';

/** Modais, bottom sheets, dropdowns grandes — entrada/saída com um leve overshoot. */
export const SPRING_SHEET: Transition = { type: 'spring', damping: 30, stiffness: 340 };

/** Elementos pequenos: cards, itens de lista, popovers — mais rígido, sem overshoot perceptível. */
export const SPRING_MICRO: Transition = { type: 'spring', damping: 26, stiffness: 420 };

/** Reveal de conteúdo em stagger (ex: cards de métrica ao montar a tela). */
export const EASE_STANDARD = [0.16, 1, 0.3, 1] as const;
