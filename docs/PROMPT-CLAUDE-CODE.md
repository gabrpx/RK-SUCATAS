# Prompt para Claude Code — Sistema de Estoque RK Sucatas

> Cole este prompt inteiro na primeira mensagem de uma sessão nova do Claude Code (Sonnet 4 para economia, Opus 4 para a Fase 1).

---

## Objective

Implementar o módulo completo de estoque do sistema RK Sucatas: um app React que gerencia peças automotivas de desmanche organizadas em uma hierarquia de 3 níveis (Gaveta → Variante → Unidade), com fluxo de vendas, busca fuzzy, migração/organização, e ações em lote. O sistema já tem documentação completa em `docs/IMPLEMENTATION.md` e mockups visuais em `docs/mockups/`.

## Context

Este é um sistema de gestão de estoque para um desmanche de motos/carros (sucata). O dono compra motos/carros batidos, desmonta, separa as peças e revende. As peças são organizadas assim:

### Hierarquia de 3 Níveis — ENTENDA ISTO PRIMEIRO

```
GAVETA (agrupamento lógico por tipo de peça)
  └── VARIANTE (modelo específico + ano + condição)
       └── UNIDADE (peça física individual com preço próprio)
```

**Exemplo real do negócio:**

```
Gaveta: "Tanque CG 125"  ← agrupa TODOS os tanques de CG 125
  ├── Variante: "CG 125 Fan · Original · 2014-2018 · Usado"
  │     ├── Unidade #1: apelido "A do risco", valor R$80, nota 7, avaria: sim
  │     ├── Unidade #2: apelido "Boa", valor R$120, nota 9
  │     └── Unidade #3: sem apelido, valor R$90, cadastro mínimo (só preço)
  └── Variante: "CG 125 Fan · Paralela · 2009-2018 · Novo"
        └── Unidade #1: valor R$65
```

### Regras de Negócio CRÍTICAS — não viole nenhuma

1. **PREÇO pertence à UNIDADE, nunca à Variante.** A variante NÃO tem campo de preço. Ela mostra apenas a faixa computada (min~max) das suas unidades disponíveis. Se uma variante tem 3 unidades (R$80, R$90, R$120), a variante exibe "R$80 ~ R$120".

2. **Venda exige seleção de UNIDADE obrigatória.** Não existe venda de "variante" — o usuário DEVE selecionar qual unidade física está vendendo. Quantidade é sempre 1 (uma peça física).

3. **Gaveta é nome 100% manual.** O usuário digita o nome. Sem sugestão automática, sem autocomplete de nome de gaveta.

4. **Edição inline** dos campos das variantes (nome, ano, tipo) direto na tela de detalhe da gaveta — sem modal separado para editar variante.

5. **Cadastro mínimo de unidade:** só o preço é obrigatório. Apelido, nota, fotos, anos são opcionais. Unidades com cadastro mínimo mostram ícone ⚠️ amarelo + texto "Cadastro mínimo".

6. **Badges de condição:** Original (laranja), Paralela (roxo), Novo (azul). Badges de plataforma: ML (amarelo), Shopee (rosa).

7. **Interface 100% em pt-BR.** Moeda: R$ com separador de milhares (.) e decimal (,). Ex: R$1.250,00.

### O que é uma "Gaveta" — analogia

Pense numa gaveta física de oficina. Você tem uma gaveta etiquetada "Tanque CG 125". Dentro dela, você separa por tipo: originais, paralelas, novos, usados, por faixa de ano. Cada separação é uma "variante". E cada peça individual dentro de cada separação é uma "unidade" — cada uma tem seu próprio estado, condição, preço.

O sistema digitaliza essa organização. A tela principal (T01) mostra todas as gavetas. Clicar numa gaveta (T02) mostra as variantes e suas unidades. Dentro de cada variante tem um botão "+ Unidade" que abre o form inline (T03).

### Itens Não Agrupados

Variantes podem existir sem gaveta (gaveta_id = null). Esses itens aparecem numa seção separada "ITENS NÃO AGRUPADOS" no final da listagem (T01), com badge "SEM GRUPO" e visual dimmed. A tela de Migração (T07) permite selecionar esses itens e agrupá-los em gavetas novas ou existentes.

## Target State

O app rodando com `npm run dev` (Vite) exibindo todas as 13 telas do mockup, conectado ao Supabase, com:

- Listagem de gavetas com stats, filtros por categoria, busca
- Detalhe de gaveta com variantes, unidades, edição inline
- Form de adicionar unidade com upload de fotos
- Fluxo de venda em 3 steps (selecionar unidade → preencher dados → confirmação animada)
- Busca fuzzy via pg_trgm
- Migração/organização de itens não agrupados
- Swipe-to-delete com undo
- Ações em lote (mover, excluir)
- Skeleton loading, toasts, estados vazios, alerta de duplicata, barra offline
- Dark theme (padrão) + light theme
- Mobile-first 375px com layout desktop a partir de 768px

## Scope

- Trabalhe SOMENTE em `src/` e nos arquivos da raiz do projeto (package.json, vite.config.ts, tsconfig.json, etc.)
- Leia `docs/IMPLEMENTATION.md` — ele contém TODO o schema SQL, tokens de design, estrutura de arquivos, e descrição de cada tela
- Leia cada mockup com `Read("docs/mockups/T0X-nome.png")` ANTES de implementar a tela correspondente
- NÃO toque em `docs/` (é referência, não código)

## Constraints

### Stack (versões exatas no IMPLEMENTATION.md)

