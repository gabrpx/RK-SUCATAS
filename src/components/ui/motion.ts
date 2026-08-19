// Presets de transição (motion/react) reutilizados pelos componentes de UI
// animados do projeto — um único lugar pra não cada componente vendor trazer
// o próprio spring embutido (inconsistência visual entre popover/checkbox/
// sugestão/expand). Ver CLAUDE.md > Design system.

// SPRING_MICRO: elementos pequenos — cards, itens de lista, popovers,
// checkboxes. Rápido e com quase nenhum overshoot, pra parecer resposta
// direta ao clique/toque, não uma animação "decorativa".
export const SPRING_MICRO = {
  type: 'spring',
  stiffness: 500,
  damping: 30,
  mass: 0.5,
} as const;
