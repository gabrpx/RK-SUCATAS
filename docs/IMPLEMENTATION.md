# Plano de Implementacao — Modulo de Estoque RK Sucatas

> **LEIA ESTE DOCUMENTO INTEIRO antes de implementar qualquer coisa.**
> Ele e o unico arquivo de referencia necessario. Os mockups visuais estao em `docs/mockups/`.
> Voce DEVE olhar cada imagem de mockup com a tool Read antes de implementar a tela correspondente.

---

## Visao Geral do Sistema

Sistema de gestao de estoque para desmanche automotivo (sucata). O usuario gerencia pecas de motos/carros organizadas em uma hierarquia de 3 niveis:

```
GAVETA (agrupamento logico)
  └── VARIANTE (modelo/ano/condicao)
       └── UNIDADE (peca individual com preco proprio)
```

**Exemplo concreto:**
- Gaveta: "Tanque CG 125"
- Variante: "CG 125 Fan · Original · 2014-2018 · Usado"
- Unidade: #1 "A do risco" R$80 | #2 "Boa" R$120 | #3 incompleto R$90

### Regra de Negocio Critica

**PRECO pertence a UNIDADE, nao a Variante.** A variante exibe apenas a faixa computada (min~max) das suas unidades disponiveis. Cada unidade tem seu preco individual. Na venda, selecionar uma unidade especifica e OBRIGATORIO — quantidade e sempre 1.

---

## Stack Tecnica

| Tecnologia | Versao | Uso |
|---|---|---|
| React | 19.x | UI framework |
| TypeScript | 5.x | Tipagem |
| Vite | 6.x | Bundler |
| Tailwind CSS | 4.x | **CSS-first** (sem tailwind.config.js) — tokens via `@theme inline {}` |
| Supabase | 2.x | PostgreSQL + Auth + Storage |
| @tanstack/react-query | 5.x | Server state, cache, mutations |
| @tanstack/react-router | 1.x | Routing type-safe |
| motion | 12.x | Animacoes (ex framer-motion) |
| animate-ui | latest | **Componentes prontos animados** (Radix + Motion) |
| sonner | latest | Toast notifications |
| @use-gesture/react | latest | Swipe gestures |
| lucide-react | latest | Icones SVG |
| clsx + tailwind-merge | latest | cn() utility |

### IMPORTANTE: Use animate-ui

