# Estoque — Componentes Animados (Módulo 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adotar popover de filtros, busca com sugestões, upload de fotos com drag-and-drop e cards expansíveis inline na tela de Estoque, resolvendo o overflow de filtros no mobile, sem mudar nenhum cálculo, contrato de API ou dado.

**Architecture:** Cada peça de UI vira um componente novo e isolado em `src/features/estoque/`, testável sozinho com Testing Library, e depois é encaixado em `EstoqueView.tsx` substituindo o bloco equivalente já existente — sem tocar em `services/`, `server/`, `supabase/`, `api.ts`, `types.ts` ou nos `useMemo` de cálculo. `EstoqueView.tsx` tem 1881 linhas hoje; extrair em vez de inchar mais esse arquivo segue o padrão já usado nele (`EstoqueAnunciosMlEditor.tsx`, `CondicaoNotaPicker.tsx`, `CondicaoNotaBadge.tsx` já são extrações do mesmo tipo).

**Tech Stack:** React 19, Tailwind v4 (CSS-first, tokens em `src/styles/theme.css`), shadcn/ui (new-york), `radix-ui` (pacote unificado), `motion` (Framer Motion), TanStack Table v8, Vitest + Testing Library. Componentes de terceiros: Popover e Expandable (Cult UI), Checkbox (adaptado do padrão Radix já usado em `switch.tsx`), ActionSearchBar e FileUpload (Kokonut UI, ambos fortemente adaptados — ver justificativa em cada task).

**Spec:** Módulo 2 ("Estoque — lista, filtros, Organograma") do documento colado pelo usuário na conversa que originou este plano — sem arquivo próprio no repo, o texto completo do módulo está registrado no histórico da conversa que gerou este plano.

## Global Constraints

- **Baseline de `npm run lint` (`tsc --noEmit`):** já tem 1 erro pré-existente, sem relação com este plano — `vite.config.ts(6,29)`, `worker.format: string` não é `"es" | "iife"`. Confirmado rodando `npx tsc --noEmit` antes de qualquer mudança deste plano. Cada task espera "sem erros novos", não "zero erros".
- **Tema:** nunca escrever hex ou cor crua (`zinc-*`, `gray-*`, `blue-*` etc, que é o que os componentes de terceiros trazem por padrão) — sempre as classes geradas de `src/styles/theme.css` (`bg-surface-card`, `text-text-primary`, `border-border-default`, `rounded-control`, `text-warning`, etc). Ver `CLAUDE.md` > Design system.
- **Animação:** reusar `SPRING_MICRO` (de `src/components/ui/motion.ts`) em todo popover/checkbox/sugestão/expand. Não inventar spring novo nem manter o `TRANSITION` embutido de cada componente vendor. **Atualização pós-Task-1:** o arquivo não existia de fato como artefato versionado (só existia untracked no checkout principal, fora do histórico local que o worktree herdou) — a Task 1 criou `src/components/ui/motion.ts` do zero (`SPRING_MICRO` com `stiffness: 500, damping: 30, mass: 0.5`). Isso é infraestrutura compartilhada por todas as tasks seguintes agora, não uma decisão local da Task 1. Ver ledger (`Ruling`) pra o motivo e o custo se a calibração do spring precisar mudar depois.
- **Testes (RTL) precisam de `afterEach(() => cleanup())` explícito.** Este projeto não roda Vitest com `test.globals: true`, então o auto-cleanup do `@testing-library/react` (que depende de um `afterEach` global) não dispara sozinho — sem isso, DOM de um teste vaza pro próximo (`render()` empilha, `getByRole` passa a achar "multiple elements"). Todo arquivo de teste novo deste plano precisa importar `afterEach` de `'vitest'` e `cleanup` de `'@testing-library/react'`, e chamar `afterEach(() => cleanup());` como primeira linha do `describe(...)` — mesmo padrão já usado em `EstoqueView.tabela.test.tsx`. Já corrigido nos 4 blocos de teste deste documento.
- **Gerenciador de pacotes:** este projeto usa **npm** (`package-lock.json` na raiz, sem `pnpm-lock.yaml`). Todo comando `pnpm dlx shadcn@latest add <url>` do módulo original roda aqui como `npx shadcn@latest add <url>`.
- **Fora do escopo deste plano** (apareciam no "Contexto" do Módulo 2 original mas sem consumidor em nenhuma task abaixo — não instalar):
  - `popover-form.json` — usado só no Caixa (Módulo 4), o filtro de Estoque não precisa de formulário dentro do popover.
  - `expandable-screen.json` — pensado pra navegação em tela cheia (usado no Módulo 5, "Mais Opções"); o pedido aqui é "expandir sem abrir tela nova", que é exatamente o primitivo `expandable.json` sozinho.
  - Organograma-como-árvore-de-arquivos, `carousel-cards`, `edge-blur` — os 3 itens `[opcional]` do módulo original. Não fazem parte deste plano; ver nota no rodapé.
- **Contrato existente a preservar:** clicar na linha da tabela (desktop) ou no card (mobile) continua chamando `onSelectItem(item)`, que abre o `DetailModal` compartilhado em `App.tsx` — usado também por `DashboardView`, `VendasView` e `GlobalSearch`. O novo controle de "expandir" (Task 4) é **adicional** (um chevron separado), nunca substitui esse clique.
- **jsdom não tem `ResizeObserver` nativo.** A Task 4 depende de `react-use-measure` (dependência transitiva do `expandable.tsx` do Cult UI), que usa `ResizeObserver`. Sem polyfill, isso quebra `EstoqueView.tabela.test.tsx` inteiro — ele renderiza o card mobile mesmo em teste (só fica escondido por `md:hidden`, uma classe CSS que o jsdom não avalia). O polyfill está na Task 4, passo 1, e deve rodar **antes** de qualquer outro passo da Task 4.
- **Sem `@types/react` no projeto** (confirmado: não está em `package.json` nem em `node_modules`, em nenhum lugar). `tsc --noEmit` ainda passa porque `noImplicitAny` está desligado — módulos sem tipos (incluindo `react`) viram `any` silenciosamente. Isso quebra especificamente uma coisa: uma referência de TIPO a `React.Algo` (`React.MouseEvent`, `React.FC`, etc.) só compila em arquivos que têm `import React from 'react'` (import *default*, não os nomeados de sempre) — sem esse import, `React.Algo` como tipo dá `TS2503: Cannot find namespace 'React'` (confirmado rodando `tsc` isolado). Os componentes desta plan usam só imports nomeados (`import type { ComponentProps } from 'react'`, `type DragEvent`, etc.) e nunca `React.Algo` bare — o único componente que faz `import React, {...} from "react"` é o `popover.tsx` da Task 1 (retemado, mas manteve o import default do Cult UI original), então só ali `React.ReactNode`/`React.RefObject` são seguros. Em `EstoqueView.tsx` (sem import default de React), nunca anotar um handler inline com `React.MouseEvent` — deixar sem anotação (inferência do contexto já resolve, é o padrão que o arquivo inteiro já usa).
- **Onde os arquivos instalados caem:** os itens do Cult UI (`popover`, `expandable`) batem com o alias `ui: "@/src/components/ui"` deste projeto e caem direto em `src/components/ui/*.tsx`. Os itens do Kokonut UI (`action-search-bar`, `file-upload`) declaram `target` próprio (`components/kokonutui/...`), fora dessa convenção — cada task diz o que fazer com esse arquivo depois de instalado.

## File Structure

**Novos arquivos (features/estoque):**
- `src/features/estoque/EstoqueFiltrosPopover.tsx` — painel de filtros (Task 1)
- `src/features/estoque/EstoqueFiltrosPopover.test.tsx`
- `src/features/estoque/EstoqueBuscaSugestoes.tsx` — campo de busca com sugestões (Task 2)
- `src/features/estoque/EstoqueBuscaSugestoes.test.tsx`
- `src/features/estoque/EstoqueUploadFotos.tsx` — dropzone de fotos (Task 3)
- `src/features/estoque/EstoqueUploadFotos.test.tsx`
- `src/features/estoque/EstoqueItemExpandido.tsx` — conteúdo do painel expandido (Task 4)
- `src/features/estoque/EstoqueItemExpandido.test.tsx`

**Novos arquivos (ui, via CLI + retheme):**
- `src/components/ui/popover.tsx` (Task 1)
- `src/components/ui/checkbox.tsx` (Task 1 — ver nota "por que não o pacote Animate UI")
- `src/components/ui/expandable.tsx` (Task 4)

**Novo arquivo de infraestrutura de teste:**
- `src/test/setup.ts` (Task 4, passo 1 — polyfill de `ResizeObserver`)

**Modificados:**
- `src/features/estoque/EstoqueView.tsx` — troca os blocos de filtros/busca/upload/linha-da-lista pelos componentes novos
- `src/features/estoque/EstoqueView.tabela.test.tsx` — abre o popover de filtros antes de interagir com um filtro (Task 1)
- `vite.config.ts` — adiciona bloco `test` (setupFiles) pro polyfill de ResizeObserver (Task 4)

---

## Task 1: Popover de filtros com checkbox animado

Resolve o overflow da barra de filtros no mobile: os 7 controles hoje numa fileira de chips (`categoria`, `modelo`, `estoque baixo`, `sem preço`, `com avaria`, `sem foto`, `sem link ML`) passam a viver atrás de um botão "Filtros".