- React 19 + TypeScript + Vite 6
- **Tailwind CSS v4 — CSS-first, SEM tailwind.config.js** — tokens vivem em `src/styles/tailwind.css` dentro de `@theme inline {}`
- Supabase (PostgreSQL + Auth + Storage)
- @tanstack/react-query 5 + @tanstack/react-router 1
- motion 12 (animações)
- **animate-ui** para componentes base — NÃO crie componentes do zero
- sonner (toasts) + @use-gesture/react (swipe) + lucide-react (ícones)

### animate-ui — COMO USAR

```bash
npx animate-ui@latest add button
npx animate-ui@latest add dialog
npx animate-ui@latest add input
# ... etc (lista completa no IMPLEMENTATION.md)
```

Instale os componentes via CLI. Eles vão para `src/components/ui/`. Depois, customize os ESTILOS para usar os tokens do projeto (cores, raios, sombras). NÃO mude a lógica ou acessibilidade dos componentes — apenas adapte visualmente.

Para componentes que animate-ui NÃO oferece (stats-row, filter-chips, swipe-row, currency-input, chip-toggle de pagamento), crie manualmente usando Radix primitives + Motion para animações.

### Design System

Tokens já definidos no IMPLEMENTATION.md. Copie o bloco `@theme inline {}` completo para `src/styles/tailwind.css`. Nunca escreva hex direto nos componentes — sempre use classes geradas pelo Tailwind (ex: `bg-surface-card`, `text-text-primary`, `rounded-card`, `text-positive`).

Regras visuais:
- Cor sempre carrega significado — nada de cor decorativa
- Máximo UM botão accent preenchido por tela
- Todo alerta precisa ter uma ação associada
- Hierarquia visual: número > label (valor numérico é o elemento mais forte do card)

### Fontes

- Inter (body) — importar via Google Fonts
- DM Sans (display/títulos)
- JetBrains Mono (mono/preços)

## Acceptance Criteria

- [ ] `npm run dev` inicia sem erros
- [ ] `tsc --noEmit` sem erros de tipo
- [ ] T01: listagem de gavetas com stats-row, filtros por categoria, seção "itens não agrupados"
- [ ] T02: detalhe da gaveta com variantes expandidas, unidades listadas, edição inline, badges
- [ ] T02: variante mostra faixa de preço computada das unidades (min~max), NÃO um preço fixo
- [ ] T03: form inline de nova unidade dentro do card da variante, com upload de fotos
- [ ] T04: modal de venda com seleção OBRIGATÓRIA de unidade via radio buttons
- [ ] T05: dados da venda com chip-toggle de pagamento, valor pré-preenchido editável, QTD travado em 1
- [ ] T06: busca fuzzy com resultados agrupados por gaveta, keyboard navigation
- [ ] T07: migração — selecionar itens não agrupados e criar/mover para gaveta
- [ ] T08: swipe-to-delete em unidades com undo via toast (5s)
- [ ] T09: skeleton loading em todas as telas durante carregamento
- [ ] T10: animação de sucesso de venda (checkmark SVG animado + confetti)
- [ ] T11: long-press 500ms ativa modo de seleção múltipla com toolbar accent
- [ ] T12: toasts customizados (success, warning, danger, sale) via sonner
- [ ] T13: empty state, offline bar, alerta de duplicata de gaveta
- [ ] Dark theme funcional (padrão) + light theme via prefers-color-scheme
- [ ] Mobile-first 375px → desktop 768px+ com sidebar

## Stop Conditions

Pare e pergunte antes de:
- Deletar qualquer arquivo existente
- Adicionar dependência não listada na stack
- Modificar o schema SQL (ele já está definido no IMPLEMENTATION.md)
- Criar componentes do zero quando animate-ui oferece equivalente
- Mudar a estrutura de arquivos definida no IMPLEMENTATION.md

## Fases de Implementação

Siga esta ordem. Não pule fases.

### Fase 1 — Setup + Estoque CRUD (T01, T02, T03, T09, T13)

1. Instalar todas as dependências
2. Configurar Tailwind v4 CSS-first com tokens completos
3. Instalar componentes animate-ui via CLI
4. Criar utilities: `cn()`, `formatCurrency()`, `formatDate()`
5. Configurar Supabase client + React Query provider + React Router
6. **Read("docs/mockups/T01-listagem-gavetas.png")** → implementar listagem
7. **Read("docs/mockups/T02-detalhe-gaveta.png")** → implementar detalhe
8. **Read("docs/mockups/T03-adicionar-unidade.png")** → implementar form de unidade
9. **Read("docs/mockups/T09-skeleton-loading.png")** → skeleton em todas as telas
10. **Read("docs/mockups/T13-estados-preventivos.png")** → empty state, offline, duplicata

### Fase 2 — Vendas + Busca (T04, T05, T06, T10)

1. **Read** cada mockup antes de implementar
2. Modal de venda em 3 steps
3. Busca fuzzy com pg_trgm
4. Animação de confirmação de venda

### Fase 3 — Gestão Avançada (T07, T08, T11, T12)

1. **Read** cada mockup antes de implementar
2. Migração/organização
3. Swipe-to-delete
4. Ações em lote
5. Toasts customizados

### Fase 4 — Layout Responsivo + Polish

1. App shell responsivo (mobile → desktop com sidebar)
2. Todas as animações via Motion 12
3. Validar dark/light theme
4. Testar todos os fluxos end-to-end

## Session Strategy

Nova sessão. Comece lendo `docs/IMPLEMENTATION.md` inteiro, depois siga as fases em ordem. Use `/compact` quando atingir ~50% do contexto, focando no que falta implementar.

Think carefully before starting. Leia o IMPLEMENTATION.md completo e todos os mockups relevantes antes de escrever código.

## Progress

Após cada etapa concluída: ✅ [o que foi feito] — [arquivo(s) afetado(s)]
