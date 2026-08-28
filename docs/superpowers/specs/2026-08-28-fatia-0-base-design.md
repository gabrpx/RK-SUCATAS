# Fatia 0 — Base do Design System + Kit Animate UI + Átomos Core

**Data:** 2026-08-28
**Escopo:** Fundação do novo sistema de UI. Zero mudança visível nas telas existentes; disponibiliza os primitivos que as Fatias 1–6 vão consumir.
**Fatia dentro do plano maior:** ver seção "Contexto do projeto".

---

## Contexto do projeto

O usuário pediu "substituir 100% dos componentes do site com componentes animados do Animate UI, modais, inputs; mudar como o site funciona; sugerir micro-mudanças (ex: Estado + Cidade separados em vez de campo livre 'Juazeirinho-PB')". O sistema é RK Sucatas — app operacional interno (Estoque, Vendas, Orçamentos, Clientes, Tarefas, Fiado, Caixa, ML, Shopee, Frete, Config, Push), rodando como PWA no iPhone e APK Android (Capgo OTA), com ~59 arquivos .tsx de feature e ~22k linhas.

Decisão de escopo (aprovada em conversa): **decomposição em 7 fatias**, cada uma vira seu próprio spec/plano/PR. Ordem por dependência técnica e risco:

- **Fatia 0** (este spec): base — tokens, kit Animate UI, átomos core.
- **Fatia 1:** Clientes (piloto, inclui Estado/Cidade separados).
- **Fatia 2:** Estoque + Categorias.
- **Fatia 3:** Vendas + Orçamentos + Fiado + Caixa.
- **Fatia 4:** Tarefas + Frete + Lembretes + Notificações.
- **Fatia 5:** ML + Shopee + Comprovantes + Promoções.
- **Fatia 6:** Dashboard + Configurações + Usuários + Login + Patch Notes + Motos.

Nível motion aprovado: **máximo showcase**, mas calibrado por superfície — pesado em vitrine (Login/Dashboard/PatchNotes/success states), refinado em operação (Estoque/ML/Caixa).

Abordagem escolhida: **A — Extensão incremental do design system**. Novos átomos coexistem com legado sob `src/components/ui/*`. Zero downtime; migração de imports acontece nas fatias 1–6.

---

## Design read

Produto interno operacional (não landing page nem portfólio) para dono/operadores de sucata. PWA/APK-first. Telas de densidade mista: vitrine (Dashboard/Login/PatchNotes) e cockpit (Estoque/ML/Caixa). Linguagem: **operational-elegance** com motion motivado + micro-showcase nas superfícies-vitrine. Base já é Tailwind v4 CSS-first + tokens semânticos em [theme.css](../../../src/styles/theme.css) + shadcn/tremor/motion — estender, não trocar.

Regras herdadas do [CLAUDE.md](../../../CLAUDE.md) que continuam obrigatórias:
- Cor sempre com significado, nunca decorativa.
- Um único CTA `accent` preenchido por tela.
- Todo alerta com ação associada.
- Hierarquia: número > label.

---

## Seção 1 — Tokens novos em `src/styles/theme.css`

Adicionar (não substituir nada existente):

```css
/* Motion */
--ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
--ease-in-out-quart: cubic-bezier(0.76, 0, 0.24, 1);
--ease-bounce-soft: cubic-bezier(0.34, 1.56, 0.64, 1);
--duration-hero: 700ms;
--duration-showcase: 1200ms;

/* Elevation — 4 níveis explícitos + glow do CTA */
--elevation-1: 0 1px 2px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.04);
--elevation-2: 0 4px 12px -2px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.05);
--elevation-3: 0 12px 32px -8px rgba(0,0,0,.65), inset 0 1px 0 rgba(255,255,255,.06);
--elevation-4: 0 24px 60px -16px rgba(0,0,0,.75), inset 0 1px 0 rgba(255,255,255,.08);
--elevation-glow-accent: 0 0 40px -8px rgba(242,117,28,.45);

/* Raios */
--radius-pill: 999px;
--radius-modal: 20px;
--radius-sheet-mobile: 24px 24px 0 0;

/* Foco acessível */
--focus-ring-color: var(--accent);
--focus-ring-offset: var(--surface-page);

/* Escala de z-index — mata o z-[9999] espalhado */
--z-nav: 40;
--z-dropdown: 50;
--z-modal: 60;
--z-toast: 70;
--z-tooltip: 80;
```