**Files:**
- Create: `src/components/ui/popover.tsx` (via CLI + retheme completo)
- Create: `src/components/ui/checkbox.tsx` (escrito à mão, não via CLI — ver nota abaixo)
- Create: `src/features/estoque/EstoqueFiltrosPopover.tsx`
- Test: `src/features/estoque/EstoqueFiltrosPopover.test.tsx`
- Modify: `src/features/estoque/EstoqueView.tsx:1064-1137` (bloco de filtros)
- Modify: `src/features/estoque/EstoqueView.tabela.test.tsx`

**Interfaces:**
- Produces: `PopoverRoot`, `PopoverTrigger`, `PopoverContent`, `PopoverHeader` de `src/components/ui/popover.tsx`
- Produces: `Checkbox` de `src/components/ui/checkbox.tsx` — props `{ checked: boolean; onCheckedChange: () => void; 'aria-label'?: string }` (mesma assinatura de `Switch`)
- Produces: `EstoqueFiltrosPopover` — recebe todo o estado de filtro já existente em `EstoqueView` como props controladas (nenhum estado novo, só reorganiza onde os controles aparecem)
- Consumes (de `EstoqueView.tsx`, já existentes): `categoriaFiltro`, `setCategoriaFiltro`, `categoriaNodes`, `modeloFiltro`, `setModeloFiltro`, `modeloNodes`, `soEstoqueBaixo`, `setSoEstoqueBaixo`, `itensEstoqueBaixo`, `soSemPreco`, `setSoSemPreco`, `soComAvaria`, `setSoComAvaria`, `itensComAvaria`, `soSemFoto`, `setSoSemFoto`, `soSemLinkMl`, `setSoSemLinkMl`
- Consumes: `TreeDropdown` de `src/components/TreeDropdown.tsx` (sem mudança)

### Por que o Checkbox não vem do pacote `@animate-ui/components-radix-checkbox`

O registry do Animate UI (`npx shadcn@latest add @animate-ui/components-radix-checkbox`) traz uma dependência nova (`class-variance-authority`, ausente no `package.json` hoje) e um wrapper adicional (`@animate-ui/primitives-radix-checkbox`) só pra 1 componente pequeno — e o resultado ainda precisaria do mesmo retheme manual (usa `text-primary-foreground`, token que `theme.css` não mapeia, e `bg-input`, que também não existe aqui). Este projeto já tem o padrão certo pra isso em `src/components/ui/switch.tsx`: Radix primitivo (`radix-ui`, já é dependência) + `motion` (já é dependência) + tokens do tema, sem CVA. A Task 1 replica esse padrão em vez de instalar peças novas pra depois jogar metade fora. Se preferir o pacote literal do Animate UI mesmo assim, é só pedir — a troca é isolada neste um arquivo.

- [ ] **Step 1: Instalar e retemar o Popover (Cult UI)**

Rodar:

```bash
npx shadcn@latest add https://cult-ui.com/r/popover.json
```

Isso cria `src/components/ui/popover.tsx` com `PopoverRoot`, `PopoverTrigger`, `PopoverContent`, `PopoverForm`, `PopoverLabel`, `PopoverTextarea`, `PopoverFooter`, `PopoverCloseButton`, `PopoverSubmitButton`, `PopoverHeader`, `PopoverBody`, `PopoverButton` — cores `zinc-*`/`bg-white` cruas, popover de tamanho fixo (`h-[200px] w-[364px]`, incompatível com o conteúdo desta task) e sem toggle-ao-clicar (só abre, nunca fecha, no trigger). Substituir o conteúdo inteiro do arquivo por esta versão (mantém só o que este módulo usa — `PopoverForm`/`Label`/`Textarea`/`Footer`/`CloseButton`/`SubmitButton`/`PopoverBody`/`PopoverButton` saem por não terem consumidor aqui nem no restante do plano):

```tsx
// src/components/ui/popover.tsx
// Popover headless (Cult UI, adaptado) — retemado com os tokens do projeto e
// com o trigger fazendo toggle de verdade (o original só abre, nunca fecha
// ao clicar de novo). Fora do escopo: PopoverForm/Label/Textarea/Footer
// (a Task 1 do plano de componentes animados não usa formulário no popover).
"use client"

import React, {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react"
import { AnimatePresence, motion, MotionConfig } from "motion/react"

import { cn } from "../../utils"
import { SPRING_MICRO } from "./motion"

function useClickOutside(
  ref: React.RefObject<HTMLElement | null>,
  handler: () => void
) {
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        handler()
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [ref, handler])
}

interface PopoverContextType {
  isOpen: boolean
  openPopover: () => void
  closePopover: () => void
  uniqueId: string
}

const PopoverContext = createContext<PopoverContextType | undefined>(undefined)

function usePopover() {
  const context = useContext(PopoverContext)
  if (!context) throw new Error("usePopover must be used within a PopoverRoot")
  return context
}

interface PopoverRootProps {
  children: React.ReactNode
  className?: string
}

export function PopoverRoot({ children, className }: PopoverRootProps) {
  const uniqueId = useId()
  const [isOpen, setIsOpen] = useState(false)
  const openPopover = () => setIsOpen(true)
  const closePopover = () => setIsOpen(false)

  return (
    <PopoverContext.Provider value={{ isOpen, openPopover, closePopover, uniqueId }}>
      <MotionConfig transition={SPRING_MICRO}>
        <div className={cn("relative flex items-center", className)}>{children}</div>
      </MotionConfig>
    </PopoverContext.Provider>
  )
}

interface PopoverTriggerProps {
  children: React.ReactNode
  className?: string
}

export function PopoverTrigger({ children, className }: PopoverTriggerProps) {
  const { isOpen, openPopover, closePopover, uniqueId } = usePopover()

  return (
    <motion.button
      type="button"
      layoutId={`popover-${uniqueId}`}
      aria-expanded={isOpen}
      className={cn(
        "flex h-10 items-center gap-1.5 rounded-control border px-3 text-[11px] font-semibold uppercase tracking-wider transition-colors",
        isOpen
          ? "border-accent/50 ring-2 ring-accent/20 text-text-primary"
          : "border-border-default bg-surface-inset text-text-muted hover:text-text-secondary",
        className
      )}
      onClick={() => (isOpen ? closePopover() : openPopover())}
    >
      <motion.span layoutId={`popover-label-${uniqueId}`} className="flex items-center gap-1.5">
        {children}
      </motion.span>
    </motion.button>
  )
}

interface PopoverContentProps {
  children: React.ReactNode
  className?: string
}

export function PopoverContent({ children, className }: PopoverContentProps) {
  const { isOpen, closePopover, uniqueId } = usePopover()
  const containerRef = useRef<HTMLDivElement>(null)

  useClickOutside(containerRef, closePopover)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closePopover()
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [closePopover])

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={containerRef}
          layoutId={`popover-${uniqueId}`}
          className={cn(
            "absolute right-0 top-full z-[150] mt-2 max-h-[70vh] w-80 max-w-[90vw] overflow-y-auto rounded-card border border-border-default bg-surface-card p-3 shadow-2xl outline-none",
            className
          )}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function PopoverHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("px-1 pb-2 text-[10.5px] font-semibold uppercase tracking-wider text-text-faint", className)}>
      {children}
    </div>
  )
}
```

- [ ] **Step 2: Criar o Checkbox animado**

Criar `src/components/ui/checkbox.tsx`:

```tsx
// src/components/ui/checkbox.tsx
// Checkbox animado — radix-ui + motion, mesmo padrão de switch.tsx (ver nota
// na Task 1 do plano de componentes animados do Estoque sobre por que não é
// o pacote @animate-ui/components-radix-checkbox).
import type { ComponentProps } from 'react';
import { Checkbox as CheckboxPrimitive } from 'radix-ui';
import { AnimatePresence, motion } from 'motion/react';
import { Check } from 'lucide-react';
import { cn } from '../../utils';
import { SPRING_MICRO } from './motion';

function Checkbox({ className, ...props }: ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        'peer flex size-5 shrink-0 items-center justify-center rounded-[5px] border outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        'data-[state=checked]:bg-accent data-[state=checked]:border-accent data-[state=unchecked]:bg-surface-inset data-[state=unchecked]:border-border-default',
        'focus-visible:ring-[3px] focus-visible:ring-accent/30',
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator asChild forceMount>
        <AnimatePresence>
          {props.checked && (
            <motion.span
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={SPRING_MICRO}
              className="flex items-center justify-center text-white"
            >
              <Check size={13} strokeWidth={3} />
            </motion.span>
          )}
        </AnimatePresence>
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
```

- [ ] **Step 3: Escrever o teste (falhando) de `EstoqueFiltrosPopover`**

Criar `src/features/estoque/EstoqueFiltrosPopover.test.tsx`:

```tsx
// @vitest-environment jsdom
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { EstoqueFiltrosPopover } from './EstoqueFiltrosPopover';

function baseProps(overrides: Partial<ComponentProps<typeof EstoqueFiltrosPopover>> = {}): ComponentProps<typeof EstoqueFiltrosPopover> {
  return {
    categoriaFiltro: 'Todas',
    onCategoriaChange: vi.fn(),
    categoriaNodes: [],
    modeloFiltro: 'Todas',
    onModeloChange: vi.fn(),
    modeloNodes: [],
    soEstoqueBaixo: false,
    onToggleEstoqueBaixo: vi.fn(),
    itensEstoqueBaixo: 0,
    soSemPreco: false,
    onToggleSemPreco: vi.fn(),
    soComAvaria: false,
    onToggleComAvaria: vi.fn(),
    mostrarFiltroAvaria: false,
    itensComAvaria: 0,
    soSemFoto: false,
    onToggleSemFoto: vi.fn(),
    soSemLinkMl: false,
    onToggleSemLinkMl: vi.fn(),
    ...overrides,
  };
}

describe('EstoqueFiltrosPopover', () => {
  afterEach(() => cleanup());

  it('esconde os filtros até clicar em "Filtros", e mostra ao clicar', () => {
    render(<EstoqueFiltrosPopover {...baseProps()} />);
    expect(screen.queryByText('Estoque baixo')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Filtros/i }));

    expect(screen.getByText('Estoque baixo')).toBeTruthy();
    expect(screen.getByText('Sem preço')).toBeTruthy();
    expect(screen.getByText('Sem foto')).toBeTruthy();
    expect(screen.getByText('Sem link ML')).toBeTruthy();
  });

  it('só mostra "Com avaria" quando mostrarFiltroAvaria é true', () => {
    render(<EstoqueFiltrosPopover {...baseProps({ mostrarFiltroAvaria: true, itensComAvaria: 3 })} />);
    fireEvent.click(screen.getByRole('button', { name: /Filtros/i }));
    expect(screen.getByText('Com avaria')).toBeTruthy();
  });

  it('não mostra "Com avaria" quando mostrarFiltroAvaria é false', () => {
    render(<EstoqueFiltrosPopover {...baseProps({ mostrarFiltroAvaria: false })} />);
    fireEvent.click(screen.getByRole('button', { name: /Filtros/i }));
    expect(screen.queryByText('Com avaria')).toBeNull();
  });

  it('clicar no checkbox de um filtro chama o callback correspondente', () => {
    const onToggleSemFoto = vi.fn();
    render(<EstoqueFiltrosPopover {...baseProps({ onToggleSemFoto })} />);
    fireEvent.click(screen.getByRole('button', { name: /Filtros/i }));

    fireEvent.click(screen.getByRole('checkbox', { name: 'Sem foto' }));

    expect(onToggleSemFoto).toHaveBeenCalledTimes(1);
  });

  it('mostra a contagem de filtros ativos no botão "Filtros"', () => {
    render(<EstoqueFiltrosPopover {...baseProps({ soSemFoto: true, soSemLinkMl: true })} />);
    expect(screen.getByText('2')).toBeTruthy();
  });
});
```

- [ ] **Step 4: Rodar o teste e confirmar que falha**

Run: `npx vitest run src/features/estoque/EstoqueFiltrosPopover.test.tsx`
Expected: FAIL — `Cannot find module './EstoqueFiltrosPopover'` (o componente ainda não existe).

- [ ] **Step 5: Implementar `EstoqueFiltrosPopover`**

Criar `src/features/estoque/EstoqueFiltrosPopover.tsx`:

```tsx
// Painel "Filtros" do Estoque — agrupa os controles que antes eram uma
// fileira de chips (estourava a largura no mobile) dentro de um popover.
// Nenhuma lógica de filtro muda aqui: só onde os controles aparecem.
import { Bike, Filter } from 'lucide-react';
import { cn } from '../../utils';
import { PopoverContent, PopoverHeader, PopoverRoot, PopoverTrigger } from '../../components/ui/popover';
import { Checkbox } from '../../components/ui/checkbox';
import { TreeDropdown, type TreeDropdownNode } from '../../components/TreeDropdown';

interface EstoqueFiltrosPopoverProps {
  categoriaFiltro: string;
  onCategoriaChange: (id: string) => void;
  categoriaNodes: TreeDropdownNode[];
  modeloFiltro: string;
  onModeloChange: (id: string) => void;
  modeloNodes: TreeDropdownNode[];
  soEstoqueBaixo: boolean;
  onToggleEstoqueBaixo: () => void;
  itensEstoqueBaixo: number;
  soSemPreco: boolean;
  onToggleSemPreco: () => void;
  soComAvaria: boolean;
  onToggleComAvaria: () => void;
  mostrarFiltroAvaria: boolean;
  itensComAvaria: number;
  soSemFoto: boolean;
  onToggleSemFoto: () => void;
  soSemLinkMl: boolean;
  onToggleSemLinkMl: () => void;
}

function FiltroCheckboxRow({
  label,
  checked,
  onChange,
  contagem,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
  contagem?: number;
}) {
  return (
    <label className="flex items-center justify-between gap-3 py-1.5 px-1 rounded-control cursor-pointer hover:bg-surface-raised">
      <span className="flex items-center gap-2 text-xs text-text-secondary">
        {label}
        {contagem !== undefined && (
          <span className={cn('px-1.5 py-0.5 rounded-badge text-[10px]', checked ? 'bg-warning/20 text-warning' : 'bg-surface-raised text-text-faint')}>
            {contagem}
          </span>
        )}
      </span>
      <Checkbox checked={checked} onCheckedChange={onChange} aria-label={label} />
    </label>
  );
}

export function EstoqueFiltrosPopover(props: EstoqueFiltrosPopoverProps) {
  const {
    categoriaFiltro, onCategoriaChange, categoriaNodes,
    modeloFiltro, onModeloChange, modeloNodes,
    soEstoqueBaixo, onToggleEstoqueBaixo, itensEstoqueBaixo,
    soSemPreco, onToggleSemPreco,
    soComAvaria, onToggleComAvaria, mostrarFiltroAvaria, itensComAvaria,
    soSemFoto, onToggleSemFoto,
    soSemLinkMl, onToggleSemLinkMl,
  } = props;

  const ativos =
    (categoriaFiltro !== 'Todas' ? 1 : 0) +
    (modeloFiltro !== 'Todas' ? 1 : 0) +
    [soEstoqueBaixo, soSemPreco, soComAvaria, soSemFoto, soSemLinkMl].filter(Boolean).length;

  return (
    <PopoverRoot>
      <PopoverTrigger>
        <Filter size={14} />
        Filtros
        {ativos > 0 && <span className="px-1.5 py-0.5 rounded-badge bg-accent-soft-bg text-accent-soft-fg text-[10px]">{ativos}</span>}
      </PopoverTrigger>
      <PopoverContent>
        <PopoverHeader>Categoria e moto</PopoverHeader>
        <div className="flex flex-wrap gap-2 px-1 pb-3">
          <TreeDropdown
            icon={<Filter size={14} />}
            value={categoriaFiltro}
            onChange={onCategoriaChange}
            nodes={categoriaNodes}
            emptyOption={{ value: 'Todas', label: 'Todas categorias' }}
            searchPlaceholder="Buscar categoria..."
            emptyMessage="Nenhuma categoria encontrada."
          />
          <TreeDropdown
            icon={<Bike size={14} />}
            value={modeloFiltro}
            onChange={onModeloChange}
            nodes={modeloNodes}
            emptyOption={{ value: 'Todas', label: 'Todos modelos' }}
            searchPlaceholder="Buscar moto..."
            emptyMessage="Nenhuma moto encontrada."
          />
        </div>

        <PopoverHeader>Situação</PopoverHeader>
        <div className="px-1 pb-1 space-y-0.5">
          <FiltroCheckboxRow label="Estoque baixo" checked={soEstoqueBaixo} onChange={onToggleEstoqueBaixo} contagem={itensEstoqueBaixo} />
          <FiltroCheckboxRow label="Sem preço" checked={soSemPreco} onChange={onToggleSemPreco} />
          {mostrarFiltroAvaria && (
            <FiltroCheckboxRow label="Com avaria" checked={soComAvaria} onChange={onToggleComAvaria} contagem={itensComAvaria} />
          )}
          <FiltroCheckboxRow label="Sem foto" checked={soSemFoto} onChange={onToggleSemFoto} />
          <FiltroCheckboxRow label="Sem link ML" checked={soSemLinkMl} onChange={onToggleSemLinkMl} />
        </div>
      </PopoverContent>
    </PopoverRoot>
  );
}
```

- [ ] **Step 6: Rodar o teste e confirmar que passa**

Run: `npx vitest run src/features/estoque/EstoqueFiltrosPopover.test.tsx`
Expected: PASS (5 testes).

- [ ] **Step 7: Encaixar em `EstoqueView.tsx`**

Em `src/features/estoque/EstoqueView.tsx`, adicionar o import:

```tsx
import { EstoqueFiltrosPopover } from './EstoqueFiltrosPopover';
```

Substituir o bloco `<div className="flex flex-wrap items-center gap-2">...</div>` (linhas 1064-1137, os 7 controles de filtro — TreeDropdown de categoria, TreeDropdown de modelo, e os 5 botões `soEstoqueBaixo`/`soSemPreco`/`soComAvaria`/`soSemFoto`/`soSemLinkMl`) por:

```tsx
<EstoqueFiltrosPopover
  categoriaFiltro={categoriaFiltro}
  onCategoriaChange={setCategoriaFiltro}
  categoriaNodes={categoriaNodes}
  modeloFiltro={modeloFiltro}
  onModeloChange={setModeloFiltro}
  modeloNodes={modeloNodes}
  soEstoqueBaixo={soEstoqueBaixo}
  onToggleEstoqueBaixo={() => setSoEstoqueBaixo((v) => !v)}
  itensEstoqueBaixo={itensEstoqueBaixo}
  soSemPreco={soSemPreco}
  onToggleSemPreco={() => setSoSemPreco((v) => !v)}
  soComAvaria={soComAvaria}
  onToggleComAvaria={() => setSoComAvaria((v) => !v)}
  mostrarFiltroAvaria={itensComAvaria > 0 || soComAvaria}
  itensComAvaria={itensComAvaria}
  soSemFoto={soSemFoto}
  onToggleSemFoto={() => setSoSemFoto((v) => !v)}
  soSemLinkMl={soSemLinkMl}
  onToggleSemLinkMl={() => setSoSemLinkMl((v) => !v)}
/>
```

O bloco de busca (`<div className="flex items-center gap-3 ...">` com o `<Search>`/`<input>`) fica **intocado nesta task** — é a Task 2.

- [ ] **Step 8: Atualizar `EstoqueView.tabela.test.tsx` pra abrir o popover antes de cada filtro**

Os filtros agora só existem no DOM depois de clicar em "Filtros" (o `PopoverContent` usa `AnimatePresence` — conteúdo desmontado enquanto fechado). Adicionar um helper e uma chamada antes de cada teste que interage com um filtro:

```tsx
function abrirFiltros() {
  fireEvent.click(screen.getByRole('button', { name: /Filtros/i }));
}
```

Adicionar `abrirFiltros();` como primeira linha, logo após o `render(...)`, nestes testes (todos em `src/features/estoque/EstoqueView.tabela.test.tsx`):
- `'filtro "Estoque baixo" mostra só peças com quantidade 1 ou 2'`
- `'filtro "Sem preço" mostra só peças com valor zerado'`
- `'filtro "Com avaria" mostra só peças com alguma unidade avariada e disponível'`
- `'filtro "Sem foto" mostra só peças sem nenhuma imagem'`
- `'filtro novo "Sem link ML" mostra só peças sem nenhum anúncio vinculado (links_ml vazio)'`
- `'filtro de categoria restringe às peças da categoria (e subcategorias) selecionada'`
- `'filtro de modelo de moto restringe às peças do modelo (e sub-modelos) selecionado'`
- `'reseta pra página 1 ao aplicar um filtro enquanto estava na página 2'`

Nenhuma outra mudança nesses testes — a asserção em si (o que cada filtro faz) continua igual, só precisa do popover aberto primeiro pra achar o controle.

- [ ] **Step 9: Rodar a suíte inteira de Estoque e confirmar que passa**

Run: `npx vitest run src/features/estoque`
Expected: PASS — inclui `EstoqueFiltrosPopover.test.tsx` (novo) e `EstoqueView.tabela.test.tsx` (atualizado).

- [ ] **Step 10: Checar tipos**

Run: `npm run lint`
Expected: sem erros novos além do 1 pré-existente em `vite.config.ts` (`worker.format`, sem relação com este plano — ver Global Constraints).

- [ ] **Step 11: Commit**

```bash
git add src/components/ui/popover.tsx src/components/ui/checkbox.tsx src/features/estoque/EstoqueFiltrosPopover.tsx src/features/estoque/EstoqueFiltrosPopover.test.tsx src/features/estoque/EstoqueView.tsx src/features/estoque/EstoqueView.tabela.test.tsx
git commit -m "feat(estoque): agrupa filtros num popover animado, resolve overflow no mobile"
```

---

## Task 2: Busca com sugestões animadas

**Files:**
- Create: `src/features/estoque/EstoqueBuscaSugestoes.tsx`
- Test: `src/features/estoque/EstoqueBuscaSugestoes.test.tsx`
- Modify: `src/features/estoque/EstoqueView.tsx` (bloco de busca)

**Interfaces:**
- Produces: `EstoqueBuscaSugestoes` — `{ value: string; onChange: (v: string) => void; sugestoes: Estoque[]; onSelecionar: (item: Estoque) => void; placeholder?: string }`
- Consumes: `Estoque` de `./types`, `SPRING_MICRO` de `../../components/ui/motion`

### Por que não o `action-search-bar.tsx` do Kokonut UI direto

O componente original (`https://kokonutui.com/r/action-search-bar.json`) não aceita `value`/`onChange` nem tem callback de seleção — ele gerencia a própria query internamente e a lista de `actions` é estática (pensado pra um command palette tipo "⌘K", não pra filtrar uma lista real de peças). Usá-lo tal como está deixaria o campo de busca sem sincronizar com o `searchTerm`/`debouncedSearch` que já existe (e que a tabela de baixo continua usando) — dois campos de busca desacoplados na mesma tela. O componente abaixo é a mesma linguagem visual (sugestões animadas, ícone Search↔X) recriada como controlado, alimentada pelos mesmos itens já filtrados (`filtered`) que a tabela usa.

- [ ] **Step 1: Escrever o teste (falhando)**

Criar `src/features/estoque/EstoqueBuscaSugestoes.test.tsx`:

```tsx
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { EstoqueBuscaSugestoes } from './EstoqueBuscaSugestoes';
import type { Estoque } from './types';

function criarItem(overrides: Partial<Estoque> & Pick<Estoque, 'id' | 'nome'>): Estoque {
  return {
    codigo: `RK-${overrides.id}`,
    categoria_id: null,
    modelo_moto_id: null,
    condicao: 'original',
    condicao_nota: null,
    nota_cadastro: null,
    ano: null,
    valor: 100,
    quantidade: 1,
    imagens: [],
    descricao: null,
    ativo: true,
    criado_em: '2026-01-01T00:00:00.000Z',
    atualizado_em: '2026-01-01T00:00:00.000Z',
    anuncio_ml_url: null,
    anuncio_fb_url: null,
    componentes: null,
    unidades_incompletas: [],
    ...overrides,
  };
}

describe('EstoqueBuscaSugestoes', () => {
  afterEach(() => cleanup());

  it('não mostra sugestões enquanto o campo não está focado', () => {
    const item = criarItem({ id: 'a', nome: 'CDI Titan 150' });
    render(<EstoqueBuscaSugestoes value="cdi" onChange={() => {}} sugestoes={[item]} onSelecionar={() => {}} />);
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('mostra sugestões ao focar o campo com texto e itens disponíveis', () => {
    const item = criarItem({ id: 'a', nome: 'CDI Titan 150' });
    render(<EstoqueBuscaSugestoes value="cdi" onChange={() => {}} sugestoes={[item]} onSelecionar={() => {}} />);

    fireEvent.focus(screen.getByRole('combobox'));

    expect(screen.getByText('CDI Titan 150')).toBeTruthy();
  });

  it('não mostra sugestões se o campo estiver vazio, mesmo focado', () => {
    render(<EstoqueBuscaSugestoes value="" onChange={() => {}} sugestoes={[]} onSelecionar={() => {}} />);
    fireEvent.focus(screen.getByRole('combobox'));
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('clicar numa sugestão chama onSelecionar com a peça', () => {
    const item = criarItem({ id: 'a', nome: 'CDI Titan 150' });
    const onSelecionar = vi.fn();
    render(<EstoqueBuscaSugestoes value="cdi" onChange={() => {}} sugestoes={[item]} onSelecionar={onSelecionar} />);
    fireEvent.focus(screen.getByRole('combobox'));

    fireEvent.mouseDown(screen.getByText('CDI Titan 150'));

    expect(onSelecionar).toHaveBeenCalledWith(item);
  });

  it('digitar chama onChange com o novo valor', () => {
    const onChange = vi.fn();
    render(<EstoqueBuscaSugestoes value="" onChange={onChange} sugestoes={[]} onSelecionar={() => {}} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'farol' } });
    expect(onChange).toHaveBeenCalledWith('farol');
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npx vitest run src/features/estoque/EstoqueBuscaSugestoes.test.tsx`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

Criar `src/features/estoque/EstoqueBuscaSugestoes.tsx`:

```tsx
// Campo de busca do Estoque com sugestões animadas — mesma linguagem visual
// do action-search-bar (Kokonut UI), recriada como controlada e alimentada
// pelos itens já filtrados desta tela (ver nota "por que não o componente
// original" na Task 2 do plano de componentes animados do Estoque).
import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Package, Search, X } from 'lucide-react';
import { SPRING_MICRO } from '../../components/ui/motion';
import type { Estoque } from './types';

const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0);

interface EstoqueBuscaSugestoesProps {
  value: string;
  onChange: (value: string) => void;
  sugestoes: Estoque[];
  onSelecionar: (item: Estoque) => void;
  placeholder?: string;
}

export function EstoqueBuscaSugestoes({ value, onChange, sugestoes, onSelecionar, placeholder }: EstoqueBuscaSugestoesProps) {
  const [focado, setFocado] = useState(false);
  const blurTimeout = useRef<ReturnType<typeof setTimeout>>();

  const mostrarSugestoes = focado && value.trim().length > 0 && sugestoes.length > 0;

  return (
    <div className="relative">
      <div className="flex items-center gap-3 rounded-control border border-border-default bg-surface-inset px-4">
        <Search size={16} className="text-text-faint shrink-0" />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocado(true)}
          onBlur={() => {
            blurTimeout.current = setTimeout(() => setFocado(false), 150);
          }}
          placeholder={placeholder ?? 'Buscar peças por nome, código, categoria ou moto...'}
          role="combobox"
          aria-expanded={mostrarSugestoes}
          className="flex-1 py-3.5 bg-transparent outline-none text-sm text-text-primary placeholder:text-text-faint"
        />
        {value && (
          <button type="button" onClick={() => onChange('')} className="p-1.5 rounded-full hover:bg-surface-raised text-text-faint">
            <X size={14} />
          </button>
        )}
      </div>

      <AnimatePresence>
        {mostrarSugestoes && (
          <motion.ul
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={SPRING_MICRO}
            role="listbox"
            className="absolute left-0 right-0 top-full z-[120] mt-2 max-h-80 overflow-y-auto rounded-card border border-border-default bg-surface-card shadow-2xl py-1.5"
          >
            {sugestoes.map((item) => (
              <li key={item.id} role="option">
                <button
                  type="button"
                  onMouseDown={(e) => {
                    // onMouseDown (não onClick) dispara antes do onBlur do
                    // input — senão a lista fecha antes do clique registrar.
                    e.preventDefault();
                    clearTimeout(blurTimeout.current);
                    onSelecionar(item);
                    setFocado(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-surface-raised transition-colors"
                >
                  <div className="size-8 rounded-control overflow-hidden shrink-0 flex items-center justify-center bg-surface-inset">
                    {item.imagens[0] ? (
                      <img src={item.imagens[0]} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <Package size={14} className="text-text-faint" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-text-primary truncate">{item.nome}</p>
                    <p className="text-[10.5px] text-text-faint truncate">
                      {item.codigo} · {item.categoria?.nome || '-'}
                    </p>
                  </div>
                  <span className="text-xs font-medium text-text-secondary tabular-nums shrink-0">{formatCurrency(item.valor)}</span>
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run src/features/estoque/EstoqueBuscaSugestoes.test.tsx`
Expected: PASS (5 testes).

- [ ] **Step 5: Encaixar em `EstoqueView.tsx`**

Adicionar o import:

```tsx
import { EstoqueBuscaSugestoes } from './EstoqueBuscaSugestoes';
```

Substituir o bloco `<div className="flex items-center gap-3 rounded-control border ...">` (o campo "Buscar peças...", logo acima do bloco de filtros substituído na Task 1) por:

```tsx
<EstoqueBuscaSugestoes
  value={searchTerm}
  onChange={setSearchTerm}
  sugestoes={debouncedSearch.trim() ? filtered.slice(0, 6) : []}
  onSelecionar={onSelectItem}
/>
```

`filtered` já é a lista que passa por busca + todos os outros filtros (`useMemo` existente, sem mudança) — as sugestões são simplesmente os 6 primeiros itens desse mesmo resultado, então nunca divergem do que a tabela mostra embaixo.

- [ ] **Step 6: Rodar a suíte de Estoque inteira**

Run: `npx vitest run src/features/estoque`
Expected: PASS.

- [ ] **Step 7: Checar tipos**

Run: `npm run lint`
Expected: sem erros novos além do 1 pré-existente em `vite.config.ts` (`worker.format`, sem relação com este plano — ver Global Constraints).

- [ ] **Step 8: Commit**

```bash
git add src/features/estoque/EstoqueBuscaSugestoes.tsx src/features/estoque/EstoqueBuscaSugestoes.test.tsx src/features/estoque/EstoqueView.tsx
git commit -m "feat(estoque): busca com sugestões animadas, alimentada pelos itens já filtrados"
```

---

## Task 3: Upload de fotos com drag-and-drop

**Files:**
- Create: `src/features/estoque/EstoqueUploadFotos.tsx`
- Test: `src/features/estoque/EstoqueUploadFotos.test.tsx`
- Modify: `src/features/estoque/EstoqueView.tsx:345` (`handleUploadImagem`, alarga o tipo do parâmetro) e `EstoqueView.tsx:1573-1648` (`ModalSection titulo="Fotos"`)

**Interfaces:**
- Produces: `EstoqueUploadFotos` — `{ imagens: string[]; onRemoverImagem: (url: string) => void; onArquivosSelecionados: (files: File[]) => void; enviando: boolean; resumoCompressao: string | null }`
- Consumes: `handleUploadImagem` existente (só o tipo do parâmetro muda, de `FileList` pra `FileList | File[]` — o corpo já faz `Array.from(files)`, então continua funcionando sem outra mudança)

### Por que o `file-upload.tsx` do Kokonut UI precisa de adaptação (não é drop-in)

O componente original (`https://kokonutui.com/r/file-upload.json`) **simula** o progresso com um `setInterval` fixo (`uploadDelay`, default 2000ms) — ele nunca espera uma promise real, só dispara `onUploadSuccess(file)` depois do timer acabar, então a barra de progresso não reflete o upload de verdade (podia terminar visualmente antes ou depois do `uploadImagemEstoque` real responder). Também só aceita 1 arquivo por vez (sem `multiple`), e este fluxo já suporta selecionar várias fotos de uma vez (`handleUploadImagem` recebe uma lista). O componente abaixo reaproveita a mesma ideia visual (dropzone, estado de arrasto, validação de tipo/tamanho antes de enviar) mas troca a simulação por um estado `enviando` vindo de fora — o mesmo `isUploadingImagem` que já reflete a chamada real à API — e aceita vários arquivos.

- [ ] **Step 1: Escrever o teste (falhando)**

Criar `src/features/estoque/EstoqueUploadFotos.test.tsx`:

```tsx
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { EstoqueUploadFotos } from './EstoqueUploadFotos';

function criarArquivo(nome: string, tipo: string, tamanhoBytes: number): File {
  return new File([new Uint8Array(tamanhoBytes)], nome, { type: tipo });
}

function inputDeArquivo() {
  return screen.getByLabelText(/Enviar fotos/i).querySelector('input[type="file"]') as HTMLInputElement;
}

describe('EstoqueUploadFotos', () => {
  afterEach(() => cleanup());

  it('seleciona um arquivo válido e chama onArquivosSelecionados', () => {
    const onArquivosSelecionados = vi.fn();
    render(<EstoqueUploadFotos imagens={[]} onRemoverImagem={() => {}} onArquivosSelecionados={onArquivosSelecionados} enviando={false} resumoCompressao={null} />);

    const arquivo = criarArquivo('foto.jpg', 'image/jpeg', 1024);
    fireEvent.change(inputDeArquivo(), { target: { files: [arquivo] } });

    expect(onArquivosSelecionados).toHaveBeenCalledWith([arquivo]);
  });

  it('rejeita tipo de arquivo não aceito sem chamar onArquivosSelecionados', () => {
    const onArquivosSelecionados = vi.fn();
    render(<EstoqueUploadFotos imagens={[]} onRemoverImagem={() => {}} onArquivosSelecionados={onArquivosSelecionados} enviando={false} resumoCompressao={null} />);

    const arquivo = criarArquivo('foto.pdf', 'application/pdf', 1024);
    fireEvent.change(inputDeArquivo(), { target: { files: [arquivo] } });

    expect(onArquivosSelecionados).not.toHaveBeenCalled();
    expect(screen.getByText(/Formato não aceito/)).toBeTruthy();
  });

  it('rejeita arquivo maior que o limite', () => {
    const onArquivosSelecionados = vi.fn();
    render(<EstoqueUploadFotos imagens={[]} onRemoverImagem={() => {}} onArquivosSelecionados={onArquivosSelecionados} enviando={false} resumoCompressao={null} />);

    const arquivo = criarArquivo('foto.jpg', 'image/jpeg', 9 * 1024 * 1024);
    fireEvent.change(inputDeArquivo(), { target: { files: [arquivo] } });

    expect(onArquivosSelecionados).not.toHaveBeenCalled();
    expect(screen.getByText(/Arquivo muito grande/)).toBeTruthy();
  });

  it('mostra "Enviando fotos..." quando enviando=true', () => {
    render(<EstoqueUploadFotos imagens={[]} onRemoverImagem={() => {}} onArquivosSelecionados={() => {}} enviando resumoCompressao={null} />);
    expect(screen.getByText('Enviando fotos...')).toBeTruthy();
  });

  it('clicar em remover chama onRemoverImagem com a url certa', () => {
    const onRemoverImagem = vi.fn();
    render(<EstoqueUploadFotos imagens={['https://x/a.jpg']} onRemoverImagem={onRemoverImagem} onArquivosSelecionados={() => {}} enviando={false} resumoCompressao={null} />);
    fireEvent.click(screen.getByTitle('Remover foto'));
    expect(onRemoverImagem).toHaveBeenCalledWith('https://x/a.jpg');
  });

  it('mostra o resumo de compressão quando presente', () => {
    render(<EstoqueUploadFotos imagens={[]} onRemoverImagem={() => {}} onArquivosSelecionados={() => {}} enviando={false} resumoCompressao="Fotos otimizadas: 4 MB → 1 MB" />);
    expect(screen.getByText('Fotos otimizadas: 4 MB → 1 MB')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npx vitest run src/features/estoque/EstoqueUploadFotos.test.tsx`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

Criar `src/features/estoque/EstoqueUploadFotos.tsx`:

```tsx
// Dropzone de fotos do Estoque — mesma linguagem visual do file-upload
// (Kokonut UI), mas sem a simulação de progresso por timer do original (que
// nunca reflete o upload de verdade) e aceitando vários arquivos de uma vez
// (o original só aceitava 1). Ver nota "por que precisa de adaptação" na
// Task 3 do plano de componentes animados do Estoque.
import { type DragEvent, useCallback, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, Loader2, UploadCloud, X } from 'lucide-react';
import { cn } from '../../utils';
import { SPRING_MICRO } from '../../components/ui/motion';

const TIPOS_ACEITOS = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
// Margem acima do limite de 5MB do backend — comprimirImagem() encolhe antes
// de enviar, então o que barra aqui é só o caso claramente fora do padrão.
const TAMANHO_MAX_BYTES = 8 * 1024 * 1024;

interface EstoqueUploadFotosProps {
  imagens: string[];
  onRemoverImagem: (url: string) => void;
  onArquivosSelecionados: (files: File[]) => void;
  enviando: boolean;
  resumoCompressao: string | null;
}

export function EstoqueUploadFotos({ imagens, onRemoverImagem, onArquivosSelecionados, enviando, resumoCompressao }: EstoqueUploadFotosProps) {
  const [arrastando, setArrastando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validarEEnviar = useCallback(
    (arquivos: File[]) => {
      setErro(null);
      const invalido = arquivos.find((f) => !TIPOS_ACEITOS.includes(f.type));
      if (invalido) return setErro(`Formato não aceito: ${invalido.name}`);
      const grande = arquivos.find((f) => f.size > TAMANHO_MAX_BYTES);
      if (grande) return setErro(`Arquivo muito grande: ${grande.name}`);
      onArquivosSelecionados(arquivos);
    },
    [onArquivosSelecionados]
  );

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setArrastando(false);
      if (enviando) return;
      const arquivos = Array.from(e.dataTransfer.files);
      if (arquivos.length > 0) validarEEnviar(arquivos);
    },
    [enviando, validarEEnviar]
  );

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!enviando) setArrastando(true);
        }}
        onDragLeave={() => setArrastando(false)}
        onDrop={handleDrop}
        onClick={() => !enviando && inputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="Enviar fotos: clique ou arraste arquivos aqui"
        className={cn(
          'relative flex flex-col items-center justify-center gap-2 rounded-control border-2 border-dashed py-6 px-4 text-center transition-colors cursor-pointer',
          arrastando ? 'border-accent bg-accent-soft-bg/30' : 'border-border-default hover:border-accent/50',
          enviando && 'pointer-events-none opacity-70'
        )}
      >
        {enviando ? <Loader2 size={22} className="animate-spin text-accent-soft-fg" /> : <UploadCloud size={22} className="text-text-faint" />}
        <p className="text-xs font-semibold text-text-secondary">{enviando ? 'Enviando fotos...' : 'Arraste fotos aqui ou clique pra escolher'}</p>
        <p className="text-[10.5px] text-text-faint">JPG, PNG, WEBP ou GIF</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={TIPOS_ACEITOS.join(',')}
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) validarEEnviar(Array.from(e.target.files));
            e.target.value = '';
          }}
        />
      </div>

      <AnimatePresence>
        {erro && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={SPRING_MICRO}
            className="flex items-center gap-1.5 text-[11px] text-danger"
          >
            <AlertTriangle size={12} className="shrink-0" /> {erro}
          </motion.p>
        )}
      </AnimatePresence>

      {resumoCompressao && <p className="text-[11px] text-positive">{resumoCompressao}</p>}

      {imagens.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {imagens.map((url, i) => (
            <div key={url} className="relative size-20 rounded-control overflow-hidden border border-border-default">
              <img src={url} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              {i === 0 && (
                <span className="absolute bottom-0 inset-x-0 bg-media-overlay-badge text-white text-[9px] font-semibold uppercase tracking-wide text-center py-0.5">
                  Capa
                </span>
              )}
              <button
                type="button"
                onClick={() => onRemoverImagem(url)}
                title="Remover foto"
                className="absolute top-1 right-1 size-6 rounded-full bg-overlay-scrim text-white flex items-center justify-center hover:bg-danger"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx vitest run src/features/estoque/EstoqueUploadFotos.test.tsx`
Expected: PASS (6 testes).

- [ ] **Step 5: Alargar o tipo de `handleUploadImagem` em `EstoqueView.tsx`**

Em `src/features/estoque/EstoqueView.tsx:345`, trocar:

```tsx
const handleUploadImagem = async (files: FileList) => {
```

por:

```tsx
const handleUploadImagem = async (files: FileList | File[]) => {
```

O corpo da função já faz `Array.from(files)` — nenhuma outra linha muda. Isso é só ampliar o tipo aceito; a chamada real (`uploadImagemEstoque`) e o endpoint continuam exatamente os mesmos.

- [ ] **Step 6: Encaixar em `EstoqueView.tsx` — `ModalSection titulo="Fotos"`**

Adicionar o import:

```tsx
import { EstoqueUploadFotos } from './EstoqueUploadFotos';
```

Em `EstoqueView.tsx:1573-1648`, o bloco `<ModalSection titulo="Fotos">` hoje tem: texto de ajuda, grid de miniaturas com badge "Capa" e botão remover, botão "Câmera" (`md:hidden`, `capture="environment"`), botão "Galeria" (multi-select) e os dois `<input type="file" hidden>`. Substituir por:

```tsx
<ModalSection titulo="Fotos">
  <div className="space-y-3">
    <p className="text-xs text-text-faint">A primeira foto é a capa mostrada na lista. Pode anexar mais de uma.</p>

    {/* Câmera fica separada (só mobile, abre direto a câmera) — a galeria
        vira o dropzone abaixo, que também mostra as miniaturas já anexadas. */}
    <button
      type="button"
      onClick={() => inputCameraRef.current?.click()}
      disabled={isUploadingImagem}
      className="md:hidden w-full flex items-center justify-center gap-2 py-3 px-3 rounded-control border-2 border-dashed cursor-pointer text-xs font-semibold uppercase tracking-wider transition-colors border-border-default text-text-muted hover:border-accent/50 hover:text-accent-soft-fg disabled:opacity-50"
    >
      {isUploadingImagem ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />} Câmera
    </button>
    <input
      ref={inputCameraRef}
      type="file"
      accept="image/jpeg,image/png,image/webp,image/gif"
      capture="environment"
      className="hidden"
      onChange={(e) => {
        if (e.target.files?.length) handleUploadImagem(e.target.files);
        e.target.value = '';
      }}
    />

    <EstoqueUploadFotos
      imagens={formData.imagens}
      onRemoverImagem={(url) => setFormData((prev) => ({ ...prev, imagens: prev.imagens.filter((u) => u !== url) }))}
      onArquivosSelecionados={handleUploadImagem}
      enviando={isUploadingImagem}
      resumoCompressao={resumoCompressao}
    />
  </div>
</ModalSection>
```

Remover a declaração `const inputGaleriaRef = useRef<HTMLInputElement>(null);` (linha 238) — não tem mais consumidor, `EstoqueUploadFotos` tem seu próprio input interno.

- [ ] **Step 7: Rodar a suíte de Estoque inteira**

Run: `npx vitest run src/features/estoque`
Expected: PASS.

- [ ] **Step 8: Checar tipos**

Run: `npm run lint`
Expected: sem erros novos além do 1 pré-existente em `vite.config.ts` (`worker.format`, sem relação com este plano — ver Global Constraints).

- [ ] **Step 9: Commit**

```bash
git add src/features/estoque/EstoqueUploadFotos.tsx src/features/estoque/EstoqueUploadFotos.test.tsx src/features/estoque/EstoqueView.tsx
git commit -m "feat(estoque): upload de fotos com drag-and-drop, validação e progresso real"
```

---

## Task 4: Cards expansíveis inline (avaria, categoria completa, fotos, links)

Clicar num chevron (não na linha/card inteiro — isso continua abrindo o `DetailModal` de sempre) expande, sem navegar, o que hoje só dava pra ver abrindo outra tela: descrição da avaria por unidade, o caminho completo da categoria, todas as fotos e os links de ML/Shopee/Facebook.

**Files:**
- Create: `src/test/setup.ts` (polyfill `ResizeObserver`)
- Modify: `vite.config.ts` (registra o `setupFiles`)
- Create: `src/components/ui/expandable.tsx` (via CLI — sem retheme, ver nota)
- Create: `src/features/estoque/EstoqueItemExpandido.tsx`
- Test: `src/features/estoque/EstoqueItemExpandido.test.tsx`
- Modify: `src/features/estoque/EstoqueView.tsx` (coluna "Peça" da tabela desktop, `renderMobileCard`, corpo da tabela)

**Interfaces:**
- Produces: `Expandable`, `ExpandableTrigger`, `ExpandableContent` de `src/components/ui/expandable.tsx` (usados só no card mobile — ver nota "desktop vs. mobile" abaixo)
- Produces: `EstoqueItemExpandido` — `{ item: Estoque; categorias: Categoria[] }`
- Consumes: `getAncestorChain` de `../categorias/categoriaTree.ts` (já existe, usado pelo Organograma)

### Nota: por que o desktop não usa `Expandable` do jeito que o mobile usa