**NAO crie componentes do zero.** O projeto usa [animate-ui](https://www.animate-ui.com/) que fornece componentes prontos, animados e acessiveis baseados em Radix UI + Motion. Instale e use:

```bash
npx animate-ui@latest add button
npx animate-ui@latest add dialog
npx animate-ui@latest add input
npx animate-ui@latest add select
npx animate-ui@latest add checkbox
npx animate-ui@latest add dropdown-menu
npx animate-ui@latest add tooltip
npx animate-ui@latest add accordion
npx animate-ui@latest add tabs
npx animate-ui@latest add radio-group
npx animate-ui@latest add sheet        # para modais bottom-sheet no mobile
npx animate-ui@latest add skeleton
npx animate-ui@latest add badge
```

Depois de instalar, **customize os estilos** para usar os tokens de design do projeto (cores, raios, sombras). Nao mude a logica/acessibilidade dos componentes — apenas adapte visualmente.

Para componentes que animate-ui nao oferece (chips de filtro, swipe-row, stats-row), crie manualmente usando Radix primitives + Motion para animacoes.

---

## Tailwind v4 CSS-First

O Tailwind v4 **NAO usa tailwind.config.js**. Toda configuracao e feita no CSS:

```css
/* src/styles/tailwind.css */
@import "tailwindcss";

@theme inline {
  /* === FUNDOS === */
  --color-ground: #121214;
  --color-surface: #1C1C1E;
  --color-surface-card: #242426;
  --color-surface-raised: #2A2A2C;

  /* === TEXTO === */
  --color-text-primary: #E8E6E0;
  --color-text-secondary: #A0A09A;
  --color-text-muted: #6A6A64;

  /* === ACENTO (laranja RK) === */
  --color-accent: #FB923C;
  --color-accent-hover: #FDBA74;
  --color-accent-light: #2E1E14;
  --color-accent-text: #FFFFFF;

  /* === SEMANTICAS === */
  --color-positive: #4ADE4A;
  --color-positive-light: #1A2E1A;
  --color-negative: #EF5350;
  --color-negative-light: #2E1A1A;
  --color-warning: #D4A843;
  --color-warning-light: #2A2418;
  --color-danger: #EF5350;
  --color-danger-light: #2E1A1A;

  /* === BORDAS === */
  --color-border: #2C2C2E;
  --color-border-light: #242426;

  /* === BADGES === */
  --color-badge-original: #FB923C;
  --color-badge-original-bg: #2E2010;
  --color-badge-paralela: #A78BFA;
  --color-badge-paralela-bg: #1E1A2E;
  --color-badge-novo: #64B5F6;
  --color-badge-novo-bg: #162438;
  --color-badge-ml: #FFB74D;
  --color-badge-ml-bg: #2E2010;
  --color-badge-shopee: #EF9A9A;
  --color-badge-shopee-bg: #2E1A1A;

  /* === RAIOS === */
  --radius-xs: 6px;
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-card: 12px;
  --radius-button: 8px;
  --radius-input: 8px;
  --radius-chip: 999px;
  --radius-badge: 4px;

  /* === SOMBRAS === */
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.2);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.25);
  --shadow-lg: 0 8px 30px rgba(0,0,0,0.35);

  /* === FONTES === */
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-display: 'DM Sans', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
}

/* Light theme override */
@media (prefers-color-scheme: light) {
  :root:not([data-theme="dark"]) {
    --color-ground: #EEECEA;
    --color-surface: #FFFFFF;
    --color-surface-card: #FFFFFF;
    --color-surface-raised: #F5F5F3;
    --color-text-primary: #1A1A18;
    --color-text-secondary: #5C5C56;
    --color-text-muted: #8A8A84;
    --color-accent: #E8590C;
    --color-accent-hover: #C74B0A;
    --color-accent-light: #FFF1EB;
    --color-border: #E0DED8;
    --color-border-light: #ECEAE4;
    --color-positive: #2D6B27;
    --color-positive-light: #E8F5E8;
    --color-negative: #C43838;
    --color-negative-light: #FDEAEA;
    --color-warning: #B8860B;
    --color-warning-light: #FEF6E0;
    --color-danger: #C43838;
    --color-danger-light: #FDEAEA;
  }
}
:root[data-theme="light"] {
  /* mesmos valores light acima */
}
```

**Uso em componentes:**
```tsx
// CORRETO — usa tokens semanticos
<div className="bg-surface-card text-text-primary rounded-card border border-border">
<button className="bg-accent text-accent-text rounded-button hover:bg-accent-hover">

// ERRADO — nunca use cores cruas do Tailwind
<div className="bg-zinc-900 text-white rounded-lg">
```

### Regras do Design System (de CLAUDE.md)

1. **Cor sempre carrega significado** — nao use cor decorativa
2. **Maximo UM botao accent preenchido por tela** — secundarios usam outline/ghost
3. **Todo alerta precisa ter acao** — se nao ha o que fazer, nao e alerta
4. **Hierarquia visual: numero > label** — valor numerico e o elemento mais forte

---

## Schema do Banco de Dados

Execute no SQL Editor do Supabase, nesta ordem:

### 1. Extensao

```sql
create extension if not exists pg_trgm;
```

### 2. Tabelas

```sql
create table categorias (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null unique,
  icone       text,
  created_at  timestamptz default now()
);

create table gavetas (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null,
  categoria_id  uuid references categorias(id) on delete set null,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create table variantes (
  id            uuid primary key default gen_random_uuid(),
  gaveta_id     uuid not null references gavetas(id) on delete cascade,
  nome          text not null,
  tipo          text default 'original' check (tipo in ('original', 'paralela')),
  condicao      text default 'usado' check (condicao in ('novo', 'usado')),
  ano_de        int,
  ano_ate       int,
  imagem_url    text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create table unidades (
  id            uuid primary key default gen_random_uuid(),
  variante_id   uuid not null references variantes(id) on delete cascade,
  apelido       text,
  valor         numeric(10,2) not null,
  nota          int check (nota between 1 and 10),
  avaria        boolean default false,
  avaria_desc   text,
  ano_de        int,
  ano_ate       int,
  status        text default 'disponivel' check (status in ('disponivel', 'vendido', 'reservado')),
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create table unidade_fotos (
  id          uuid primary key default gen_random_uuid(),
  unidade_id  uuid not null references unidades(id) on delete cascade,
  url         text not null,
  posicao     int default 0,
  created_at  timestamptz default now()
);

create table vendas (
  id            uuid primary key default gen_random_uuid(),
  unidade_id    uuid not null references unidades(id),
  valor         numeric(10,2) not null,
  pagamento     text not null check (pagamento in ('pix','dinheiro','cartao','ml','shopee','fiado')),
  cliente       text,
  observacao    text,
  data_venda    date default current_date,
  created_at    timestamptz default now()
);

create table variante_plataformas (
  id            uuid primary key default gen_random_uuid(),
  variante_id   uuid not null references variantes(id) on delete cascade,
  plataforma    text not null check (plataforma in ('ml', 'shopee')),
  link          text,
  unique(variante_id, plataforma)
);
```

### 3. Views

```sql
create view gaveta_stats as
select
  g.id as gaveta_id,
  count(distinct v.id) as total_variantes,
  count(distinct u.id) filter (where u.status = 'disponivel') as total_unidades,
  min(u.valor) filter (where u.status = 'disponivel') as preco_min,
  max(u.valor) filter (where u.status = 'disponivel') as preco_max
from gavetas g
left join variantes v on v.gaveta_id = g.id
left join unidades u on u.variante_id = v.id
group by g.id;

create view variante_stats as
select
  v.id as variante_id,
  count(u.id) filter (where u.status = 'disponivel') as total_unidades,
  min(u.valor) filter (where u.status = 'disponivel') as preco_min,
  max(u.valor) filter (where u.status = 'disponivel') as preco_max
from variantes v
left join unidades u on u.variante_id = v.id
group by v.id;
```

### 4. Indices

```sql
create index idx_variantes_gaveta on variantes(gaveta_id);
create index idx_unidades_variante on unidades(variante_id);
create index idx_unidades_status on unidades(status);
create index idx_vendas_data on vendas(data_venda desc);
create index idx_gavetas_nome_trgm on gavetas using gin (nome gin_trgm_ops);
create index idx_variantes_nome_trgm on variantes using gin (nome gin_trgm_ops);
```

### 5. RLS

```sql
alter table gavetas enable row level security;
alter table variantes enable row level security;
alter table unidades enable row level security;
alter table vendas enable row level security;
alter table unidade_fotos enable row level security;
alter table variante_plataformas enable row level security;

-- Acesso autenticado em todas
create policy "auth_all" on gavetas for all using (auth.uid() is not null);
create policy "auth_all" on variantes for all using (auth.uid() is not null);
create policy "auth_all" on unidades for all using (auth.uid() is not null);
create policy "auth_all" on vendas for all using (auth.uid() is not null);
create policy "auth_all" on unidade_fotos for all using (auth.uid() is not null);
create policy "auth_all" on variante_plataformas for all using (auth.uid() is not null);
```

### 6. Funcao de busca

```sql
create or replace function buscar_estoque(termo text)
returns table (
  tipo text,
  id uuid,
  nome text,
  gaveta_nome text,
  categoria text,
  preco_min numeric,
  preco_max numeric,
  unidades bigint
) as $$
begin
  return query
  select 'variante', v.id, v.nome, g.nome, c.nome,
    vs.preco_min, vs.preco_max, vs.total_unidades
  from variantes v
  join gavetas g on g.id = v.gaveta_id
  left join categorias c on c.id = g.categoria_id
  left join variante_stats vs on vs.variante_id = v.id
  where v.nome % termo or g.nome % termo
  order by similarity(v.nome, termo) desc
  limit 20;
end;
$$ language plpgsql;
```

---

## Estrutura de Arquivos

```
src/
├── main.tsx
├── App.tsx
├── styles/
│   └── tailwind.css            # Tokens via @theme inline {}
├── lib/
│   ├── supabase.ts             # createClient
│   ├── utils.ts                # cn(), formatCurrency(), formatDate()
│   └── hooks/
│       ├── use-gavetas.ts      # CRUD gavetas (React Query)
│       ├── use-variantes.ts
│       ├── use-unidades.ts
│       ├── use-vendas.ts
│       ├── use-search.ts       # Busca fuzzy via pg_trgm
│       ├── use-swipe.ts        # @use-gesture/react
│       ├── use-batch.ts        # Selecao multipla
│       └── use-media.ts        # Upload fotos Supabase Storage
├── components/
│   ├── ui/                     # animate-ui components (instalados via CLI)
│   ├── layout/
│   │   ├── app-shell.tsx       # Responsive shell (mobile/desktop)
│   │   ├── sidebar.tsx         # Desktop sidebar
│   │   ├── header.tsx
│   │   ├── bottom-bar.tsx
│   │   └── offline-bar.tsx
│   ├── estoque/
│   │   ├── gaveta-list.tsx     # T01
│   │   ├── gaveta-row.tsx
│   │   ├── gaveta-detail.tsx   # T02
│   │   ├── variante-card.tsx
│   │   ├── unidade-row.tsx
│   │   ├── unidade-form.tsx    # T03
│   │   ├── search-overlay.tsx  # T06
│   │   ├── stats-row.tsx
│   │   ├── filter-chips.tsx
│   │   ├── batch-toolbar.tsx   # T11
│   │   ├── swipe-row.tsx       # T08
│   │   ├── empty-state.tsx     # T13
│   │   └── dup-warning.tsx     # T13
│   ├── vendas/
│   │   ├── venda-modal.tsx     # Container 3 steps
│   │   ├── step-unidade.tsx    # T04
│   │   ├── step-dados.tsx      # T05
│   │   ├── venda-success.tsx   # T10
│   │   └── unit-selector.tsx
│   └── migracao/
│       ├── migration-view.tsx  # T07
│       └── gaveta-preview.tsx
├── pages/
│   ├── estoque.tsx
│   ├── vendas.tsx
│   └── migracao.tsx
└── types/
    └── database.ts
```

---

## Mockups — Como Interpretar

Os mockups estao em `docs/mockups/`. **Leia cada imagem antes de implementar a tela correspondente.**

### T01 — Listagem de Gavetas (`T01-listagem-gavetas.png`)

**O que o mockup mostra:**
- Header: "Estoque" + botao "+ Nova Gaveta" (accent outline)
- Search bar com placeholder "Buscar peca, modelo, codigo..."
- Stats row: 4 pills horizontais (Gavetas: 247, Variantes: 812, Unidades: 1.439, Valor total: R$...)
  - **Hierarquia: numero grande em cima, label menor embaixo**
- Filter chips: "Todas" (accent preenchido), "Tanques", "Farois", "CDIs", "Carenagens" (outline)
- Lista de gavetas, cada row: icone emoji | nome + meta (categoria . N variantes) | faixa preco R$min - R$max | N un. (accent)
- Secao "ITENS NAO AGRUPADOS" com divider e badge "SEM GRUPO" em rows dimmed

**Componentes necessarios:** stats-row, filter-chips, gaveta-row, empty-state (T13)
**animate-ui:** button, input (search), skeleton (T09), badge

### T02 — Detalhe da Gaveta (`T02-detalhe-gaveta.png`)

**O que o mockup mostra:**
- Back nav: "< Estoque"
- Titulo grande editavel inline "Tanque CG 125" com icone de lapis
- Meta: "Tanques . 4 variantes . 8 unidades . R$80 ~ R$130"
- Cards de variante em stack vertical:
  - Thumbnail placeholder | nome "CG 125 Fan" | badge "ORIGINAL" (laranja) | faixa ano "2014-2018 . Usado"
  - Icone lapis para edicao inline | badge "ML" no canto
  - Preco computado "R$80 ~ R$120" | "3 un." (accent)
  - Lista de unidades dentro do card: dot status + apelido entre aspas + nota + preco
  - Unidade incompleta: icone warning amarelo + "Cadastro minimo"
  - Botao "+ Unidade" (accent outline) abre form inline (T03)
- Variante em edicao inline: campos ano_de / ano_ate com borda accent + hint "Enter para salvar"
- Badge "NOVO" (azul), badge "PARALELA" (roxo), badges "ML" e "SHOPEE"

**Componentes:** variante-card, unidade-row, badge (original/paralela/novo/ml/shopee)
**animate-ui:** button, badge, tooltip, input (inline edit)

### T03 — Adicionar Unidade (`T03-adicionar-unidade.png`)

**O que o mockup mostra:**
- Form inline que aparece DENTRO do card da variante
- Header "NOVA UNIDADE" com borda accent
- Campo obrigatorio: valor "R$ 95,00" (input bold, grande) + apelido (opcional)
- Compatibilidade (ano): dois inputs lado a lado "2014" a "2020"
- Checkbox "Avaria"
- Area de fotos: icone + "Anexar fotos (opcional)" + hint "ate 5 fotos"
- Thumbnails de fotos com botao X vermelho para remover
- Botoes: "Salvar" (accent preenchido) + "Cancelar" (ghost)

**animate-ui:** input, checkbox, button
**Customizado:** currency-input (mascara R$), foto-uploader

### T04 — Nova Venda: Selecao de Unidade (`T04-nova-venda-selecao-unidade.png`)

**O que o mockup mostra:**
- Modal fullscreen com titulo "Nova Venda" + X para fechar
- Step indicator: 3 barras horizontais (step 2 ativo = accent)
- Card resumo variante selecionada: "CG 125 Fan . Original" | "Tanque CG 125 . 2014-2018" | "3 un."
- Label "SELECIONE A UNIDADE *" (obrigatorio)
- Radio list de unidades: thumbnail | apelido | nota | preco
- Unidade selecionada: borda accent + radio dot preenchido + background accent-light
- Unidade com warning: icone amarelo + "Cadastro minimo"
- Botao "Continuar - R$120" (accent, desabilitado ate selecionar)

**REGRA:** Selecao de unidade e OBRIGATORIA. Sem selecionar, botao fica disabled.

**animate-ui:** dialog (fullscreen), radio-group, button

### T05 — Nova Venda: Dados (`T05-nova-venda-dados.png`)

**O que o mockup mostra:**
- Step 3 do modal
- Resumo no topo: "Tanque CG 125 . Fan 2014-2018" | "Unidade #2 'Boa' . Nota 9" | link "Alterar"
- Campo VALOR: pre-preenchido "R$ 120,00" (input grande, bold) — editavel
- Campo QTD: "1" (disabled, travado)
- PAGAMENTO: grid 2x3 de chips toggle — "Pix" (accent), "Dinheiro", "Cartao", "ML", "Shopee", "Fiado"
- CLIENTE (OPCIONAL): input texto
- DATA: input com valor default hoje "10/09/2026"
- OBSERVACAO (OPCIONAL): textarea
- Botao "Confirmar Venda - R$120" (accent, fullwidth)

**animate-ui:** input, button, dialog
**Customizado:** chip-toggle (pagamento), currency-input

### T06 — Busca Flutuante (`T06-busca-flutuante.png`)

**O que o mockup mostra:**
- Search bar com focus state (borda accent)
- Resultados hierarquicos agrupados por gaveta:
  - Header: "TANQUE CG 125  Tanques" (uppercase, muted)
  - Items: "CG 125 Fan . 2014-2018" | preco range | un.
  - Item focado: background accent-light + borda accent
- Segundo grupo: "TANQUE CG 125 (PARALELO)  Tanques"
- Hint no bottom: "Navegue com ↑↓, selecione com Enter"

**Implementacao:** Busca via RPC `buscar_estoque()` com pg_trgm. Debounce 300ms. Keyboard navigation.

### T07 — Migracao: Organizar Estoque (`T07-migracao-organizar.png`)

**O que o mockup mostra:**
- Header: "< Estoque" | "Organizar Estoque"
- Instrucao: "Selecione itens para agrupar em uma gaveta:"
- Filter chips por categoria
- Lista de itens com checkbox (animate-ui checkbox)
- Itens selecionados: checkbox accent, background accent-light
- Itens nao selecionados: opacity 0.5
- Preview box (borda accent, fundo accent-light):
  - Icone gaveta + "Preview: gaveta a ser criada"
  - Campo editavel "NOME: Tanque CG 125"
  - Lista dos itens que serao agrupados: "→ CG 125 Fan . 2014-2018 . 2 un. . R$80"
- Bottom bar: "Cancelar" (ghost) + "Criar Gaveta (3 itens)" (accent)

### T08 — Swipe-to-Delete (`T08-swipe-to-delete.png`)

**O que o mockup mostra:**
- Dentro do detalhe de gaveta, na lista de unidades
- Unidade #2 "Boa" arrastada para esquerda: fundo vermelho com icone lixeira + "Excluir"
- Hint: "Arraste para a esquerda para excluir"
- Toast no bottom: "Unidade #2 excluida" + botao "DESFAZER" (5s)

**Implementacao:** `@use-gesture/react` com threshold 80px. Soft-delete (status='excluido'). Toast com undo via sonner.

### T09 — Skeleton Loading (`T09-skeleton-loading.png`)

**O que o mockup mostra:**
- Mesma estrutura do T01 mas com placeholders shimmer
- Stats row: 4 retangulos animados
- Filter chips: retangulos arredondados shimmer
- Lista: linhas com circulo + retangulos de tamanhos variados

**animate-ui:** skeleton

### T10 — Confirmacao de Venda (`T10-confirmacao-venda.png`)

**O que o mockup mostra:**
- Tela fullscreen de sucesso
- Anel animado laranja com checkmark SVG dentro (animacao stroke-dashoffset)
- Pulso continuo no anel externo (scale + opacity)
- Confetti dots coloridos caindo (6 dots, staggered)
- Titulo: "Venda registrada!"
- Subtitulo: "A unidade foi marcada como vendida e removida do estoque."
- Card de detalhes: Peca | Unidade | Valor (accent) | Pagamento | Cliente
- Botoes: "Voltar ao Estoque" (accent) + "Nova Venda" (outline)

**Implementacao:** Animacoes com Motion 12 (keyframes, stagger). SVG checkmark animado.

### T11 — Acoes em Lote (`T11-acoes-em-lote.png`)

**O que o mockup mostra:**
- Toolbar fixa no topo: fundo accent + "3 selecionados" + botoes "Mover" e "Excluir" + X
- Lista de gavetas com checkboxes visiveis
- Rows selecionadas: checkbox accent preenchido + background accent-light
- Hint: "Long-press ativa modo de selecao multipla"

**Implementacao:** Long-press 500ms ativa modo. Set de IDs. Batch delete com confirmacao.

### T12 — Toasts (`T12-toasts.png`)

**O que o mockup mostra:**
- 4 tipos de toast empilhados (so para referencia visual):
  1. Success (check verde): "Unidade salva com sucesso"
  2. Warning (triangulo amarelo): "Gaveta sem variantes cadastradas"
  3. Danger (lixeira vermelha): "3 gavetas excluidas" + "DESFAZER"
  4. Sale (cifrao verde): "Venda R$120 registrada - Pix"
- Auto-dismiss: 4s normal, 5s destrutivo (com Desfazer)
- Posicao: bottom-center

**Implementacao:** sonner com estilos customizados via tokens.

### T13 — Estados Preventivos (`T13-estados-preventivos.png`)

**O que o mockup mostra:**
- Offline bar: fundo amarelo + dot piscando + "Sem conexao - dados locais podem estar desatualizados"
- Empty state: icone SVG (caixa) + "Nenhuma gaveta cadastrada" + "Crie sua primeira gaveta..." + botao "+ Criar Gaveta" (accent)
- Duplicate warning: input com borda amarela + callout "Ja existe uma gaveta com nome semelhante: 'Tanque CG 125'. Deseja adicionar variante a gaveta existente?"

---

## Fases de Implementacao

### Fase 1 — Setup + Estoque CRUD (Telas 01, 02, 03)

**Pre-requisitos:**
1. Instalar dependencias do package.json
2. Configurar Tailwind v4 CSS-first com tokens
3. Instalar componentes animate-ui (button, input, dialog, checkbox, skeleton, badge, radio-group, sheet, tooltip)
4. Criar `cn()` utility, `formatCurrency()`, `formatDate()`
5. Configurar Supabase client
6. Configurar React Query provider
7. Configurar React Router

**Telas:**
- T01 Listagem de Gavetas — `Read("docs/mockups/T01-listagem-gavetas.png")`
- T02 Detalhe da Gaveta — `Read("docs/mockups/T02-detalhe-gaveta.png")`
- T03 Adicionar Unidade — `Read("docs/mockups/T03-adicionar-unidade.png")`
- T09 Skeleton Loading — `Read("docs/mockups/T09-skeleton-loading.png")`
- T13 Estados Preventivos — `Read("docs/mockups/T13-estados-preventivos.png")`

**Hooks:** use-gavetas.ts, use-variantes.ts, use-unidades.ts, use-media.ts

**Checklist:**
- [ ] Projeto inicia sem erros (vite dev)
- [ ] tsc --noEmit limpo
- [ ] Listagem mostra gavetas do Supabase
- [ ] Stats row com dados reais
- [ ] Filtro por categoria funciona
- [ ] Detalhe da gaveta com variantes e unidades
- [ ] Form de nova unidade com upload de foto
- [ ] Skeleton loading em todas as telas
- [ ] Empty state quando sem dados
- [ ] Dark theme funcional

### Fase 2 — Vendas + Busca (Telas 04, 05, 06, 10)

**Telas:**
- T04 Selecao de Unidade — `Read("docs/mockups/T04-nova-venda-selecao-unidade.png")`
- T05 Dados da Venda — `Read("docs/mockups/T05-nova-venda-dados.png")`
- T06 Busca Flutuante — `Read("docs/mockups/T06-busca-flutuante.png")`
- T10 Confirmacao de Venda — `Read("docs/mockups/T10-confirmacao-venda.png")`

**Hooks:** use-vendas.ts, use-search.ts

**Checklist:**
- [ ] Modal de venda 3 steps funcional
- [ ] Selecao de unidade obrigatoria
- [ ] Qtd travada em 1
- [ ] Busca fuzzy com pg_trgm
- [ ] Resultados hierarquicos por gaveta
- [ ] Keyboard navigation na busca
- [ ] Animacao de sucesso com confetti
- [ ] Unidade marcada como vendida apos venda

### Fase 3 — UX Avancado (Telas 08, 11, 12)

**Telas:**
- T08 Swipe-to-Delete — `Read("docs/mockups/T08-swipe-to-delete.png")`
- T11 Acoes em Lote — `Read("docs/mockups/T11-acoes-em-lote.png")`
- T12 Toasts — `Read("docs/mockups/T12-toasts.png")`

**Hooks:** use-swipe.ts, use-batch.ts

**Checklist:**
- [ ] Swipe-to-delete com @use-gesture/react
- [ ] Soft-delete + undo via toast
- [ ] Long-press ativa modo batch
- [ ] Toolbar flutuante com acoes
- [ ] 4 variantes de toast com sonner
- [ ] Auto-dismiss configurado (4s/5s)

### Fase 4 — Migracao + Desktop + Polimento (Telas 07, 14)

**Telas:**
- T07 Migracao — `Read("docs/mockups/T07-migracao-organizar.png")`
- T14 Desktop (sem mockup separado — usar regras abaixo)

**Layout Desktop (>= 768px):**
- Sidebar fixa a esquerda: nav com icones (Estoque, Vendas, Clientes, NF-e, Migracao, Relatorios)
- Item ativo: background accent-light + borda esquerda accent
- Content area: header + search + botao CTA
- Gavetas em tabela (colunas: icone, nome, categoria, variantes, unidades, preco)
- `font-variant-numeric: tabular-nums` nas colunas numericas
- Hover row: background accent-light

**Checklist:**
- [ ] Migracao de itens legados funcional
- [ ] Preview de gaveta a criar
- [ ] Layout desktop responsivo
- [ ] prefers-reduced-motion
- [ ] Focus visible em tudo
- [ ] Mascara de moeda brasileira
- [ ] Testar 375px, 768px, 1280px
- [ ] Error boundaries

---

## Hooks — Exemplos de Implementacao

### use-gavetas.ts

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';

export const useGavetas = (categoriaId?: string) => {
  return useQuery({
    queryKey: ['gavetas', categoriaId],
    queryFn: async () => {
      let query = supabase
        .from('gavetas')
        .select(`*, categoria:categorias(*), stats:gaveta_stats(*)`)
        .order('nome');
      if (categoriaId) query = query.eq('categoria_id', categoriaId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    }
  });
};

export const useCreateGaveta = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { nome: string; categoria_id?: string }) => {
      const { data: gaveta, error } = await supabase
        .from('gavetas').insert(data).select().single();
      if (error) throw error;
      return gaveta;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gavetas'] })
  });
};
```

### use-vendas.ts

```typescript
export const useRegistrarVenda = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      unidade_id: string;
      valor: number;
      pagamento: 'pix' | 'dinheiro' | 'cartao' | 'ml' | 'shopee' | 'fiado';
      cliente?: string;
      observacao?: string;
      data_venda?: string;
    }) => {
      const { error: vendaError } = await supabase.from('vendas').insert(data);
      if (vendaError) throw vendaError;
      const { error: unitError } = await supabase
        .from('unidades')
        .update({ status: 'vendido', updated_at: new Date().toISOString() })
        .eq('id', data.unidade_id);
      if (unitError) throw unitError;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gavetas'] });
      qc.invalidateQueries({ queryKey: ['variantes'] });
    }
  });
};
```

---

## App Shell Responsivo

```tsx
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-ground">
      {/* Sidebar — desktop only */}
      <aside className="hidden md:flex w-56 flex-col border-r border-border bg-surface">
        <Sidebar />
      </aside>

      {/* Content */}
      <main className="flex-1 min-w-0">
        <div className="md:hidden"><Header /></div>
        {children}
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 border-t border-border bg-surface">
        <BottomNav />
      </nav>
    </div>
  );
}
```

---

## Cronograma

| Fase | Escopo | Sessoes |
|---|---|---|
| Setup | DB + Tokens + animate-ui + Layout | 2-3 |
| Fase 1 | Telas 01, 02, 03, 09, 13 (Estoque CRUD) | 3-4 |
| Fase 2 | Telas 04, 05, 06, 10 (Vendas + Busca) | 3-4 |
| Fase 3 | Telas 08, 11, 12 (UX avancado) | 3-4 |
| Fase 4 | Tela 07, 14, polimento, testes | 3-4 |
| **Total** | | **15-21 sessoes** |

**Cada sessao deve:** focar em um escopo claro, terminar com `tsc --noEmit` limpo, usar `/compact` ao atingir ~50% do contexto.

---

## Labels e Idioma

Toda a interface e em **portugues brasileiro (pt-BR)**. Labels dos mockups:
- "Estoque", "Nova Gaveta", "Buscar peca, modelo, codigo..."
- "Variantes", "Unidades", "Valor"
- "Salvar", "Cancelar", "Excluir", "Desfazer"
- "Nova Venda", "Confirmar Venda", "Voltar ao Estoque"
- Moeda: R$ com separador de milhares (.) e decimal (,) — ex: R$ 1.200,00
