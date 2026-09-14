# RK Sucatas — Sistema de Gestao de Estoque

> **Governanca:** [AGENTS.md](AGENTS.md) e a regra geral prevalente para qualquer agente. Contexto tecnico em [docs/AI_CONTEXT.md](docs/AI_CONTEXT.md); processo entre agentes e handoff em [docs/AI_WORKFLOW.md](docs/AI_WORKFLOW.md). Este arquivo cobre apenas produto/design e a operacao do Claude Code como executor; em conflito, vale o AGENTS.md.

## Documentacao de implementacao

O plano completo de implementacao esta em [docs/IMPLEMENTATION.md](docs/IMPLEMENTATION.md).
Os mockups das 13 telas estao em [docs/mockups/](docs/mockups/) — **leia cada imagem com `Read()` antes de implementar a tela correspondente**.

Antes de iniciar qualquer fase, leia o IMPLEMENTATION.md inteiro para entender a arquitetura, schema do banco, tokens de design e regras de negocio.

## Stack

- React 19 + TypeScript + Vite 6
- Tailwind CSS v4 (CSS-first, sem tailwind.config.js) — tokens via `@theme inline {}`
- Supabase (PostgreSQL + Auth + Storage)
- @tanstack/react-query 5 + @tanstack/react-router 1
- motion 12 (animacoes)
- **animate-ui** (componentes prontos: Radix + Motion) — NAO crie componentes do zero
- sonner (toasts) + @use-gesture/react (swipe) + lucide-react (icones)

## Design system

Os tokens de design vivem em [src/styles/theme.css](src/styles/theme.css) e sao expostos como cores/raios nomeados do Tailwind (v4, config CSS-first via `@theme inline`). Nunca escrever hex direto nos componentes — sempre usar as classes geradas (ex: `bg-surface-card`, `text-text-primary`, `rounded-card`, `text-positive`).

Regras:

- Cor sempre carrega significado; nada de cor decorativa. Cada cor semantica (`accent`, `positive`, `negative`, `warning`, `danger`) tem um proposito fixo — nao usar `positive` por "ficar verde bonito", por exemplo.
- No maximo UM botao de acento preenchido (`accent`) por tela. Acoes secundarias usam outros estilos (outline, ghost, texto).
- Todo alerta precisa ter uma acao associada, nunca so informar. Se nao ha nada que o usuario possa fazer a respeito, nao e um alerta.
- Valor numerico e o elemento mais forte do card; label e secundario. Hierarquia visual: numero > label.

## Regras de negocio

- Hierarquia: Gaveta → Variante → Unidade
- **Preco pertence a UNIDADE**, nao a variante. Variante mostra faixa min~max computada.
- Venda: selecao de unidade e OBRIGATORIA, quantidade sempre 1.
- Interface em pt-BR. Moeda: R$ com separador de milhares (.) e decimal (,).

## Componentes UI

Use animate-ui para componentes base (button, input, dialog, checkbox, skeleton, badge, radio-group, sheet, tooltip). Instale via `npx animate-ui@latest add <componente>`. Customize estilos para usar tokens do projeto — nao mude logica/acessibilidade.

## Mobile-first

Design mobile-first 375px com layout desktop a partir de 768px (sidebar + content area).

## Operacao do Claude Code

Claude Code e o executor principal. As regras gerais (papeis, continuidade, alteracoes, banco, git, conclusao e relatorio) estao em [AGENTS.md](AGENTS.md) e nao se repetem aqui. Esta secao cobre so o especifico de implementacao/design.

### Fluxo por tarefa

1. Confirme objetivo, escopo, criterios de aceitacao e testes esperados.
2. Rode `git status --short --branch`; leia AGENTS.md e docs/AI_CONTEXT.md.
3. Investigue com `rg`: tipos, rotas, APIs, componentes, hooks e implementacoes semelhantes antes de criar algo novo.
4. Para tarefas significativas, apresente plano curto.
5. Implemente o escopo aprovado, valide, revise o diff e entregue o relatorio final do AGENTS.md.

### Comandos

```powershell
npm run dev      # tsx server.ts (frontend + backend; backend nao recarrega sozinho, reinicie ao mudar rotas/services)
npm run lint     # tsc --noEmit
npm run build    # vite build + bundle do server
npm test         # vitest run
npm run cap-sync # build + cap sync android
```

### Mapa do projeto

- UI por dominio: `src/features/<dominio>/`; UI compartilhada: `src/components/`.
- Estado global: `src/context/DataContext.tsx`.
- HTTP: `src/utils/api.ts`; API Express: `server.ts` e `src/server/routes/`.
- Supabase: somente backend (`services/supabaseClient.ts`); SQL: `supabase/schema.sql` e `supabase/migration_*.sql`.

### Regras especificas de implementacao

- Mantenha UI responsiva e reutilize componentes, tokens e padroes existentes; nao crie linguagem visual nova sem escopo aprovado.
- Use animate-ui para componentes base e os tokens do design system; nunca hex direto.
- Nao coloque regras transacionais de estoque, vendas ou caixa na UI — a atomicidade pertence as RPCs Supabase (`registrar_venda`, `cancelar_venda`).
- Antes de alterar `App.tsx`, `DataContext.tsx`, `server.ts`, autenticacao ou SQL, descreva impacto; mudancas criticas exigem revisao do Codex (ver AGENTS.md).
- Toda implementacao termina com item novo em `src/features/patchnotes/data.ts`.