`Expandable` (Cult UI) funciona com um Context Provider cujo `Trigger` e `Content` precisam estar na mesma subárvore React, dentro de um único `motion.div` raiz. No card mobile isso é natural (card inteiro é 1 `<div>`). Na tabela desktop, o chevron mora dentro da célula "Peça" e o painel expandido precisa ocupar uma `<TableRow>` inteira **separada**, logo abaixo — colocar um `motion.div` (a raiz do `Expandable`) entre duas `<tr>` dentro de um `<tbody>` é HTML inválido. A Task 4 resolve isso com dois caminhos que produzem o mesmo resultado visual (mesmo `SPRING_MICRO`, mesmo conteúdo via `EstoqueItemExpandido`):
- **Mobile:** usa `Expandable`/`ExpandableTrigger`/`ExpandableContent` de verdade, envolvendo o card inteiro.
- **Desktop:** estado de expansão controlado direto em `EstoqueView` (`expandidos: Set<string>`), com a animação de altura feita à mão via `motion.div` dentro do `<TableCell>` da linha extra — mesmo padrão de spring, sem depender do Context do `Expandable` (que não cabe na estrutura de tabela).

Por isso `expandable.tsx` não precisa de retheme: os 4 exports usados (`Expandable`, `ExpandableTrigger`, `ExpandableContent`, e o contexto interno) não têm nenhuma classe de cor hardcoded — só a família `ExpandableCard`/`Header`/`Content`/`Footer` (que este plano não usa) tem `bg-white dark:bg-muted` etc.

- [ ] **Step 1: Polyfill de `ResizeObserver` pra teste (fazer ANTES de qualquer outro passo desta task)**

`Expandable` depende de `react-use-measure`, que usa `ResizeObserver` — ausente no jsdom. Sem isso, `EstoqueView.tabela.test.tsx` quebra inteiro (ele sempre renderiza o card mobile, só escondido por CSS `md:hidden`, que o jsdom não avalia).

Criar `src/test/setup.ts`:

```ts
// Setup global de teste (Vitest) — hoje só o polyfill de ResizeObserver, que
// jsdom não implementa nativamente e que react-use-measure (dependência do
// Expandable, Cult UI) precisa pra renderizar sem lançar erro.
class ResizeObserverPolyfill {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  // @ts-expect-error — polyfill mínimo só pra teste, não precisa da API completa.
  globalThis.ResizeObserver = ResizeObserverPolyfill;
}
```

Em `vite.config.ts`, adicionar o bloco `test` ao objeto retornado por `defineConfig` (depois de `server`):

```ts
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
    },
```

E no topo do arquivo, adicionar a referência de tipos do Vitest (senão `tsc --noEmit` não reconhece a chave `test` no objeto de config):

```ts
/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
```

- [ ] **Step 2: Rodar a suíte de Estoque pra confirmar que o polyfill não quebrou nada**

Run: `npx vitest run src/features/estoque`
Expected: PASS — mesmo resultado de antes (o polyfill não muda comportamento nenhum, só evita o erro que a Task 4 introduziria).

- [ ] **Step 3: Instalar o Expandable (Cult UI)**

```bash
npx shadcn@latest add https://cult-ui.com/r/expandable.json
```

Cria `src/components/ui/expandable.tsx` e adiciona `react-use-measure` ao `package.json`. Não precisa de nenhuma edição — ver nota acima sobre por que não precisa de retheme.

- [ ] **Step 4: Escrever o teste (falhando) de `EstoqueItemExpandido`**

Criar `src/features/estoque/EstoqueItemExpandido.test.tsx`:

```tsx
// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { EstoqueItemExpandido } from './EstoqueItemExpandido';
import type { Estoque } from './types';
import type { Categoria } from '../../types/catalog';

function criarItem(overrides: Partial<Estoque> & Pick<Estoque, 'id' | 'nome'>): Estoque {
  return {
    codigo: `RK-${overrides.id}`,
    categoria_id: null,
    modelo_moto_id: null,
    condicao: 'original',
    condicao_nota: null,
    nota_cadastro: null,
    ano: null,
    valor: 100,
    quantidade: 1,
    imagens: [],
    descricao: null,
    ativo: true,
    criado_em: '2026-01-01T00:00:00.000Z',
    atualizado_em: '2026-01-01T00:00:00.000Z',
    anuncio_ml_url: null,
    anuncio_fb_url: null,
    componentes: null,
    unidades_incompletas: [],
    ...overrides,
  };
}

describe('EstoqueItemExpandido', () => {
  afterEach(() => cleanup());

  it('mostra o caminho completo da categoria', () => {
    const categorias: Categoria[] = [
      { id: 'raiz', nome: 'Elétrica', parent_id: null, ordem: 0 },
      { id: 'filha', nome: 'CDI', parent_id: 'raiz', ordem: 0 },
    ];
    const item = criarItem({ id: 'a', nome: 'CDI Titan', categoria_id: 'filha' });
    render(<EstoqueItemExpandido item={item} categorias={categorias} />);
    expect(screen.getByText('Elétrica › CDI')).toBeTruthy();
  });

  it('lista avarias das unidades marcadas, com apelido e descrição', () => {
    const item = criarItem({
      id: 'a',
      nome: 'TBI',
      unidades: [
        { id: 'u1', estoque_id: 'a', apelido: 'A amassada', avaria: true, avaria_descricao: 'Bico torto', fotos: [], valor: null, condicao_nota: null, criado_em: '', atualizado_em: '' },
        { id: 'u2', estoque_id: 'a', apelido: null, avaria: false, avaria_descricao: null, fotos: [], valor: null, condicao_nota: null, criado_em: '', atualizado_em: '' },
      ],
    });
    render(<EstoqueItemExpandido item={item} categorias={[]} />);
    expect(screen.getByText('A amassada: Bico torto')).toBeTruthy();
  });

  it('mostra "Nenhum anúncio vinculado" quando não há ML, Shopee nem Facebook', () => {
    const item = criarItem({ id: 'a', nome: 'Peça sem anúncio' });
    render(<EstoqueItemExpandido item={item} categorias={[]} />);
    expect(screen.getByText('Nenhum anúncio vinculado.')).toBeTruthy();
  });

  it('lista o link do Mercado Livre quando existe', () => {
    const item = criarItem({
      id: 'a',
      nome: 'Peça com ML',
      links_ml: [{ id: 'l1', estoque_id: 'a', url: 'https://ml/1', mlb_id: 'MLB1', criado_em: '', atualizado_em: '' }],
    });
    render(<EstoqueItemExpandido item={item} categorias={[]} />);
    expect(screen.getByText(/Mercado Livre/)).toBeTruthy();
  });

  it('mostra "Sem fotos" quando a peça não tem nenhuma imagem', () => {
    const item = criarItem({ id: 'a', nome: 'Peça sem foto', imagens: [] });
    render(<EstoqueItemExpandido item={item} categorias={[]} />);
    expect(screen.getByText('Sem fotos')).toBeTruthy();
  });
});
```

- [ ] **Step 5: Rodar e confirmar falha**

Run: `npx vitest run src/features/estoque/EstoqueItemExpandido.test.tsx`
Expected: FAIL — módulo não existe.

- [ ] **Step 6: Implementar `EstoqueItemExpandido`**

Criar `src/features/estoque/EstoqueItemExpandido.tsx`:

```tsx
// Painel de detalhe inline de uma peça — avaria por unidade, categoria
// completa, fotos e links de anúncio, sem sair da lista. Todo clique aqui
// dentro para a propagação: a linha/card por trás continua abrindo o
// DetailModal (onSelectItem) só quando clicado fora deste painel.
import { AlertTriangle, ExternalLink, Package } from 'lucide-react';
import { getAncestorChain } from '../categorias/categoriaTree';
import type { Categoria } from '../../types/catalog';
import type { Estoque } from './types';

interface EstoqueItemExpandidoProps {
  item: Estoque;
  categorias: Categoria[];
}

export function EstoqueItemExpandido({ item, categorias }: EstoqueItemExpandidoProps) {
  const caminhoCategoria = item.categoria_id ? getAncestorChain(item.categoria_id, categorias).map((c) => c.nome).join(' › ') : null;
  const unidadesComAvaria = (item.unidades ?? []).filter((u) => u.avaria);
  const semAnuncio = !item.links_ml?.length && !item.links_shopee?.length && !item.anuncio_fb_url;

  return (
    <div onClick={(e) => e.stopPropagation()} className="grid gap-4 p-4 bg-surface-inset rounded-control sm:grid-cols-2">
      <div className="space-y-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-text-faint mb-1">Categoria completa</p>
          <p className="text-xs text-text-secondary">{caminhoCategoria ?? 'Sem categoria'}</p>
        </div>

        {unidadesComAvaria.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-text-faint mb-1">Avarias</p>
            <ul className="space-y-1.5">
              {unidadesComAvaria.map((u) => (
                <li key={u.id} className="flex items-start gap-1.5 text-xs text-warning">
                  <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                  <span>
                    {u.apelido ? `${u.apelido}: ` : ''}
                    {u.avaria_descricao || 'Sem descrição'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-text-faint mb-1">Anúncios</p>
          <div className="flex flex-col gap-1">
            {(item.links_ml ?? []).map((link) => (
              <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-accent-soft-fg hover:underline">
                <ExternalLink size={11} /> Mercado Livre{link.status_ml ? ` — ${link.status_ml}` : ''}
              </a>
            ))}
            {(item.links_shopee ?? []).map((link) =>
              link.url ? (
                <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-accent-soft-fg hover:underline">
                  <ExternalLink size={11} /> Shopee{link.status_shopee ? ` — ${link.status_shopee}` : ''}
                </a>
              ) : null
            )}
            {item.anuncio_fb_url && (
              <a href={item.anuncio_fb_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-accent-soft-fg hover:underline">
                <ExternalLink size={11} /> Facebook
              </a>
            )}
            {semAnuncio && <p className="text-xs text-text-faint">Nenhum anúncio vinculado.</p>}
          </div>
        </div>
      </div>

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-text-faint mb-1">Fotos ({item.imagens.length})</p>
        {item.imagens.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {item.imagens.map((url, i) => (
              <img key={url} src={url} alt={`Foto ${i + 1}`} className="size-16 rounded-control object-cover border border-border-default" referrerPolicy="no-referrer" />
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-text-faint">
            <Package size={14} /> Sem fotos
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Rodar e confirmar que passa**

Run: `npx vitest run src/features/estoque/EstoqueItemExpandido.test.tsx`
Expected: PASS (5 testes).

- [ ] **Step 8: Adicionar estado de expansão em `EstoqueView.tsx`**

Adicionar os imports:

```tsx
import { Fragment } from 'react';
import { Expandable, ExpandableContent, ExpandableTrigger } from '../../components/ui/expandable';
import { EstoqueItemExpandido } from './EstoqueItemExpandido';
import { SPRING_MICRO } from '../../components/ui/motion';
```

E na linha de import de `'motion/react'`, trocar:

```tsx
import { AnimatePresence } from 'motion/react';
```

por:

```tsx
import { AnimatePresence, motion } from 'motion/react';
```

Adicionar o estado, perto de `pagination`/`sorting`:

```tsx
const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
const toggleExpandido = useCallback((id: string) => {
  setExpandidos((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
}, []);
```

- [ ] **Step 9: Chevron na coluna "Peça" (desktop) + linha extra expandida**

Na definição da coluna `peca` (dentro do `useMemo<ColumnDef<Estoque>[]>`), dentro do `cell: ({ row }) => { ... }`, adicionar o chevron como primeiro filho do `<div className="flex items-center gap-2.5">`:

```tsx
cell: ({ row }) => {
  const item = row.original;
  const aberto = expandidos.has(item.id);
  return (
    <div className="flex items-center gap-2.5">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          toggleExpandido(item.id);
        }}
        aria-label={aberto ? 'Recolher detalhes' : 'Ver mais detalhes'}
        aria-expanded={aberto}
        className="shrink-0 p-1 rounded-control text-text-faint hover:text-text-secondary hover:bg-surface-raised"
      >
        <ChevronDown size={13} className={cn('transition-transform', aberto ? 'rotate-0' : '-rotate-90')} />
      </button>
      <div className="size-9 rounded-control overflow-hidden shrink-0 flex items-center justify-center bg-surface-inset">
        {/* ...resto da célula continua exatamente igual (imagem/ícone, nome, badges)... */}
```

(o resto do corpo da célula não muda — só o `<button>` novo entra antes da `<div className="size-9...">` já existente). Adicionar `expandidos` e `toggleExpandido` ao array de dependências do `useMemo` das colunas (linha `[readOnly, abrirAnunciosMl, openEditModal]` → `[readOnly, abrirAnunciosMl, openEditModal, expandidos, toggleExpandido]`).

No corpo da tabela desktop (`table.getRowModel().rows.map((row) => { ... })`), envolver a `<TableRow>` existente e uma nova `<TableRow>` condicional num `Fragment` com `key`:

```tsx
table.getRowModel().rows.map((row) => {
  const item = row.original;
  const emAlerta = isEstoqueBaixo(item);
  const aberto = expandidos.has(item.id);
  return (
    <Fragment key={row.id}>
      <TableRow
        onClick={() => onSelectItem(item)}
        className={cn(
          'border-b border-border-subtle last:border-b-0 cursor-pointer',
          emAlerta ? 'border-l-2 border-l-warning' : 'border-l-2 border-l-transparent'
        )}
      >
        {row.getVisibleCells().map((cell) => (
          <TableCell key={cell.id} className={cn('px-3 py-2.5 text-text-secondary whitespace-normal', alinhamentoDaColuna(cell.column.id))}>
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </TableCell>
        ))}
      </TableRow>
      <AnimatePresence>
        {aberto && (
          <TableRow className="hover:bg-transparent border-b border-border-subtle">
            <TableCell colSpan={columns.length} className="p-0">
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={SPRING_MICRO}
                className="overflow-hidden"
              >
                <EstoqueItemExpandido item={item} categorias={categorias} />
              </motion.div>
            </TableCell>
          </TableRow>
        )}
      </AnimatePresence>
    </Fragment>
  );
})
```

- [ ] **Step 10: Chevron + painel expandido no card mobile**

O bloco mobile (`<div className="md:hidden">`) hoje renderiza:

```tsx
<div key={row.id} onClick={() => onSelectItem(item)} className={cn('border-l-2 px-3 py-3 cursor-pointer', emAlerta ? 'border-l-warning' : 'border-l-transparent')}>
  {renderMobileCard(item)}
</div>
```

Substituir por (usa `Expandable` de verdade — ver nota "desktop vs. mobile" no início da Task 4):

```tsx
<Expandable
  key={row.id}
  expanded={expandidos.has(item.id)}
  onToggle={() => toggleExpandido(item.id)}
  onClick={() => onSelectItem(item)}
  className={cn('border-l-2 px-3 py-3 cursor-pointer', emAlerta ? 'border-l-warning' : 'border-l-transparent')}
>
  <div className="flex items-start justify-between gap-2">
    <div className="flex-1 min-w-0">{renderMobileCard(item)}</div>
    <ExpandableTrigger
      onClickCapture={(e) => e.stopPropagation()}
      aria-label={expandidos.has(item.id) ? 'Recolher detalhes' : 'Ver mais detalhes'}
      className="shrink-0 p-1 -mr-1 mt-0.5 rounded-control text-text-faint hover:text-text-secondary hover:bg-surface-raised"
    >
      <ChevronDown size={14} className={cn('transition-transform', expandidos.has(item.id) ? 'rotate-0' : '-rotate-90')} />
    </ExpandableTrigger>
  </div>
  <ExpandableContent keepMounted={false} preset="fade">
    <div className="mt-3">
      <EstoqueItemExpandido item={item} categorias={categorias} />
    </div>
  </ExpandableContent>
</Expandable>
```

- [ ] **Step 11: Rodar a suíte de Estoque inteira**

Run: `npx vitest run src/features/estoque`
Expected: PASS — inclui `EstoqueItemExpandido.test.tsx` (novo) e `EstoqueView.tabela.test.tsx` (continua passando: o clique na linha/card pra `onSelectItem` não muda, só ganhou um chevron ao lado que nenhum teste existente aciona).

- [ ] **Step 12: Teste manual do clique não-propagar (checklist, não automatizável em jsdom de forma simples — `Expandable` anima altura via `react-use-measure`, que o polyfill do Step 1 deixa passar mas sem medir layout real)**

Rodar `npm run dev`, abrir a tela de Estoque:
- Clicar no chevron de uma linha/card: expande, mostra avaria/categoria/fotos/links, **não** abre o `DetailModal`.
- Clicar em qualquer outro ponto da linha/card (nome, badge, fora do chevron): abre o `DetailModal`, como sempre abriu.
- Clicar num link (ML/Shopee/Facebook) dentro do painel expandido: abre o link em nova aba, **não** dispara o `DetailModal` por baixo.

- [ ] **Step 13: Checar tipos**

Run: `npm run lint`
Expected: sem erros novos. **Baseline conhecido:** este repo já tem 1 erro pré-existente em `vite.config.ts` (`worker.format: string` não é `"es" | "iife"`), sem relação com este plano — ele continua aparecendo depois desta task, e não é algo pra corrigir aqui.

- [ ] **Step 14: Commit**

```bash
git add src/test/setup.ts vite.config.ts src/components/ui/expandable.tsx src/features/estoque/EstoqueItemExpandido.tsx src/features/estoque/EstoqueItemExpandido.test.tsx src/features/estoque/EstoqueView.tsx package.json package-lock.json
git commit -m "feat(estoque): expande peça inline (avaria, categoria completa, fotos, links) sem abrir tela nova"
```

---

## Fora deste plano (itens `[opcional]` do Módulo 2 original)

Não implementados aqui — cada um tem esforço/risco próprio o suficiente pra merecer seu próprio plano, se algum dia fizer sentido:

- **Organograma como árvore de arquivos** (Animate UI `Files`) — o próprio módulo original já sinalizava como "maior esforço": o componente é pensado pra pasta/arquivo de código, não pra hierarquia moto/categoria — precisaria adaptar o conceito, não só o visual. O Organograma atual (`CategoriaOrgChart`/`MotoOrgChart`) continua como está.
- **`carousel-cards`** (destaque de "peças cadastradas hoje"/"estoque baixo") — a Task 1 já reaproveita `resumoDoDia` no bloco de conferência do dia existente; um carrossel separado é aditivo, não crítico.
- **`edge-blur`** no topo/rodapé da lista longa — puramente decorativo (gradiente de fade), sem ganho funcional que justifique nova dependência agora.

## Nota final: efeito colateral em `EstoqueView.tsx`

Antes deste plano, `EstoqueView.tsx` tinha ~1881 linhas. Depois das 4 tasks, o arquivo **encolhe** (perde ~200 linhas de JSX que viram os 4 componentes novos), apesar de ganhar imports e o estado de `expandidos`. Nenhuma task worth adicionar abstração além do que cada bloco substituído já fazia.