Mapear em `@theme inline` como `--shadow-elevation-1..4`, `--shadow-glow-accent`, `--radius-pill`, `--radius-modal` para virarem utilities Tailwind (`shadow-elevation-2`, `rounded-pill`, `rounded-modal`).

Fonte permanece Inter. Trocar fonte é rebrand pesado, não pedido.

**Preserva compat:** todos os tokens antigos (`--shadow-elevated-sm/md/lg`, `--radius-card/control/badge/sheet`, `--duration-*`, `--ease-*`) continuam intactos.

---

## Seção 2 — Kit Animate UI adotado (`src/components/animate-ui/`)

Instalar sob demanda via CLI oficial (`npx animate-ui@latest add <name>`), colocando cada primitivo no path que a lib já usa (`components/animate/`, `primitives/animate/`, `primitives/effects/`).

Primitivos adotados nesta fatia:

| Primitivo | Consumido por qual átomo |
|---|---|
| `motion-number` / `sliding-number` | `<CurrencyInput>`, `<MetricCard>` |
| `counting-number` | `<MetricCard>` |
| `ripple` | `<Button variant="accent-cta">` |
| `highlighter` | `<Combobox>`, `<CommandPalette>` |
| `tabs` (já instalado) | `<Tabs>` |
| `rolling-text` | `<StatusBadge>` |
| `typing-text` | `<EmptyState>` (opt-in), Login |
| `sparkles` | `<Toast variant="success">` (opt-in), Login |
| `magnetic` | `<Button variant="accent-cta">` (desktop-only) |
| `motion-effect` (fade/blur-in) | `<Reveal>` |
| `animated-background` | Login (Fatia 6) |
| `gradient-text` | Login H1 (Fatia 6) |
| `border-trail` | `<Card variant="highlight">` |
| `motion.div` custom springs (não é primitivo Animate UI, é wrapper interno usando `motion/react`) | primitivo do `<Modal>` reescrito |

**Não adotar:** kinetic marquee, cursor customizado, particle explosion, glitch, dome gallery, holographic foil, coverflow — são padrões de landing page, não de produto operacional.

---

## Seção 3 — Átomos core (`src/components/ui/`)

Cada átomo entrega:
- Variantes + sizes mobile (h-11) e desktop (h-9)
- Estados: default/hover/focus/active/disabled/loading/error/success
- Acessibilidade: aria, keyboard nav, focus visível
- Testes Vitest (unit; component com jsdom quando aplicável)
- Motion motivado (respeita `prefers-reduced-motion`)

Lista:

1. **`<Button>`** — extender. Novas variantes: `accent-cta` (gradient + ripple + magnetic; único preenchido por tela), `soft` (bg-accent-soft-bg), `positive` (usa token `--positive`). Novo size: `mobile` (h-11 sempre).
2. **`<Input>`** — novo. Label acima, helper, error inline, ícone left/right, clearable, `state="error|success|loading"`.
3. **`<Textarea>`** — auto-resize opt-in, contador de chars opt-in.
4. **`<Select>`** — single, substitui `CustomDropdown` variante `form`.
5. **`<Combobox>`** — busca + highlighter, virtualizado se `items.length > 100`.
6. **`<MultiSelect>`** — chips removíveis.
7. **`<StateCitySelect>`** — **componente-chave da micro-UX.** Dois selects encadeados; JSON IBGE (27 UFs + 5570 municípios) carregado lazy no primeiro `open`. API: `value={{estado, cidade}} onChange={({estado, cidade}) => …}`. Backend armazena colunas separadas `estado CHAR(2)` + `cidade TEXT`. Display helper `formatarCidade({estado, cidade}) → "Juazeirinho, PB"`.
8. **`<CepInput>`** — refactor de [cep.ts](../../../src/features/clientes/cep.ts) existente. Ao digitar CEP válido, chama ViaCEP e emite `onAutoFill({estado, cidade, bairro, rua})` que o formulário casa nos campos.
9. **`<CurrencyInput>`** — BRL. Aceita colar `R$ 1.234,56` ou `1234.56`. Display usa `motion-number`. Stepper opcional.
10. **`<PhoneInput>`** — máscara `(83) 9 9999-9999`. Backend só dígitos.
11. **`<DocInput>`** — CPF/CNPJ auto-detect por tamanho; máscara; validação de dígito verificador (rejeita `111.111.111-11`).
12. **`<DatePicker>`** — Radix Popover + `react-day-picker`. Formato BR `dd/MM/yyyy`. Range opt-in.
13. **`<TimePicker>`** — integra com o checklist de tarefas (memória: já tem horários).
14. **`<Modal>`** — **reescrever** [src/components/Modal.tsx](../../../src/components/Modal.tsx). API preservada (drop-in). Muda: spring open/close, backdrop blur crescente, escala responsiva `size="sm|md|lg|xl|full"`, `rounded-modal` no lugar de `rounded-3xl`, usa `--z-modal` no lugar de `z-[9999]`.
15. **`<Sheet>`** — bottom sheet mobile (respeita safe-area iOS), side sheet desktop. Substitui uso de modal fullscreen no mobile.
16. **`<Drawer>`** — side drawer pra formulários longos.
17. **`<Confirm>` + `useConfirm()` hook** — substitui todos os `window.confirm` do app (grepar e migrar nas fatias seguintes). Foco default em Cancelar.
18. **`<Toast>`** — refactor de [toast.tsx](../../../src/components/ui/toast.tsx). Success opt-in a sparkles.
19. **`<Tabs>`** — wrap de `animate-ui/tabs`.
20. **`<Accordion>`** — Radix + motion.
21. **`<Popover>` / `<Tooltip>`** — padronizar delays (open 200ms, close 100ms).
22. **`<Skeleton>`** — variante `shimmer` com motion.
23. **`<EmptyState>`** — ampliar existente com typing-text opt-in.
24. **`<Reveal>`** — wrapper `<motion.div>` com blur-in + stagger children. Opt-in por consumidor.
25. **`<Badge>` / `<StatusBadge>`** — StatusBadge ganha rolling-text nas transições.
26. **`<Card>` / `<MetricCard>`** — MetricCard ganha counting-number; Card ganha variante `highlight` com border-trail.
27. **`<DataTable>`** — ampliar [DataTable.tsx](../../../src/components/ui/DataTable.tsx): hover-row animado, column resize opt-in, sticky header. **Não** migrar pra TanStack (memória: v9 quebra o preview).
28. **`<Kbd>`** — mostrar atalhos (`Ctrl+K`).
29. **`<CommandPalette>`** — refactor de [GlobalSearch.tsx](../../../src/components/GlobalSearch.tsx). Highlighter nos resultados, kbd nos atalhos, spring open.

**Não mexer nesta fatia:** [CategoriaCascadeSelect.tsx](../../../src/components/CategoriaCascadeSelect.tsx), [MotoCascadeSelect.tsx](../../../src/components/MotoCascadeSelect.tsx), [TreeDropdown.tsx](../../../src/components/TreeDropdown.tsx), [OrgChart.tsx](../../../src/components/OrgChart.tsx) — domain-specific, migram nas fatias correspondentes.

---

## Seção 4 — Micro-UX guidelines cross-fatia

Uma vez definidas aqui, todas as fatias seguintes obedecem:

1. Todo campo geográfico usa `<StateCitySelect>`. Nunca campo livre "Cidade-UF". `cliente.estado` + `cliente.cidade` são colunas separadas.
2. Todo telefone brasileiro é `<PhoneInput>`. Backend só dígitos.
3. Todo CPF/CNPJ é `<DocInput>` com validação de dígito verificador.
4. Todo CEP dispara autofill via ViaCEP (usuário pode editar depois).
5. Todo valor BRL é `<CurrencyInput>`.
6. Toda confirmação destrutiva é `<Confirm>` via `useConfirm()`. Nunca `window.confirm`. Foco default em Cancelar.
7. Toda data é `<DatePicker>` em formato BR.
8. Seleção hierárquica sempre em cascata (Estado→Cidade, Marca→Modelo→Ano, Categoria→Subcategoria).
9. Um único CTA `variant="accent-cta"` por tela.
10. Toast em `success|error|warning|info` com ícone semântico.
11. Empty state sempre com CTA.
12. Loading sempre skeleton do shape final.
13. Erro de formulário sempre inline abaixo do campo.

---

## Seção 5 — Motion strategy

Escala por superfície:

| Superfície | Nível | Efeitos |
|---|---|---|
| Login (Fatia 6) | Máximo | typing-text welcome, sparkles success, animated-background, gradient-text H1, blur-in stagger nos campos |
| Splash / loading inicial | Máximo | sequence reveal, marca com sparkles |
| Dashboard / VisãoDono (Fatia 6) | Alto | counting-number nos KPIs, reveal-on-mount stagger, rolling-text em status |
| PatchNotes (Fatia 6) | Alto | border-trail no item novo, reveal-on-scroll |
| Empty states | Médio | typing-text opt-in, motion-effect fade-in |
| Success após ação | Alto pontual | sparkles no toast, ripple no botão |
| Modais / Sheets | Médio | spring open/close, backdrop blur crescente |
| Estoque (tabela grande) | Baixo | hover-row + column resize + skeleton shimmer. Sem stagger nas linhas. |
| ML sync / listas longas | Baixo | indicator de progresso animado |
| Caixa / Vendas | Médio | counting-number nos totais, spring nos modais |
| Formulários | Médio | focus ring animado, error shake sutil, success check |

Guardrails perf (não-negociáveis):
- `useReducedMotion()` do `motion/react` em toda `<Reveal>`, sparkles, typing, animated-background, magnetic.
- Só animar `transform` / `opacity` / `filter`. Nunca `width` / `height` / `top` / `left`.
- `will-change: transform` só em elementos ativamente animando.
- `backdrop-blur` só em fixed/sticky (modal, dropdown, nav).
- Splash/animated-background pausam quando aba não visível (`document.visibilitychange`).
- Detecção low-end no APK Android (`navigator.deviceMemory < 4`) → cai um nível na escala automaticamente via helper `useMotionTier()`.

---

## Seção 6 — Testes / qualidade

- **Vitest unit** por átomo (mínimo 3 casos: render default, estado disabled/error, callback disparado).
- **Vitest component (jsdom)** pra `<Modal>`, `<Confirm>`, `<Combobox>`, `<Select>`, `<Sheet>`, `<CommandPalette>` — cobrir open/close, keyboard nav (Escape, Enter, Arrow), click-outside, focus trap.
- **Máscaras (`PhoneInput`, `DocInput`, `CurrencyInput`)** — suite dedicada de casos edge (paste, backspace no meio, colar formatado).
- **`<StateCitySelect>`** — 3 asserções mínimas:
  - Mudar UF esvazia cidade.
  - Buscar "Juazeirinho" acha em PB.
  - Render de 5570 municípios não bloqueia (virtualização).
- **CPF/CNPJ** — bateria de válidos (Serasa test vectors) + inválidos (`111.111.111-11` etc).
- **Motion** — teste que `useMotionTier()` retorna `"reduced"` quando `matchMedia('(prefers-reduced-motion: reduce)').matches`.
- Sem visual regression setup nesta fatia (deferir pra Fatia 1).
- Validação visual = smoke test manual no preview (Bash `npm run dev` + tabs de teste `MobileCheckup.tsx` estilo do existente) em mobile+desktop.
- `npm test` e `npm run typecheck` verdes antes do commit final.

---

## Arquivos afetados

