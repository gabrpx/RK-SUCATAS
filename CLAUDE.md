## Design system

Os tokens de design vivem em [src/styles/theme.css](src/styles/theme.css) e são expostos como cores/raios nomeados do Tailwind (v4, config CSS-first via `@theme inline`). Nunca escrever hex direto nos componentes — sempre usar as classes geradas (ex: `bg-surface-card`, `text-text-primary`, `rounded-card`, `text-positive`).

Regras:

- Cor sempre carrega significado; nada de cor decorativa. Cada cor semântica (`accent`, `positive`, `negative`, `warning`, `danger`) tem um propósito fixo — não usar `positive` por "ficar verde bonito", por exemplo.
- No máximo UM botão de acento preenchido (`accent`) por tela. Ações secundárias usam outros estilos (outline, ghost, texto).
- Todo alerta precisa ter uma ação associada, nunca só informar. Se não há nada que o usuário possa fazer a respeito, não é um alerta.
- Valor numérico é o elemento mais forte do card; label é secundário. Hierarquia visual: número > label.