**Novos:**
- `src/components/ui/Button.tsx` (extensão), `Input.tsx`, `Textarea.tsx`, `Select.tsx`, `Combobox.tsx`, `MultiSelect.tsx`, `StateCitySelect.tsx`, `CepInput.tsx`, `CurrencyInput.tsx`, `PhoneInput.tsx`, `DocInput.tsx`, `DatePicker.tsx`, `TimePicker.tsx`, `Sheet.tsx`, `Drawer.tsx`, `Confirm.tsx`, `Accordion.tsx`, `Reveal.tsx`, `Kbd.tsx`
- `src/components/ui/hooks/useConfirm.ts`, `useMotionTier.ts`, `useIBGE.ts` (lazy loader do JSON)
- `src/components/ui/data/ibge-municipios.json` (~350 kB gzip; carregado on-demand via dynamic import)
- `src/components/ui/masks/cpf.ts`, `cnpj.ts`, `phone-br.ts`, `brl.ts`
- Testes Vitest correspondentes (`*.test.ts` / `*.test.tsx`) ao lado de cada arquivo.

**Reescritos (mantendo API pública):**
- [src/components/Modal.tsx](../../../src/components/Modal.tsx) — nova animação e tokens; export igual.
- [src/components/ui/toast.tsx](../../../src/components/ui/toast.tsx) — sparkles opt-in em success.
- [src/components/ui/dialog.tsx](../../../src/components/ui/dialog.tsx) — z-index via escala.
- [src/components/GlobalSearch.tsx](../../../src/components/GlobalSearch.tsx) → refactor pra usar `CommandPalette` interno.
- [src/components/ui/MetricCard.tsx](../../../src/components/ui/MetricCard.tsx) — counting-number.
- [src/components/ui/EmptyState.tsx](../../../src/components/ui/EmptyState.tsx) — typing-text opt-in.
- [src/components/ui/DataTable.tsx](../../../src/components/ui/DataTable.tsx) — hover row + column resize + sticky header opt-in.
- [src/components/ui/StatusBadge.tsx](../../../src/components/ui/StatusBadge.tsx) — rolling-text em mudança de estado.

**Alterados:**
- [src/styles/theme.css](../../../src/styles/theme.css) — adição dos tokens da Seção 1.
- `package.json` — nova deps (`react-day-picker`, primitivos do animate-ui via CLI).

**Não tocados nesta fatia:**
- Nenhum arquivo em `src/features/*` muda import. Fatias 1–6 fazem isso.

---

## Deliverable

- Zero mudança visível nas telas existentes.
- 20–29 novos átomos disponíveis para import pelas Fatias 1–6.
- Tokens novos em `theme.css`.
- Suíte de testes cresce ~40 arquivos.
- Novo item em [src/features/patchnotes/data.ts](../../../src/features/patchnotes/data.ts) descrevendo a Fatia 0 como "fundação de UI expandida" (memória: sempre atualizar patch notes).

Estimativa realista: 4–6 sessões grandes de trabalho, não 1 tacada.

---

## Riscos e mitigação

- **Bundle size:** IBGE JSON adiciona ~350 kB gzip. Mitigação: dynamic import só no primeiro `open` de `<StateCitySelect>`.
- **Regressão de motion em mobile low-end:** `useMotionTier()` degrada automaticamente com base em `deviceMemory` e `prefers-reduced-motion`.
- **Migração de imports nas fatias seguintes:** cada nova exportação vai no mesmo path/nome do legado quando possível (drop-in). Onde não dá (Input não existia), fatias documentam.
- **`window.confirm` espalhado:** grep na Fatia 1 lista todos os usos; migração acontece por feature.
- **Dev server backend não recarrega sozinho** (memória): mudanças só de UI não impactam; se algum átomo precisar de endpoint (não deve nesta fatia), o restart manual continua.

---

## Fora de escopo

- Migração das telas em si (Fatias 1–6).
- Tradução das colunas `cidade`/`estado` no banco (migration entra na Fatia 1 quando Clientes for migrado).
- Fonte nova (Inter permanece).
- ESLint rule `no-more-than-one-accent-cta` — deferido, opcional.
- Visual regression setup (Chromatic/Playwright) — deferido.
